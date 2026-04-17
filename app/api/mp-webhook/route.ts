import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
    if (!apikey) { console.log(`Sin apikey para ${phone}, saltando`); continue }
    try {
      const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodeURIComponent(mensaje)}&apikey=${apikey}`
      const res = await fetch(url)
      const txt = await res.text()
      console.log(`CallMeBot ${phone}: status=${res.status} resp=${txt.slice(0, 100)}`)
    } catch (e) {
      console.error(`Error notificando ${phone}:`, e)
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // MP envía distintos tipos — solo procesar pagos
    if (body.type !== 'payment') return NextResponse.json({ ok: true })

    const paymentId = body.data?.id
    if (!paymentId) return NextResponse.json({ ok: true })

    // Consultar estado del pago en MP
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
    })

    if (!mpRes.ok) {
      console.error('MP payment fetch error:', mpRes.status, await mpRes.text())
      return NextResponse.json({ ok: true }) // Devolver 200 igual — no queremos que MP reintente
    }

    const payment = await mpRes.json()
    const pedidoId: string = payment.external_reference
    const estado: string = payment.status

    if (!pedidoId) {
      console.error('Webhook sin external_reference, payment_id:', payment.id)
      return NextResponse.json({ ok: true })
    }

    const supabase = supabaseAdmin()

    if (estado === 'approved') {
      // IDEMPOTENCIA ATÓMICA: el UPDATE solo se ejecuta si el estado NO es ya 'aprobado'.
      // Si el pedido ya fue procesado, .single() devuelve null y saltamos todo.
      const { data: pedidoAprobado, error: updateError } = await supabase
        .from('pedidos')
        .update({ estado: 'aprobado', mp_payment_id: String(paymentId) })
        .eq('id', pedidoId)
        .neq('estado', 'aprobado')
        .select('id, cliente_nombre, cliente_telefono, total, metodo_pago, tipo_envio, direccion_envio')
        .single()

      if (updateError || !pedidoAprobado) {
        // Ya estaba aprobado o no existe — no hay nada que hacer
        console.log(`Pedido ${pedidoId} ya procesado o no encontrado — ignorando webhook`)
        return NextResponse.json({ ok: true })
      }

      console.log(`Pedido ${pedidoId} aprobado — descontando stock y notificando`)

      // Obtener items para descontar stock y armar mensaje
      const { data: items } = await supabase
        .from('pedido_items')
        .select('producto_id, cantidad, nombre, precio_unitario')
        .eq('pedido_id', pedidoId)

      // Descontar stock de cada item
      for (const item of items ?? []) {
        const { error } = await supabase.rpc('descontar_stock_online', {
          p_producto_id: item.producto_id,
          p_cantidad: item.cantidad,
        })
        if (error) console.error(`Stock insuficiente producto ${item.producto_id}:`, error.message)
      }

      // Armar notificación de WhatsApp
      const formatARS = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`

      const listaItems = (items ?? [])
        .map(i => `  • ${i.nombre} x${i.cantidad} — ${formatARS(i.precio_unitario * i.cantidad)}`)
        .join('\n')

      const metodoPagoLabel =
        pedidoAprobado.metodo_pago === 'credito' ? 'Crédito (con recargo)' :
        pedidoAprobado.metodo_pago === 'debito' ? 'Débito' :
        pedidoAprobado.metodo_pago === 'qr' ? 'QR / Billetera' :
        pedidoAprobado.metodo_pago

      const envioLabel = pedidoAprobado.tipo_envio === 'domicilio'
        ? `🚚 Envío a domicilio: ${pedidoAprobado.direccion_envio ?? 'sin dirección'}`
        : '🏪 Retiro en local'

      const mensaje = [
        '🛍️ *NUEVO PEDIDO ABUMA.MA*',
        '',
        `👤 Cliente: ${pedidoAprobado.cliente_nombre ?? 'Sin nombre'}`,
        pedidoAprobado.cliente_telefono ? `📱 WhatsApp: ${pedidoAprobado.cliente_telefono}` : '',
        `💳 Pago: ${metodoPagoLabel}`,
        envioLabel,
        '',
        '*Productos:*',
        listaItems,
        '',
        `💰 *Total: ${formatARS(pedidoAprobado.total)}*`,
      ].filter(Boolean).join('\n')

      await notificarWhatsApp(mensaje)

    } else if (estado === 'rejected' || estado === 'cancelled') {
      // Solo cancelar si el pedido todavía está pendiente (no downgrear un aprobado)
      await supabase
        .from('pedidos')
        .update({ estado: 'cancelado', mp_payment_id: String(paymentId) })
        .eq('id', pedidoId)
        .eq('estado', 'pendiente')
    }

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ ok: true })
}