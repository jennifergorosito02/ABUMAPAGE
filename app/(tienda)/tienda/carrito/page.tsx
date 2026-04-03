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

  async function fetchItems() {
    const carrito = getCarrito()
    const ids = Object.keys(carrito).map(Number)
    if (ids.length === 0) { setItems([]); setLoading(false); return }

    const { data } = await supabase
      .from('productos')
      .select('id, nombre, precio_venta, stock')
      .in('id', ids)
      .eq('activo', true)

    setItems((data ?? []).map((p: any) => ({
      ...p,
      cantidad: carrito[p.id] ?? 1,
    })))
    setLoading(false)
  }

  useEffect(() => { fetchItems() }, [])

  async function handleCheckout() {
    setProcesando(true)
    setErrorPago('')
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, back_url: window.location.origin }),
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

  const total = items.reduce((s, i) => s + i.precio_venta * i.cantidad, 0)

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
                {/* Mini imagen */}
                <div style={{
                  width: '64px', height: '64px', flexShrink: 0, borderRadius: '8px',
                  background: 'var(--bg-card-hover)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--gold-dim)" strokeWidth="1.5">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                  </svg>
                </div>

                {/* Info */}
                <div style={{ flex: 1 }}>
                  <Link href={`/tienda/producto/${item.id}`} style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text)', textDecoration: 'none' }}>
                    {item.nombre}
                  </Link>
                  <div style={{ color: 'var(--gold)', fontWeight: 700, marginTop: '4px' }}>
                    {formatARS(item.precio_venta)}
                  </div>
                </div>

                {/* Cantidad */}
                <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border)', borderRadius: '7px', overflow: 'hidden' }}>
                  <button onClick={() => updateCantidad(item.id, -1)} style={{ padding: '6px 12px', background: 'transparent', color: 'var(--text)', border: 'none', cursor: 'pointer' }}>−</button>
                  <span style={{ padding: '6px 10px', fontSize: '14px', fontWeight: 600 }}>{item.cantidad}</span>
                  <button onClick={() => updateCantidad(item.id, 1)} style={{ padding: '6px 12px', background: 'transparent', color: 'var(--text)', border: 'none', cursor: 'pointer' }}>+</button>
                </div>

                {/* Subtotal */}
                <div style={{ minWidth: '90px', textAlign: 'right', fontWeight: 700, fontSize: '15px' }}>
                  {formatARS(item.precio_venta * item.cantidad)}
                </div>

                {/* Eliminar */}
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

          {/* Resumen */}
          <div className="card" style={{ height: 'fit-content', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h2 style={{ fontFamily: 'var(--font-cormorant, serif)', fontSize: '22px', fontWeight: 500 }}>Resumen</h2>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {items.map(i => (
                <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <span>{i.nombre} x{i.cantidad}</span>
                  <span>{formatARS(i.precio_venta * i.cantidad)}</span>
                </div>
              ))}
            </div>

            <hr style={{ border: 'none', borderTop: '1px solid var(--border)' }} />

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 700 }}>
              <span>Total</span>
              <span style={{ color: 'var(--gold)' }}>{formatARS(total)}</span>
            </div>

            {errorPago && (
              <div style={{ fontSize: '13px', color: 'var(--danger)', background: 'var(--danger-bg)', padding: '10px', borderRadius: '6px' }}>
                {errorPago}
              </div>
            )}

            <button
              onClick={handleCheckout}
              disabled={procesando}
              style={{
                width: '100%', padding: '14px', borderRadius: '8px', fontSize: '15px', fontWeight: 600,
                background: 'var(--gold)', color: '#000', border: 'none', cursor: procesando ? 'wait' : 'pointer',
                opacity: procesando ? 0.7 : 1,
              }}
            >
              {procesando ? 'Procesando...' : 'Pagar con Mercado Pago'}
            </button>

            <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
              Pago seguro con Mercado Pago
            </p>
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