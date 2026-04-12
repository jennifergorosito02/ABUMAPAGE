import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // MP envía distintos tipos de notificaciones — solo nos importa "payment"
    if (body.type !== 'payment') {
      return NextResponse.json({ ok: true })
    }

    const paymentId = body.data?.id
    if (!paymentId) return NextResponse.json({ ok: true })

    // Consultar el pago a la API de MP para verificar estado
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
    })

    if (!mpRes.ok) {
      console.error('MP payment fetch error:', mpRes.status)
      return NextResponse.json({ error: 'MP error' }, { status: 500 })
    }

    const payment = await mpRes.json()
    const pedidoId: string = payment.external_reference
    const estado: string = payment.status // 'approved' | 'pending' | 'rejected' | ...

    if (!pedidoId) {
      console.error('Webhook sin external_reference:', payment.id)
      return NextResponse.json({ ok: true })
    }

    const supabase = supabaseAdmin()

    // Solo procesar si el pago fue aprobado
    if (estado === 'approved') {
      // Verificar que no hayamos procesado ya este pedido
      const { data: pedido } = await supabase
        .from('pedidos')
        .select('id, estado, pedido_items(producto_id, cantidad)')
        .eq('id', pedidoId)
        .single()

      if (!pedido) {
        console.error('Pedido no encontrado:', pedidoId)
        return NextResponse.json({ ok: true })
      }

      if (pedido.estado === 'aprobado') {
        // Ya procesado (MP puede reenviar webhooks)
        return NextResponse.json({ ok: true })
      }

      // Descontar stock de cada producto (función atómica en DB)
      const items: Array<{ producto_id: number; cantidad: number }> = pedido.pedido_items as any
      for (const item of items) {
        const { error } = await supabase.rpc('descontar_stock_online', {
          p_producto_id: item.producto_id,
          p_cantidad: item.cantidad,
        })
        if (error) {
          console.error(`Stock insuficiente para producto ${item.producto_id}:`, error.message)
          // Registrar pero seguir — el admin verá el pedido y resolverá
        }
      }

      // Marcar pedido como aprobado
      await supabase
        .from('pedidos')
        .update({ estado: 'aprobado', mp_payment_id: String(paymentId) })
        .eq('id', pedidoId)

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

// MP también hace GET para verificar la URL
export async function GET() {
  return NextResponse.json({ ok: true })
}