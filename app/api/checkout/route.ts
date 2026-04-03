import { NextRequest, NextResponse } from 'next/server'
import { MercadoPagoConfig, Preference } from 'mercadopago'

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN!,
})

export async function POST(request: NextRequest) {
  try {
    const { items, back_url } = await request.json()

    const preference = new Preference(client)

    const result = await preference.create({
      body: {
        items: items.map((item: any) => ({
          id: String(item.id),
          title: item.nombre,
          quantity: item.cantidad,
          unit_price: item.precio_venta,
          currency_id: 'ARS',
        })),
        back_urls: {
          success: `${back_url}/tienda/pago/exitoso`,
          failure: `${back_url}/tienda/pago/error`,
          pending: `${back_url}/tienda/pago/pendiente`,
        },
        auto_return: 'approved',
        statement_descriptor: 'ABUMA.MA',
      },
    })

    return NextResponse.json({ init_point: result.init_point })
  } catch (error: any) {
    console.error('MP Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}