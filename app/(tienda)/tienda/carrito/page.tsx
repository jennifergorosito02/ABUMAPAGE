'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface ItemCarrito {
  id: number
  nombre: string
  precio_venta: number
  cantidad: number
  stock: number
  imagen_url: string | null
  familia: string | null
}

interface Cliente {
  nombre: string
  email: string
  telefono: string
}

function formatARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

function getCarrito(): Record<number, number> {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem('carrito') ?? '{}') } catch { return {} }
}
function saveCarrito(c: Record<number, number>) {
  localStorage.setItem('carrito', JSON.stringify(c))
  window.dispatchEvent(new Event('carritoUpdate'))
}

export default function CarritoPage() {
  const supabase = createClient()
  const [items, setItems] = useState<ItemCarrito[]>([])
  const [loading, setLoading] = useState(true)
  const [procesando, setProcesando] = useState(false)
  const [errorPago, setErrorPago] = useState('')
  const [metodoPago, setMetodoPago] = useState<'efectivo' | 'tarjeta'>('efectivo')
  const [recargo, setRecargo] = useState(20)
  const [cliente, setCliente] = useState<Cliente>({ nombre: '', email: '', telefono: '' })

  async function fetchItems() {
    const carrito = getCarrito()
    const ids = Object.keys(carrito).map(Number)
    if (ids.length === 0) { setItems([]); setLoading(false); return }

    const { data } = await supabase
      .from('productos')
      .select('id, nombre, precio_venta, stock, imagen_url, familia')
      .in('id', ids)
      .eq('activo', true)

    setItems((data ?? []).map((p: any) => ({
      ...p,
      cantidad: carrito[p.id] ?? 1,
    })))
    setLoading(false)
  }

  useEffect(() => {
    async function init() {
      await fetchItems()
      const result = await supabase.from('configuracion').select('recargo_tarjeta').eq('id', 1).single()
      if (result.data?.recargo_tarjeta != null) setRecargo(Number(result.data.recargo_tarjeta))
    }
    init()
  }, [])

  async function handleCheckout() {
    if (!cliente.nombre.trim()) { setErrorPago('Ingresá tu nombre para continuar'); return }
    setProcesando(true)
    setErrorPago('')
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          metodo_pago: metodoPago,
          recargo: metodoPago === 'tarjeta' ? recargo : 0,
          back_url: window.location.origin,
          cliente,
        }),
      })
      const data = await res.json()
      if (data.error) { setErrorPago(data.error); setProcesando(false); return }
      window.location.href = data.init_point
    } catch {
      setErrorPago('Error al conectar con Mercado Pago')
      setProcesando(false)
    }
  }

  function updateCantidad(id: number, delta: number) {
    const c = getCarrito()
    const item = items.find(i => i.id === id)
    if (!item) return
    const nueva = Math.max(1, Math.min(item.stock, (c[id] ?? 1) + delta))
    c[id] = nueva
    saveCarrito(c)
    setItems(prev => prev.map(i => i.id === id ? { ...i, cantidad: nueva } : i))
  }

  function eliminar(id: number) {
    const c = getCarrito()
    delete c[id]
    saveCarrito(c)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const subtotal = items.reduce((s, i) => s + i.precio_venta * i.cantidad, 0)
  const montoRecargo = metodoPago === 'tarjeta' ? Math.round(subtotal * recargo / 100) : 0
  const total = subtotal + montoRecargo

  function precioConRecargo(precio: number) {
    return metodoPago === 'tarjeta' ? Math.round(precio * (1 + recargo / 100)) : precio
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '80px', color: 'var(--text-muted)' }}>Cargando...</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      <h1 style={{ fontFamily: 'var(--font-cormorant, serif)', fontSize: '36px', fontWeight: 500, color: 'var(--gold)' }}>
        Tu Carrito
      </h1>

      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <p style={{ color: 'var(--text-muted)', marginBottom: '20px', fontSize: '16px' }}>Tu carrito está vacío</p>
          <Link href="/tienda" style={{
            display: 'inline-block', padding: '12px 28px', borderRadius: '8px',
            background: 'var(--gold)', color: '#000', fontWeight: 600, textDecoration: 'none',
          }}>
            Ver productos
          </Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '24px' }} className="carrito-grid">

          {/* Items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {items.map(item => (
              <div key={item.id} className="card" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div style={{ width: '64px', height: '64px', flexShrink: 0, borderRadius: '8px', overflow: 'hidden', background: 'var(--bg-card-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {item.imagen_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={item.imagen_url} alt={item.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--gold-dim)" strokeWidth="1.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                  }
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text)' }}>{item.nombre}</div>
                  <div style={{ color: 'var(--gold)', fontWeight: 700, marginTop: '4px' }}>
                    {formatARS(precioConRecargo(item.precio_venta))}
                  </div>
                  {metodoPago === 'tarjeta' && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Efectivo: {formatARS(item.precio_venta)}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border)', borderRadius: '7px', overflow: 'hidden' }}>
                  <button onClick={() => updateCantidad(item.id, -1)} style={{ padding: '6px 12px', background: 'transparent', color: 'var(--text)', border: 'none', cursor: 'pointer' }}>−</button>
                  <span style={{ padding: '6px 10px', fontSize: '14px', fontWeight: 600 }}>{item.cantidad}</span>
                  <button onClick={() => updateCantidad(item.id, 1)} style={{ padding: '6px 12px', background: 'transparent', color: 'var(--text)', border: 'none', cursor: 'pointer' }}>+</button>
                </div>

                <div style={{ minWidth: '90px', textAlign: 'right', fontWeight: 700, fontSize: '15px' }}>
                  {formatARS(precioConRecargo(item.precio_venta) * item.cantidad)}
                </div>

                <button onClick={() => eliminar(item.id)} style={{
                  background: 'transparent', border: 'none', color: 'var(--text-muted)',
                  cursor: 'pointer', padding: '4px', fontSize: '18px', lineHeight: 1,
                }}>×</button>
              </div>
            ))}

            <Link href="/tienda" style={{ color: 'var(--gold)', fontSize: '14px', textDecoration: 'none', marginTop: '8px' }}>
              ← Seguir comprando
            </Link>
          </div>

          {/* Panel derecho */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Resumen */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h2 style={{ fontFamily: 'var(--font-cormorant, serif)', fontSize: '22px', fontWeight: 500 }}>Resumen</h2>

              {/* Método de pago */}
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>¿Cómo vas a pagar?</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button onClick={() => setMetodoPago('efectivo')} style={{
                    padding: '10px 8px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                    border: `1px solid ${metodoPago === 'efectivo' ? 'var(--gold)' : 'var(--border)'}`,
                    background: metodoPago === 'efectivo' ? 'rgba(200,169,110,0.12)' : 'transparent',
                    color: metodoPago === 'efectivo' ? 'var(--gold)' : 'var(--text-secondary)',
                    cursor: 'pointer', transition: 'all 0.15s', textAlign: 'center',
                  }}>
                    💵 Efectivo / Débito<br />
                    <span style={{ fontSize: '10px', fontWeight: 400, opacity: 0.7 }}>o Transferencia</span>
                  </button>
                  <button onClick={() => setMetodoPago('tarjeta')} style={{
                    padding: '10px 8px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                    border: `1px solid ${metodoPago === 'tarjeta' ? '#7c6fcd' : 'var(--border)'}`,
                    background: metodoPago === 'tarjeta' ? 'rgba(124,111,205,0.12)' : 'transparent',
                    color: metodoPago === 'tarjeta' ? '#a89fdf' : 'var(--text-secondary)',
                    cursor: 'pointer', transition: 'all 0.15s', textAlign: 'center',
                  }}>
                    💳 Crédito
                  </button>
                </div>
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid var(--border)' }} />

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {items.map(i => (
                  <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    <span>{i.nombre} x{i.cantidad}</span>
                    <span>{formatARS(precioConRecargo(i.precio_venta) * i.cantidad)}</span>
                  </div>
                ))}
              </div>

              {metodoPago === 'tarjeta' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'rgba(168,159,223,0.7)' }}>
                  <span>Recargo tarjeta ({recargo}%)</span>
                  <span>+ {formatARS(montoRecargo)}</span>
                </div>
              )}

              <hr style={{ border: 'none', borderTop: '1px solid var(--border)' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 700 }}>
                <span>Total</span>
                <span style={{ color: 'var(--gold)' }}>{formatARS(total)}</span>
              </div>
            </div>

            {/* Datos del cliente */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h2 style={{ fontFamily: 'var(--font-cormorant, serif)', fontSize: '20px', fontWeight: 500 }}>Tus datos</h2>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                Para coordinar la entrega te vamos a contactar.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '5px' }}>
                    Nombre *
                  </label>
                  <input
                    type="text"
                    placeholder="Tu nombre completo"
                    value={cliente.nombre}
                    onChange={e => setCliente(c => ({ ...c, nombre: e.target.value }))}
                    style={{
                      width: '100%', padding: '9px 12px', borderRadius: '7px', boxSizing: 'border-box',
                      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(200,169,110,0.2)',
                      color: '#f0ebe3', fontSize: '14px', outline: 'none',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '5px' }}>
                    WhatsApp
                  </label>
                  <input
                    type="tel"
                    placeholder="Ej: 3413001234"
                    value={cliente.telefono}
                    onChange={e => setCliente(c => ({ ...c, telefono: e.target.value }))}
                    style={{
                      width: '100%', padding: '9px 12px', borderRadius: '7px', boxSizing: 'border-box',
                      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(200,169,110,0.2)',
                      color: '#f0ebe3', fontSize: '14px', outline: 'none',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '5px' }}>
                    Email
                  </label>
                  <input
                    type="email"
                    placeholder="tu@email.com"
                    value={cliente.email}
                    onChange={e => setCliente(c => ({ ...c, email: e.target.value }))}
                    style={{
                      width: '100%', padding: '9px 12px', borderRadius: '7px', boxSizing: 'border-box',
                      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(200,169,110,0.2)',
                      color: '#f0ebe3', fontSize: '14px', outline: 'none',
                    }}
                  />
                </div>
              </div>

              {errorPago && (
                <div style={{ fontSize: '13px', color: 'var(--danger)', background: 'rgba(220,50,50,0.1)', padding: '10px', borderRadius: '6px' }}>
                  {errorPago}
                </div>
              )}

              <button
                onClick={handleCheckout}
                disabled={procesando}
                style={{
                  width: '100%', padding: '14px', borderRadius: '8px', fontSize: '15px', fontWeight: 600,
                  background: 'var(--gold)', color: '#000', border: 'none', cursor: procesando ? 'wait' : 'pointer',
                  opacity: procesando ? 0.7 : 1, marginTop: '4px',
                }}
              >
                {procesando ? 'Procesando...' : 'Pagar con Mercado Pago'}
              </button>

              <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', margin: 0 }}>
                Pago seguro con Mercado Pago
              </p>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .carrito-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}