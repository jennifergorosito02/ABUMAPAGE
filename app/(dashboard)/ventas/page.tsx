'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Producto, SesionCaja } from '@/types'
import {
  Search, Plus, Minus, Trash2, ShoppingCart, X,
  CreditCard, Banknote, Smartphone, CheckCircle2,
} from 'lucide-react'

function formatARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

interface CartItem {
  producto: Producto
  cantidad: number
}

type MetodoPago = 'efectivo' | 'transferencia' | 'tarjeta' | 'mixto'

const METODOS: { value: MetodoPago; label: string; icon: React.ElementType }[] = [
  { value: 'efectivo',      label: 'Efectivo',      icon: Banknote },
  { value: 'transferencia', label: 'Transferencia',  icon: Smartphone },
  { value: 'tarjeta',       label: 'Tarjeta',        icon: CreditCard },
  { value: 'mixto',         label: 'Mixto',          icon: ShoppingCart },
]

export default function VentasPage() {
  const supabase = createClient()

  const [productos, setProductos] = useState<Producto[]>([])
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [metodo, setMetodo] = useState<MetodoPago>('efectivo')
  const [descuento, setDescuento] = useState(0)
  const [clienteNombre, setClienteNombre] = useState('')
  const [clienteCuit, setClienteCuit] = useState('')
  const [facturar, setFacturar] = useState(false)
  const [sesionActiva, setSesionActiva] = useState<SesionCaja | null>(null)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState<{ numero: string; total: number } | null>(null)
  const [recargo, setRecargo] = useState(20)
  const searchRef = useRef<HTMLInputElement>(null)

  const fetchProductos = useCallback(async () => {
    const { data } = await supabase
      .from('productos')
      .select('*')
      .eq('activo', true)
      .gt('stock', 0)
      .order('linea').order('nombre')
    setProductos(data ?? [])
  }, [])

  const fetchSesion = useCallback(async () => {
    const { data } = await supabase
      .from('sesiones_caja')
      .select('*')
      .eq('estado', 'abierta')
      .order('apertura', { ascending: false })
      .limit(1)
      .single()
    setSesionActiva(data ?? null)
  }, [])

  useEffect(() => {
    fetchProductos()
    fetchSesion()
    supabase.from('configuracion').select('recargo_tarjeta').eq('id', 1).single()
      .then(({ data }) => { if (data?.recargo_tarjeta != null) setRecargo(Number(data.recargo_tarjeta)) })
  }, [fetchProductos, fetchSesion])

  const filtrados = search
    ? productos.filter(p =>
        p.nombre.toLowerCase().includes(search.toLowerCase()) ||
        (p.sku_display?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
        (p.fragancia?.toLowerCase().includes(search.toLowerCase()) ?? false)
      )
    : productos.slice(0, 60)

  function addToCart(p: Producto) {
    setCart(prev => {
      const existing = prev.find(i => i.producto.id === p.id)
      if (existing) {
        if (existing.cantidad >= p.stock) return prev
        return prev.map(i => i.producto.id === p.id ? { ...i, cantidad: i.cantidad + 1 } : i)
      }
      return [...prev, { producto: p, cantidad: 1 }]
    })
    setSearch('')
    searchRef.current?.focus()
  }

  function updateQty(id: number, delta: number) {
    setCart(prev =>
      prev.map(i => i.producto.id === id
        ? { ...i, cantidad: Math.max(1, Math.min(i.producto.stock, i.cantidad + delta)) }
        : i
      ).filter(i => i.cantidad > 0)
    )
  }

  function removeFromCart(id: number) {
    setCart(prev => prev.filter(i => i.producto.id !== id))
  }

  const pctRecargo = recargo > 0 ? recargo : 20
  const subtotal = cart.reduce((s, i) => s + i.producto.precio_venta * i.cantidad, 0)
  const descuentoMonto = Math.round(subtotal * descuento / 100)
  const recargoMonto = metodo === 'tarjeta' ? Math.round((subtotal - descuentoMonto) * pctRecargo / 100) : 0
  const total = subtotal - descuentoMonto + recargoMonto

  function precioItem(precio: number, cantidad: number) {
    const base = metodo === 'tarjeta' ? Math.round(precio * (1 + pctRecargo / 100)) : precio
    return base * cantidad
  }

  async function confirmarVenta() {
    if (cart.length === 0) return
    if (!sesionActiva) {
      alert('No hay una sesión de caja abierta. Abrí la caja primero.')
      return
    }
    setSaving(true)

    // Generar número interno
    const fecha = new Date()
    const numero = `V${fecha.getFullYear()}${String(fecha.getMonth()+1).padStart(2,'0')}${String(fecha.getDate()).padStart(2,'0')}-${String(fecha.getTime()).slice(-5)}`

    const { data: venta, error: ventaError } = await supabase
      .from('ventas')
      .insert({
        numero_interno: numero,
        sesion_caja_id: sesionActiva.id,
        cliente_nombre: clienteNombre || null,
        cliente_cuit: clienteCuit || null,
        tipo_comprobante: facturar ? 'factura_b' : 'ticket',
        subtotal,
        descuento: descuentoMonto,
        total,
        metodo_pago: metodo,
        recargo_tarjeta: recargoMonto > 0 ? recargoMonto : null,
        estado: 'completada',
      })
      .select()
      .single()

    if (ventaError || !venta) {
      alert('Error al registrar la venta')
      setSaving(false)
      return
    }

    // Items + actualizar stock
    const items = cart.map(i => ({
      venta_id: venta.id,
      producto_id: i.producto.id,
      cantidad: i.cantidad,
      precio_unitario: i.producto.precio_venta,
      subtotal: i.producto.precio_venta * i.cantidad,
    }))

    await supabase.from('venta_items').insert(items)

    // Descontar stock y registrar movimientos
    for (const item of cart) {
      const nuevoStock = item.producto.stock - item.cantidad
      await supabase.from('productos').update({ stock: nuevoStock }).eq('id', item.producto.id)
      await supabase.from('movimientos_stock').insert({
        producto_id: item.producto.id,
        tipo: 'venta',
        cantidad: item.cantidad,
        stock_anterior: item.producto.stock,
        stock_nuevo: nuevoStock,
        motivo: `Venta ${numero}`,
        referencia_id: venta.id,
      })
    }

    // Actualizar totales de caja
    const campo = metodo === 'efectivo' ? 'total_efectivo'
      : metodo === 'transferencia' ? 'total_transferencia'
      : metodo === 'tarjeta' ? 'total_tarjeta' : 'total_ventas'

    const { error: rpcError } = await supabase.rpc('incrementar_caja', {
      p_sesion_id: sesionActiva.id,
      p_total: total,
      p_campo: campo,
    })
    if (rpcError) {
      await supabase.from('sesiones_caja')
        .update({ total_ventas: sesionActiva.total_ventas + total })
        .eq('id', sesionActiva.id)
    }

    setSaving(false)
    setSuccess({ numero, total })
    setCart([])
    setSearch('')
    setDescuento(0)
    setClienteNombre('')
    setClienteCuit('')
    setFacturar(false)
    fetchProductos()
    fetchSesion()
  }

  if (success) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', minHeight: '60vh', gap: '20px', textAlign: 'center',
      }} className="fade-in">
        <div style={{
          width: '72px', height: '72px',
          background: 'rgba(56,161,105,0.1)', borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <CheckCircle2 size={36} style={{ color: 'var(--success)' }} />
        </div>
        <div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text)' }}>¡Venta registrada!</div>
          <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '6px' }}>
            {success.numero} · Total: <strong style={{ color: 'var(--gold)' }}>{formatARS(success.total)}</strong>
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setSuccess(null)} style={{ padding: '10px 24px' }}>
          Nueva venta
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px', height: 'calc(100vh - 104px)' }}
         className="fade-in pos-grid">

      {/* Panel izquierdo: productos */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflow: 'hidden' }}>

        {/* Aviso sin caja */}
        {!sesionActiva && (
          <div style={{
            background: 'var(--warning-bg)', border: '1px solid #3a2a00',
            borderRadius: '8px', padding: '10px 14px',
            fontSize: '13px', color: 'var(--warning)',
          }}>
            ⚠ No hay caja abierta. Abrí la caja antes de registrar ventas.
          </div>
        )}

        {/* Búsqueda */}
        <div style={{ position: 'relative' }}>
          <Search size={15} style={{
            position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-muted)',
          }} />
          <input
            ref={searchRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar producto por nombre, SKU o fragancia..."
            style={{ paddingLeft: '36px', fontSize: '15px', height: '44px' }}
            autoFocus
          />
        </div>

        {/* Grid de productos */}
        <div style={{
          flex: 1, overflowY: 'auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
          gap: '8px',
          alignContent: 'start',
        }}>
          {filtrados.length === 0 && (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
              {search ? 'Sin resultados' : 'No hay productos con stock'}
            </div>
          )}
          {filtrados.map(p => {
            const inCart = cart.find(i => i.producto.id === p.id)
            return (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                disabled={p.stock === 0}
                style={{
                  background: inCart ? 'rgba(201,162,39,0.08)' : 'var(--bg-card)',
                  border: `1px solid ${inCart ? 'var(--gold-dim)' : 'var(--border)'}`,
                  borderRadius: '8px',
                  padding: '12px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                }}
              >
                <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text)', lineHeight: 1.3 }}>
                  {p.nombre}
                </div>
                {p.fragancia && (
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{p.fragancia}</div>
                )}
                <div style={{ marginTop: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--gold)' }}>{formatARS(p.precio_venta)}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>×{p.stock}</span>
                </div>
                {inCart && (
                  <div style={{ fontSize: '11px', color: 'var(--gold)', fontWeight: 500 }}>
                    En carrito: {inCart.cantidad}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Panel derecho: carrito */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border)',
        borderRadius: '10px',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShoppingCart size={16} style={{ color: 'var(--gold)' }} />
          <span style={{ fontWeight: 600 }}>Carrito</span>
          {cart.length > 0 && (
            <span style={{
              marginLeft: 'auto', background: 'var(--gold)', color: '#000',
              borderRadius: '10px', padding: '1px 7px', fontSize: '12px', fontWeight: 700,
            }}>{cart.reduce((s, i) => s + i.cantidad, 0)}</span>
          )}
        </div>

        {/* Items del carrito */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {cart.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: '13px' }}>
              Buscá y tocá un producto para agregarlo
            </div>
          ) : cart.map(item => (
            <div key={item.producto.id} style={{
              padding: '10px 8px',
              borderBottom: '1px solid var(--border)',
              display: 'flex', flexDirection: 'column', gap: '6px',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '13px', color: 'var(--text)', lineHeight: 1.3 }}>
                    {item.producto.nombre}
                  </span>
                  {item.producto.fragancia && (
                    <div style={{ fontSize: '11px', color: 'var(--gold)', opacity: 0.7, marginTop: '2px' }}>
                      {item.producto.fragancia}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => removeFromCart(item.producto.id)}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0', flexShrink: 0 }}
                >
                  <X size={13} />
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    onClick={() => updateQty(item.producto.id, -1)}
                    style={{
                      width: '26px', height: '26px', borderRadius: '5px',
                      background: 'var(--border)', border: 'none', cursor: 'pointer',
                      color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  ><Minus size={12} /></button>
                  <span style={{ fontSize: '14px', fontWeight: 600, minWidth: '20px', textAlign: 'center' }}>
                    {item.cantidad}
                  </span>
                  <button
                    onClick={() => updateQty(item.producto.id, 1)}
                    disabled={item.cantidad >= item.producto.stock}
                    style={{
                      width: '26px', height: '26px', borderRadius: '5px',
                      background: 'var(--border)', border: 'none',
                      cursor: item.cantidad >= item.producto.stock ? 'not-allowed' : 'pointer',
                      color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      opacity: item.cantidad >= item.producto.stock ? 0.4 : 1,
                    }}
                  ><Plus size={12} /></button>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--gold)' }}>
                    {formatARS(Math.round(item.producto.precio_venta * (metodo === 'tarjeta' ? 1 + pctRecargo / 100 : 1)) * item.cantidad)}
                  </div>
                  {metodo === 'tarjeta' && (
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      Ef: {formatARS(item.producto.precio_venta * item.cantidad)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Totales y pago */}
        <div style={{ borderTop: '1px solid var(--border)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* Descuento */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Descuento %</span>
            <input
              type="number" min="0" max="100" value={descuento || ''}
              onChange={e => setDescuento(Number(e.target.value))}
              placeholder="0"
              style={{ width: '80px', textAlign: 'right', padding: '6px 10px' }}
            />
          </div>

          {/* Subtotal / Total */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            {(descuento > 0 || recargoMonto > 0) && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-muted)' }}>
                <span>Subtotal</span><span>{formatARS(subtotal)}</span>
              </div>
            )}
            {descuento > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--danger)' }}>
                <span>Descuento {descuento}%</span><span>-{formatARS(descuentoMonto)}</span>
              </div>
            )}
            {recargoMonto > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--warning)' }}>
                <span>Recargo tarjeta {pctRecargo}%</span><span>+{formatARS(recargoMonto)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 700 }}>
              <span>Total</span>
              <span style={{ color: 'var(--gold)' }}>{formatARS(total)}</span>
            </div>
          </div>

          {/* Método de pago */}
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>Método de pago</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              {METODOS.map(m => {
                const Icon = m.icon
                return (
                  <button
                    key={m.value}
                    onClick={() => setMetodo(m.value)}
                    style={{
                      padding: '7px 8px',
                      border: `1px solid ${metodo === m.value ? 'var(--gold)' : 'var(--border)'}`,
                      borderRadius: '6px',
                      background: metodo === m.value ? 'rgba(201,162,39,0.08)' : 'transparent',
                      color: metodo === m.value ? 'var(--gold)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: '5px',
                      fontSize: '12px', fontWeight: 500,
                      transition: 'all 0.15s',
                    }}
                  >
                    <Icon size={13} /> {m.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Cliente (opcional) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <input
              value={clienteNombre}
              onChange={e => setClienteNombre(e.target.value)}
              placeholder="Nombre del cliente (opcional)"
              style={{ fontSize: '13px' }}
            />
            {/* Facturar AFIP */}
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-secondary)' }}>
              <input
                type="checkbox"
                checked={facturar}
                onChange={e => setFacturar(e.target.checked)}
                style={{ width: 'auto', accentColor: 'var(--gold)' }}
              />
              Generar factura AFIP
            </label>
            {facturar && (
              <input
                value={clienteCuit}
                onChange={e => setClienteCuit(e.target.value)}
                placeholder="CUIT del cliente"
                style={{ fontSize: '13px' }}
              />
            )}
          </div>

          {/* Botón confirmar */}
          <button
            onClick={confirmarVenta}
            disabled={cart.length === 0 || saving}
            className="btn btn-primary"
            style={{
              width: '100%', justifyContent: 'center',
              padding: '13px', fontSize: '15px', fontWeight: 700,
              opacity: cart.length === 0 || saving ? 0.5 : 1,
            }}
          >
            {saving ? 'Registrando...' : `Confirmar venta · ${formatARS(total)}`}
          </button>
        </div>
      </div>

      <style>{`
        @media (max-width: 900px) {
          .pos-grid {
            grid-template-columns: 1fr !important;
            height: auto !important;
          }
        }
      `}</style>
    </div>
  )
}
