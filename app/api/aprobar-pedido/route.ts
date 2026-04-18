import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function notificarTelegram(mensaje: string) {
  const token = process.env.TG_BOT_TOKEN
  const chatId = process.env.TG_CHAT_ID
  if (!token || !chatId) return
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: mensaje, parse_mode: 'Markdown' }),
    })
  } catch (e) {
    console.error('Telegram error:', e)
  }
}

export async function POST(request: NextRequest) {
  try {
    const { pedido_id } = await request.json()
    if (!pedido_id) return NextResponse.json({ error: 'pedido_id requerido' }, { status: 400 })

    const supabase = supabaseAdmin()

    // Aprobar pedido (solo si está pendiente)
    const { data: pedido, error } = await supabase
      .from('pedidos')
      .update({ estado: 'aprobado' })
      .eq('id', pedido_id)
      .eq('estado', 'pendiente')
      .select('id, cliente_nombre, cliente_telefono, total, metodo_pago, tipo_envio, direccion_envio')
      .single()

    if (error || !pedido) {
      return NextResponse.json({ error: 'No se pudo aprobar el pedido' }, { status: 400 })
    }

    // Obtener items
    const { data: items } = await supabase
      .from('pedido_items')
      .select('producto_id, cantidad, nombre, precio_unitario')
      .eq('pedido_id', pedido_id)

    // Descontar stock
    for (const item of items ?? []) {
      const { error: stockError } = await supabase.rpc('descontar_stock_online', {
        p_producto_id: item.producto_id,
        p_cantidad: item.cantidad,
      })
      if (stockError) console.error(`Stock error producto ${item.producto_id}:`, stockError.message)
    }

    // Notificación Telegram
    const formatARS = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`
    const listaItems = (items ?? [])
      .map(i => `  • ${i.nombre} x${i.cantidad} — ${formatARS(i.precio_unitario * i.cantidad)}`)
      .join('\n')

    const metodoPagoLabel =
      pedido.metodo_pago === 'credito' ? 'Crédito (con recargo)' :
      pedido.metodo_pago === 'debito'  ? 'Débito' :
      pedido.metodo_pago === 'qr'      ? 'QR / Mercado Pago' :
      (pedido.metodo_pago ?? 'Manual')

    const envioLabel = pedido.tipo_envio === 'domicilio'
      ? `🚚 Envío a domicilio: ${pedido.direccion_envio ?? 'sin dirección'}`
      : '🏪 Retiro en local'

    const mensaje = [
      '✅ *PAGO CONFIRMADO MANUALMENTE — ABUMA.MA*',
      '',
      `👤 Cliente: ${pedido.cliente_nombre ?? 'Sin nombre'}`,
      pedido.cliente_telefono ? `📱 WhatsApp: ${pedido.cliente_telefono}` : '',
      `💳 Pago: ${metodoPagoLabel}`,
      envioLabel,
      '',
      '*Productos:*',
      listaItems,
      '',
      `💰 *Total: ${formatARS(pedido.total)}*`,
    ].filter(Boolean).join('\n')

    await notificarTelegram(mensaje)

    return NextResponse.json({ ok: true })
  } catch (error: any) {
    console.error('Error aprobando pedido:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}