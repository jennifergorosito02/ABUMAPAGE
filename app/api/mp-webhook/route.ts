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
    if (!apikey) continue
    try {
      await fetch(
        `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodeURIComponent(mensaje)}&apikey=${apikey}`
      )
    } catch (e) {
      console.error(`Error notificando ${phone}:`, e)
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (body.type !== 'payment') return NextResponse.json({ ok: true })

    const paymentId = body.data?.id
    if (!paymentId) return NextResponse.json({ ok: true })

    // Verificar estado del pago con MP
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
    })

    if (!mpRes.ok) {
      console.error('MP payment fetch error:', mpRes.status)
      return NextResponse.json({ error: 'MP error' }, { status: 500 })
    }

    const payment = await mpRes.json()
    const pedidoId: string = payment.external_reference
    const estado: string = payment.status

    if (!pedidoId) {
      console.error('Webhook sin external_reference:', payment.id)
      return NextResponse.json({ ok: true })
    }

    const supabase = supabaseAdmin()

    if (estado === 'approved') {
      // Traer pedido completo con items y datos del cliente
      const { data: pedido } = await supabase
        .from('pedidos')
        .select('id, estado, cliente_nombre, cliente_telefono, total, metodo_pago, pedido_items(nombre, cantidad, precio_unitario)')
        .eq('id', pedidoId)
        .single()

      if (!pedido) {
        console.error('Pedido no encontrado:', pedidoId)
        return NextResponse.json({ ok: true })
      }

      if (pedido.estado === 'aprobado') return NextResponse.json({ ok: true })

      // Descontar stock
      const items: Array<{ nombre: string; cantidad: number; precio_unitario: number; producto_id?: number }> = pedido.pedido_items as any

      // Necesitamos producto_id para descontar — re-fetch con producto_id
      const { data: itemsConId } = await supabase
        .from('pedido_items')
        .select('producto_id, cantidad')
        .eq('pedido_id', pedidoId)

      for (const item of itemsConId ?? []) {
        const { error } = await supabase.rpc('descontar_stock_online', {
          p_producto_id: item.producto_id,
          p_cantidad: item.cantidad,
        })
        if (error) console.error(`Stock insuficiente producto ${item.producto_id}:`, error.message)
      }

      // Marcar como aprobado
      await supabase
        .from('pedidos')
        .update({ estado: 'aprobado', mp_payment_id: String(paymentId) })
        .eq('id', pedidoId)

      // Armar mensaje de WhatsApp
      const formatARS = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`
      const listaItems = items
        .map(i => `  • ${i.nombre} x${i.cantidad} — ${formatARS(i.precio_unitario * i.cantidad)}`)
        .join('\n')

      const mensaje = [
        '🛍️ *NUEVO PEDIDO ABUMA.MA*',
        '',
        `👤 Cliente: ${pedido.cliente_nombre ?? 'Sin nombre'}`,
        pedido.cliente_telefono ? `📱 WhatsApp: ${pedido.cliente_telefono}` : '',
        `💳 Pago: ${pedido.metodo_pago === 'tarjeta' ? 'Tarjeta' : 'Efectivo/Transferencia'}`,
        '',
        '*Productos:*',
        listaItems,
        '',
        `💰 *Total: ${formatARS(pedido.total)}*`,
      ].filter(Boolean).join('\n')

      await notificarWhatsApp(mensaje)

    } else if (estado === 'rejected' || estado === 'cancelled') {
      await supabase
        .from('pedidos')
        .update({ estado: 'cancelado', mp_payment_id: String(paymentId) })
        .eq('id', pedidoId)
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