import { NextRequest, NextResponse } from 'next/server'

// Endpoint de diagnóstico — protegido con header x-admin-key
// Uso: GET /api/test-wsp con header  x-admin-key: {MP_WEBHOOK_SECRET}
export async function GET(request: NextRequest) {
  const secret = process.env.MP_WEBHOOK_SECRET
  const key = request.headers.get('x-admin-key')

  if (!secret || key !== secret) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const token = process.env.TG_BOT_TOKEN
  const chatId = process.env.TG_CHAT_ID

  if (!token) return NextResponse.json({ error: 'Falta TG_BOT_TOKEN en Vercel' }, { status: 500 })
  if (!chatId) return NextResponse.json({ error: 'Falta TG_CHAT_ID en Vercel' }, { status: 500 })

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: '✅ *Test ABUMA.MA* — Notificaciones Telegram funcionando correctamente',
        parse_mode: 'Markdown',
      }),
    })
    const data = await res.json()
    if (data.ok) return NextResponse.json({ ok: true, mensaje: 'Mensaje enviado — revisá Telegram' })
    return NextResponse.json({ ok: false, error: data }, { status: 500 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}