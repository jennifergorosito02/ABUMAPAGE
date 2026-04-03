'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Producto {
  id: number
  nombre: string
  linea: string | null
  marca: string | null
  fragancia: string | null
  precio_venta: number
  stock: number
}

function formatARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

function getCarrito(): Record<number, number> {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem('carrito') ?? '{}') } catch { return {} }
}
function setCarrito(c: Record<number, number>) {
  localStorage.setItem('carrito', JSON.stringify(c))
  window.dispatchEvent(new Event('carritoUpdate'))
}

export default function ProductoPage() {
  const { id } = useParams()
  const supabase = createClient()
  const [producto, setProducto] = useState<Producto | null>(null)
  const [loading, setLoading] = useState(true)
  const [cantidad, setCantidad] = useState(1)
  const [agregado, setAgregado] = useState(false)

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from('productos')
        .select('id, nombre, linea, marca, fragancia, precio_venta, stock')
        .eq('id', id)
        .eq('activo', true)
        .single()
      setProducto(data)
      setLoading(false)
    }
    if (id) fetch()
  }, [id])

  function agregarAlCarrito() {
    if (!producto) return
    const c = getCarrito()
    c[producto.id] = (c[producto.id] ?? 0) + cantidad
    setCarrito(c)
    setAgregado(true)
    setTimeout(() => setAgregado(false), 2000)
  }

  if (loading) return (
    <div style={{ textAlign: 'center', padding: '80px', color: 'var(--text-muted)' }}>Cargando...</div>
  )

  if (!producto) return (
    <div style={{ textAlign: 'center', padding: '80px' }}>
      <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>Producto no encontrado</p>
      <Link href="/tienda" style={{ color: 'var(--gold)' }}>← Volver a la tienda</Link>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Breadcrumb */}
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>
        <Link href="/tienda" style={{ color: 'var(--gold)' }}>Tienda</Link>
        <span>›</span>
        {producto.linea && <><span>{producto.linea}</span><span>›</span></>}
        <span style={{ color: 'var(--text)' }}>{producto.nombre}</span>
      </div>

      {/* Producto */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }} className="producto-grid">

        {/* Imagen */}
        <div style={{
          background: 'linear-gradient(135deg, var(--bg-card) 0%, rgba(200,169,110,0.06) 100%)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          aspectRatio: '1',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="var(--gold-dim)" strokeWidth="0.8">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
          </svg>
        </div>

        {/* Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {producto.linea && (
            <span style={{ fontSize: '12px', color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {producto.linea}
            </span>
          )}

          <h1 style={{
            fontFamily: 'var(--font-cormorant, serif)',
            fontSize: 'clamp(24px, 4vw, 36px)',
            fontWeight: 500,
            color: 'var(--text)',
            lineHeight: 1.2,
          }}>
            {producto.nombre}
          </h1>

          {producto.marca && (
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Marca: {producto.marca}</p>
          )}
          {producto.fragancia && (
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Fragancia: {producto.fragancia}</p>
          )}

          {false && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.6 }}>
            </p>
          )}

          <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--gold)' }}>
            {formatARS(producto.precio_venta)}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{
              display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%',
              background: producto.stock > 0 ? 'var(--success)' : 'var(--danger)',
            }} />
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              {producto.stock > 0 ? `${producto.stock} disponibles` : 'Sin stock'}
            </span>
          </div>

          {/* Cantidad + Agregar */}
          {producto.stock > 0 && (
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                <button
                  onClick={() => setCantidad(q => Math.max(1, q - 1))}
                  style={{ padding: '10px 16px', background: 'transparent', color: 'var(--text)', border: 'none', cursor: 'pointer', fontSize: '18px' }}
                >−</button>
                <span style={{ padding: '10px 16px', fontSize: '16px', fontWeight: 600, minWidth: '40px', textAlign: 'center' }}>{cantidad}</span>
                <button
                  onClick={() => setCantidad(q => Math.min(producto.stock, q + 1))}
                  style={{ padding: '10px 16px', background: 'transparent', color: 'var(--text)', border: 'none', cursor: 'pointer', fontSize: '18px' }}
                >+</button>
              </div>
              <button
                onClick={agregarAlCarrito}
                style={{
                  flex: 1, padding: '12px 24px', borderRadius: '8px', fontSize: '15px', fontWeight: 600,
                  background: agregado ? 'var(--success)' : 'var(--gold)',
                  color: '#000', border: 'none', cursor: 'pointer', transition: 'all 0.2s',
                }}
              >
                {agregado ? '✓ Agregado al carrito' : 'Agregar al carrito'}
              </button>
            </div>
          )}

          <Link href="/tienda/carrito" style={{
            display: 'block', textAlign: 'center', padding: '12px',
            border: '1px solid var(--border)', borderRadius: '8px',
            color: 'var(--text-secondary)', fontSize: '14px', textDecoration: 'none',
          }}>
            Ver carrito →
          </Link>
        </div>
      </div>

      <style>{`
        @media (max-width: 640px) {
          .producto-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}