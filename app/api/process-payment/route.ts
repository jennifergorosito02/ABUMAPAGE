import { NextRequest, NextResponse } from 'next/server'
import { MercadoPagoConfig, Payment } from 'mercadopago'
import { createClient } from '@supabase/supabase-js'

const mp = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN! })

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function notificarWhatsApp(mensaje: string) {
  const numeros = [
    { phone: '541127178564', apikey: process.env.WA_APIKEY_1 },
    { phone: '541164595509', apikey: process.env.WA_APIKEY_2 },
  ]
  for (const { phone, apikey } of numeros) {
    if (!apikey) continue
    try {
      await fetch(`https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodeURIComponent(mensaje)}&apikey=${apikey}`)
    } catch (e) {
      console.error(`Error notificando ${phone}:`, e)
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const {
      // Datos del Brick de MP
      token, payment_method_id, installments, issuer_id, payer,
      // Datos del carrito
      items, metodo_pago, recargo, cliente, tipo_envio, direccion_envio, costo_envio,
    } = await request.json()

    const supabase = supabaseAdmin()

    // Calcular totales
    const esCredito = metodo_pago === 'credito'
    const precioFinal = (precio: number) =>
      esCredito ? Math.round(precio * (1 + (recargo ?? 0) / 100)) : precio

    const subtotalProductos = items.reduce((s: number, i: any) => s + i.precio_venta * i.cantidad, 0)
    const subtotalConRecargo = esCredito
      ? Math.round(subtotalProductos * (1 + (recargo ?? 0) / 100))
      : subtotalProductos
    const gastoEnvio = tipo_envio === 'domicilio' ? (costo_envio ?? 0) : 0
    const total = subtotalConRecargo + gastoEnvio

    // 1. Crear pedido en Supabase
    const { data: pedido, error: pedidoError } = await supabase
      .from('pedidos')
      .insert({
        cliente_nombre: cliente?.nombre ?? null,
        cliente_email: cliente?.email ?? null,
        cliente_telefono: cliente?.telefono ?? null,
        metodo_pago,
        subtotal: subtotalProductos,
        total,
        recargo_pct: esCredito ? (recargo ?? 0) : 0,
        tipo_envio: tipo_envio ?? 'retiro',
        direccion_envio: direccion_envio ?? null,
        estado: 'pendiente',
      })
      .select('id')
      .single()

    if (pedidoError || !pedido) {
      console.error('Error creando pedido:', pedidoError)
      return NextResponse.json({ error: 'Error al registrar el pedido' }, { status: 500 })
    }

    // 2. Insertar items
    await supabase.from('pedido_items').insert(
      items.map((i: any) => ({
        pedido_id: pedido.id,
        producto_id: i.id,
        nombre: i.nombre,
        cantidad: i.cantidad,
        precio_unitario: precioFinal(i.precio_venta),
      }))
    )

    // 3. Procesar pago con MP
    const paymentClient = new Payment(mp)
    const paymentResult = await paymentClient.create({
      body: {
        transaction_amount: total,
        token,
        description: 'Pedido ABUMA.MA',
        installments: Number(installments) || 1,
        payment_method_id,
        issuer_id: issuer_id ? Number(issuer_id) : undefined,
        payer: {
          email: payer?.email ?? cliente?.email ?? 'cliente@abuma.ma',
          identification: payer?.identification,
        },
        external_reference: pedido.id,
        notification_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/mp-webhook`,
      },
    })

    const status = paymentResult.status
    const paymentId = paymentResult.id

    if (status === 'approved') {
      // Descontar stock
      const { data: itemsStock } = await supabase
        .from('pedido_items')
        .select('producto_id, cantidad')
        .eq('pedido_id', pedido.id)

      for (const item of itemsStock ?? []) {
        await supabase.rpc('descontar_stock_online', {
          p_producto_id: item.producto_id,
          p_cantidad: item.cantidad,
        })
      }

      // Marcar como aprobado
      await supabase
        .from('pedidos')
        .update({ estado: 'aprobado', mp_payment_id: String(paymentId) })
        .eq('id', pedido.id)

      // Notificación WhatsApp
      const formatARS = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`
      const listaItems = items
        .map((i: any) => `  • ${i.nombre} x${i.cantidad} — ${formatARS(precioFinal(i.precio_venta) * i.cantidad)}`)
        .join('\n')

      const envioLabel = tipo_envio === 'domicilio'
        ? `🚚 Envío a domicilio: ${direccion_envio ?? ''}`
        : '🏪 Retiro en local'

      const mensaje = [
        '🛍️ *NUEVO PEDIDO ABUMA.MA*',
        '',
        `👤 Cliente: ${cliente?.nombre ?? 'Sin nombre'}`,
        cliente?.telefono ? `📱 WhatsApp: ${cliente.telefono}` : '',
        `💳 Pago: ${esCredito ? 'Crédito (con recargo)' : 'Débito'}`,
        envioLabel,
        '',
        '*Productos:*',
        listaItems,
        '',
        `💰 *Total: ${formatARS(total)}*`,
      ].filter(Boolean).join('\n')

      await notificarWhatsApp(mensaje)

    } else if (status === 'rejected') {
      await supabase
        .from('pedidos')
        .update({ estado: 'cancelado', mp_payment_id: String(paymentId) })
        .eq('id', pedido.id)
    }
    // 'in_process' / 'pending': el webhook lo maneja cuando cambie el estado

    return NextResponse.json({
      status,
      status_detail: paymentResult.status_detail,
      pedido_id: pedido.id,
      payment_id: paymentId,
    })

  } catch (error: any) {
    console.error('Process payment error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}