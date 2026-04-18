import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function notificarTelegram(mensaje: string) {
  const token = process.env.TG_BOT_TOKEN
  const chatId = process.env.TG_CHAT_ID
  if (!token || !chatId) {
    console.log('Telegram no configurado: falta TG_BOT_TOKEN o TG_CHAT_ID')
    return
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: mensaje, parse_mode: 'Markdown' }),
    })
    const data = await res.json()
    if (!data.ok) console.error('Telegram error:', JSON.stringify(data))
    else console.log('Telegram enviado OK')
  } catch (e) {
    console.error('Error enviando Telegram:', e)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FIX SEGURIDAD: Validar firma HMAC-SHA256 del webhook de MercadoPago.
// Docs: https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks
//
// El header x-signature tiene formato: ts=<timestamp>,v1=<hash>
// El manifest a firmar es: id:<data.id>;request-id:<x-request-id>;ts:<timestamp>;
// ─────────────────────────────────────────────────────────────────────────────
function validarFirmaMP(request: NextRequest, dataId: string | number): boolean {
  const secret = process.env.MP_WEBHOOK_SECRET
  if (!secret) {
    // Sin secret configurado: aceptar pero advertir (modo permisivo para rollout)
    console.warn('MP_WEBHOOK_SECRET no configurada — validación de firma omitida')
    return true
  }

  const xSignature = request.headers.get('x-signature')
  const xRequestId = request.headers.get('x-request-id') ?? ''

  if (!xSignature) {
    console.error('Webhook sin x-signature — rechazado')
    return false
  }

  // Parsear ts y v1 del header
  let ts = '', v1 = ''
  for (const part of xSignature.split(',')) {
    const [key, value] = part.trim().split('=')
    if (key === 'ts') ts = value
    if (key === 'v1') v1 = value
  }

  if (!ts || !v1) {
    console.error('x-signature malformado:', xSignature)
    return false
  }

  // Construir el manifest y calcular HMAC
  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`
  const hash = crypto.createHmac('sha256', secret).update(manifest).digest('hex')

  if (hash !== v1) {
    console.error('Firma HMAC inválida — webhook rechazado')
    return false
  }

  return true
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // MP envía distintos tipos — solo procesar pagos
    if (body.type !== 'payment') return NextResponse.json({ ok: true })

    const paymentId = body.data?.id
    if (!paymentId) return NextResponse.json({ ok: true })

    // ─────────────────────────────────────────────────────────────
    // Validar firma antes de procesar cualquier cosa
    // ─────────────────────────────────────────────────────────────
    if (!validarFirmaMP(request, paymentId)) {
      // Devolvemos 200 para que MP no reintente (evitar spam de alertas)
      return NextResponse.json({ ok: false, error: 'firma_invalida' })
    }

    // Consultar estado del pago en MP (fuente de verdad)
    const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
    })

    if (!mpRes.ok) {
      console.error('MP payment fetch error:', mpRes.status, await mpRes.text())
      return NextResponse.json({ ok: true })
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
      // IDEMPOTENCIA ATÓMICA: solo actualiza si el pedido NO está ya aprobado
      const { data: pedidoAprobado, error: updateError } = await supabase
        .from('pedidos')
        .update({ estado: 'aprobado', mp_payment_id: String(paymentId) })
        .eq('id', pedidoId)
        .neq('estado', 'aprobado')
        .select('id, cliente_nombre, cliente_telefono, total, metodo_pago, tipo_envio, direccion_envio')
        .single()

      if (updateError || !pedidoAprobado) {
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

      // Armar notificación Telegram
      const formatARS = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`

      const listaItems = (items ?? [])
        .map(i => `  • ${i.nombre} x${i.cantidad} — ${formatARS(i.precio_unitario * i.cantidad)}`)
        .join('\n')

      const metodoPagoLabel =
        pedidoAprobado.metodo_pago === 'credito' ? 'Crédito (con recargo)' :
        pedidoAprobado.metodo_pago === 'debito'  ? 'Débito' :
        pedidoAprobado.metodo_pago === 'qr'      ? 'QR / Mercado Pago' :
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

      await notificarTelegram(mensaje)

    } else if (estado === 'rejected' || estado === 'cancelled') {
      // Solo cancelar si el pedido todavía está pendiente
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