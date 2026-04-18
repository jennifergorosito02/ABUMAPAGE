import { NextRequest, NextResponse } from 'next/server'
import { MercadoPagoConfig, Preference } from 'mercadopago'
import { createClient } from '@supabase/supabase-js'

const mp = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN!,
})

function supabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function POST(request: NextRequest) {
  try {
    const { items: itemsInput, metodo_pago, recargo, back_url, cliente, tipo_envio, direccion_envio, sin_mp } = await request.json()

    if (!Array.isArray(itemsInput) || itemsInput.length === 0) {
      return NextResponse.json({ error: 'Carrito vacío' }, { status: 400 })
    }

    const supabase = supabaseAdmin()

    // ─────────────────────────────────────────────────────────────
    // FIX SEGURIDAD: Ignorar precios del frontend.
    // Consultar precios y nombres reales desde Supabase.
    // ─────────────────────────────────────────────────────────────
    const idsProductos = itemsInput.map((i: any) => Number(i.id)).filter(Boolean)

    const { data: productosDB, error: prodError } = await supabase
      .from('productos')
      .select('id, nombre, precio_venta, activo')
      .in('id', idsProductos)

    if (prodError || !productosDB || productosDB.length === 0) {
      console.error('Error consultando productos:', prodError)
      return NextResponse.json({ error: 'Error al verificar productos' }, { status: 400 })
    }

    // Mapear id → producto DB
    const productosMap = new Map(productosDB.map(p => [p.id, p]))

    // Armar items verificados con precios de DB
    const items = itemsInput
      .map((i: any) => {
        const p = productosMap.get(Number(i.id))
        if (!p || !p.activo) return null
        return {
          id: p.id,
          nombre: p.nombre,
          precio_venta: Number(p.precio_venta), // ← precio real de DB
          cantidad: Math.max(1, Math.round(Number(i.cantidad))),
        }
      })
      .filter(Boolean) as { id: number; nombre: string; precio_venta: number; cantidad: number }[]

    if (items.length === 0) {
      return NextResponse.json({ error: 'Ningún producto válido en el carrito' }, { status: 400 })
    }

    // Obtener costo de envío real desde configuracion (no confiar en frontend)
    const { data: config } = await supabase
      .from('configuracion')
      .select('costo_envio')
      .eq('id', 1)
      .single()

    const costoEnvioReal = Number(config?.costo_envio ?? 0)

    // ─────────────────────────────────────────────────────────────
    // Calcular totales con precios verificados
    // ─────────────────────────────────────────────────────────────
    const precioFinal = (precio: number) =>
      metodo_pago === 'credito' ? Math.round(precio * (1 + (recargo ?? 0) / 100)) : precio

    const subtotalProductos = items.reduce((s, i) => s + i.precio_venta * i.cantidad, 0)
    const subtotalConRecargo = metodo_pago === 'credito'
      ? Math.round(subtotalProductos * (1 + (recargo ?? 0) / 100))
      : subtotalProductos
    const gastoEnvio = tipo_envio === 'domicilio' ? costoEnvioReal : 0
    const total = subtotalConRecargo + gastoEnvio

    // 1. Insertar pedido en Supabase
    const { data: pedido, error: pedidoError } = await supabase
      .from('pedidos')
      .insert({
        cliente_nombre: cliente?.nombre ?? null,
        cliente_email: cliente?.email ?? null,
        cliente_telefono: cliente?.telefono ?? null,
        metodo_pago,
        subtotal: subtotalProductos,
        total,
        recargo_pct: metodo_pago === 'credito' ? (recargo ?? 0) : 0,
        tipo_envio: tipo_envio ?? 'retiro',
        direccion_envio: direccion_envio ?? null,
        estado: 'pendiente',
      })
      .select('id')
      .single()

    if (pedidoError || !pedido) {
      console.error('Error creando pedido:', pedidoError)
      return NextResponse.json({ error: 'Error al registrar el pedido' }, { status: 500 })
    }

    // 2. Insertar items del pedido (con precios verificados de DB)
    await supabase.from('pedido_items').insert(
      items.map(i => ({
        pedido_id: pedido.id,
        producto_id: i.id,
        nombre: i.nombre,
        cantidad: i.cantidad,
        precio_unitario: precioFinal(i.precio_venta),
      }))
    )

    // 3. Si es pago por transferencia (sin MP), notificar y devolver pedido_id
    if (sin_mp) {
      const formatARS = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`
      const listaItems = items.map(i => `  • ${i.nombre} x${i.cantidad}`).join('\n')
      const msg = [
        '🔔 *NUEVO PEDIDO — PENDIENTE PAGO*',
        '',
        `👤 ${cliente?.nombre ?? 'Sin nombre'}`,
        cliente?.telefono ? `📱 ${cliente.telefono}` : '',
        `💳 Pago: Débito / Transferencia`,
        '🏪 Retiro en local',
        '',
        '*Productos:*',
        listaItems,
        '',
        `💰 Total: ${formatARS(total)}`,
        '',
        '⚠️ Esperando confirmación de transferencia',
      ].filter(Boolean).join('\n')

      const token = process.env.TG_BOT_TOKEN
      const chatId = process.env.TG_CHAT_ID
      if (token && chatId) {
        try {
          await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text: msg, parse_mode: 'Markdown' }),
          })
        } catch { /* ignorar */ }
      }

      return NextResponse.json({ pedido_id: pedido.id })
    }

    // 4. Armar items para MP — incluye envío como ítem si corresponde
    const mpItems: any[] = items.map(item => ({
      id: String(item.id),
      title: item.nombre,
      quantity: item.cantidad,
      unit_price: precioFinal(item.precio_venta),
      currency_id: 'ARS',
    }))

    if (gastoEnvio > 0) {
      mpItems.push({
        id: 'envio',
        title: 'Envío OCA a domicilio',
        quantity: 1,
        unit_price: gastoEnvio,
        currency_id: 'ARS',
      })
    }

    // 5. Crear preference en MP
    const preference = new Preference(mp)
    const result = await preference.create({
      body: {
        external_reference: pedido.id,
        items: mpItems,
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
        payment_methods: {
          excluded_payment_types: [
            { id: 'ticket' },
            { id: 'atm' },
            ...(metodo_pago === 'debito' ? [{ id: 'credit_card' }] : []),
            ...(metodo_pago === 'credito' ? [{ id: 'debit_card' }] : []),
          ],
        },
        notification_url: `${process.env.NEXT_PUBLIC_APP_URL ?? back_url}/api/mp-webhook`,
      },
    })

    return NextResponse.json({ init_point: result.init_point })
  } catch (error: any) {
    console.error('Checkout error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}