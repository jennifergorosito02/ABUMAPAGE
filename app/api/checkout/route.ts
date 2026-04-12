import { NextRequest, NextResponse } from 'next/server'
import { MercadoPagoConfig, Preference } from 'mercadopago'
import { createClient } from '@supabase/supabase-js'

const mp = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN!,
})

// Cliente admin para insertar sin RLS (usamos service role)
function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: NextRequest) {
  try {
    const { items, metodo_pago, recargo, back_url, cliente } = await request.json()

    const supabase = supabaseAdmin()

    // Calcular totales
    const subtotal = items.reduce((s: number, i: any) => s + i.precio_venta * i.cantidad, 0)
    const total = metodo_pago === 'tarjeta'
      ? Math.round(subtotal * (1 + (recargo ?? 0) / 100))
      : subtotal

    // Precio unitario con recargo si corresponde
    const precioFinal = (precio: number) =>
      metodo_pago === 'tarjeta' ? Math.round(precio * (1 + (recargo ?? 0) / 100)) : precio

    // 1. Insertar pedido en Supabase
    const { data: pedido, error: pedidoError } = await supabase
      .from('pedidos')
      .insert({
        cliente_nombre: cliente?.nombre ?? null,
        cliente_email: cliente?.email ?? null,
        cliente_telefono: cliente?.telefono ?? null,
        metodo_pago,
        subtotal,
        total,
        recargo_pct: recargo ?? 0,
        estado: 'pendiente',
      })
      .select('id')
      .single()

    if (pedidoError || !pedido) {
      console.error('Error creando pedido:', pedidoError)
      return NextResponse.json({ error: 'Error al registrar el pedido' }, { status: 500 })
    }

    // 2. Insertar items del pedido
    const itemsDB = items.map((i: any) => ({
      pedido_id: pedido.id,
      producto_id: i.id,
      nombre: i.nombre,
      cantidad: i.cantidad,
      precio_unitario: precioFinal(i.precio_venta),
    }))

    await supabase.from('pedido_items').insert(itemsDB)

    // 3. Crear preference en MP con external_reference = pedido.id
    const preference = new Preference(mp)
    const result = await preference.create({
      body: {
        external_reference: pedido.id,
        items: items.map((item: any) => ({
          id: String(item.id),
          title: item.nombre,
          quantity: item.cantidad,
          unit_price: precioFinal(item.precio_venta),
          currency_id: 'ARS',
        })),
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
        notification_url: `${process.env.NEXT_PUBLIC_APP_URL ?? back_url}/api/mp-webhook`,
      },
    })

    return NextResponse.json({ init_point: result.init_point })
  } catch (error: any) {
    console.error('Checkout error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}