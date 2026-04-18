import { NextResponse } from 'next/server'

export async function GET() {
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

// Endpoint para obtener el chat_id automáticamente
export async function POST() {
  const token = process.env.TG_BOT_TOKEN
  if (!token) return NextResponse.json({ error: 'Falta TG_BOT_TOKEN en Vercel' }, { status: 500 })

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getUpdates`)
    const data = await res.json()
    const updates = data.result ?? []
    if (updates.length === 0) {
      return NextResponse.json({ error: 'No hay mensajes aún. Mandá /start al bot en Telegram primero.' })
    }
    const chatId = updates[updates.length - 1]?.message?.chat?.id
    return NextResponse.json({ chat_id: chatId, instruccion: `Agregá TG_CHAT_ID=${chatId} en Vercel` })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}