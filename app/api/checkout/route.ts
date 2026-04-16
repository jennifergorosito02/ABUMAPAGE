import { NextRequest, NextResponse } from 'next/server'
import { MercadoPagoConfig, Preference } from 'mercadopago'
import { createClient } from '@supabase/supabase-js'

const mp = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN!,
})

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: NextRequest) {
  try {
    const { items, metodo_pago, recargo, back_url, cliente, tipo_envio, direccion_envio, costo_envio, sin_mp } = await request.json()

    const supabase = supabaseAdmin()

    const precioFinal = (precio: number) =>
      metodo_pago === 'credito' ? Math.round(precio * (1 + (recargo ?? 0) / 100)) : precio

    const subtotalProductos = items.reduce((s: number, i: any) => s + i.precio_venta * i.cantidad, 0)
    const subtotalConRecargo = metodo_pago === 'credito'
      ? Math.round(subtotalProductos * (1 + (recargo ?? 0) / 100))
      : subtotalProductos
    const gastoEnvio = tipo_envio === 'domicilio' ? (costo_envio ?? 0) : 0
    const total = subtotalConRecargo + gastoEnvio

    // 1. Insertar pedido en Supabase
    const { data: pedido, error: pedidoError } = await supabase
      .from('pedidos')
      .insert({
        cliente_nombre: cliente?.nombre ?? null,
        cliente_email: cliente?.email ?? null,
        cliente_telefono: cliente?.telefono ?? null,
        metodo_pago,
        subtotal: subtotalProductos,
        total,
        recargo_pct: recargo ?? 0,
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

    // 2. Insertar items del pedido
    await supabase.from('pedido_items').insert(
      items.map((i: any) => ({
        pedido_id: pedido.id,
        producto_id: i.id,
        nombre: i.nombre,
        cantidad: i.cantidad,
        precio_unitario: precioFinal(i.precio_venta),
      }))
    )

    // 3. Si es pago por transferencia (sin MP), notificar y devolver pedido_id
    if (sin_mp) {
      const formatARS = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`
      const listaItems = items.map((i: any) => `  • ${i.nombre} x${i.cantidad}`).join('\n')
      const msg = [
        '🔔 *NUEVO PEDIDO — PENDIENTE PAGO*',
        '',
        `👤 ${cliente?.nombre ?? 'Sin nombre'}`,
        cliente?.telefono ? `📱 ${cliente.telefono}` : '',
        `💳 Pago: Débito / Transferencia`,
        '🏪 Retiro en local',
        '',
        '*Productos:*',
        listaItems,
        '',
        `💰 Total: ${formatARS(total)}`,
        '',
        '⚠️ Esperando confirmación de transferencia',
      ].filter(Boolean).join('\n')

      const numeros = [
        { phone: '541127178564', apikey: process.env.WA_APIKEY_1 },
        { phone: '541164595509', apikey: process.env.WA_APIKEY_2 },
      ]
      for (const { phone, apikey } of numeros) {
        if (!apikey) continue
        try {
          await fetch(`https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodeURIComponent(msg)}&apikey=${apikey}`)
        } catch { /* ignorar */ }
      }

      return NextResponse.json({ pedido_id: pedido.id })
    }

    // 4. Armar items para MP — incluye envío como ítem si corresponde
    const mpItems: any[] = items.map((item: any) => ({
      id: String(item.id),
      title: item.nombre,
      quantity: item.cantidad,
      unit_price: precioFinal(item.precio_venta),
      currency_id: 'ARS',
    }))

    if (gastoEnvio > 0) {
      mpItems.push({
        id: 'envio',
        title: 'Envío OCA a domicilio',
        quantity: 1,
        unit_price: gastoEnvio,
        currency_id: 'ARS',
      })
    }

    // 4. Crear preference en MP
    const preference = new Preference(mp)
    const result = await preference.create({
      body: {
        external_reference: pedido.id,
        items: mpItems,
        payer: cliente?.email ? {
          name: cliente.nombre ?? undefined,
          email: cliente.email,
          phone: cliente.telefono ? { number: cliente.telefono } : undefined,
        } : undefined,
        back_urls: {
          success: `${back_url}/tienda/pago/exitoso`,
          failure: `${back_url}/tienda/pago/error`,
          pending: `${back_url}/tienda/pago/pendiente`,
        },
        auto_return: 'approved',
        statement_descriptor: 'ABUMA.MA',
        payment_methods: {
          excluded_payment_types: [
            { id: 'ticket' },
            { id: 'atm' },
          ],
        },
        notification_url: `${process.env.NEXT_PUBLIC_APP_URL ?? back_url}/api/mp-webhook`,
      },
    })

    return NextResponse.json({ init_point: result.init_point })
  } catch (error: any) {
    console.error('Checkout error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}