import { NextResponse } from 'next/server'

export async function GET() {
  const apikey = process.env.WA_APIKEY_1
  const phone = '541127178564'

  if (!apikey) {
    return NextResponse.json({ error: 'WA_APIKEY_1 no está configurada en Vercel' }, { status: 500 })
  }

  const mensaje = '✅ Test ABUMA.MA — WhatsApp funcionando correctamente'

  try {
    const url = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodeURIComponent(mensaje)}&apikey=${apikey}`
    const res = await fetch(url)
    const text = await res.text()
    return NextResponse.json({ ok: res.ok, status: res.status, respuesta: text, apikey_length: apikey.length })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}