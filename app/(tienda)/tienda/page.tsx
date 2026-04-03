'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
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

export default function TiendaPage() {
  const supabase = createClient()
  const [productos, setProductos] = useState<Producto[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterLinea, setFilterLinea] = useState('')
  const [lineas, setLineas] = useState<string[]>([])
  const [agregados, setAgregados] = useState<Record<number, boolean>>({})
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchProductos() {
      const { data, error: err } = await supabase
        .from('productos')
        .select('id, nombre, linea, marca, fragancia, precio_venta, stock')
        .eq('activo', true)
        .order('linea')
        .order('nombre')
      if (err) { setError(err.message); setLoading(false); return }
      const prods = data ?? []
      setProductos(prods)
      const ls = [...new Set(prods.map((p: Producto) => p.linea).filter(Boolean))].sort() as string[]
      setLineas(ls)
      setLoading(false)
    }
    fetchProductos()
  }, [])

  const filtrados = productos.filter(p => {
    const q = search.toLowerCase()
    const matchSearch = !q || p.nombre.toLowerCase().includes(q) || (p.marca ?? '').toLowerCase().includes(q) || (p.fragancia ?? '').toLowerCase().includes(q)
    const matchLinea = !filterLinea || p.linea === filterLinea
    return matchSearch && matchLinea
  })

  function agregarAlCarrito(p: Producto) {
    const c = getCarrito()
    c[p.id] = (c[p.id] ?? 0) + 1
    setCarrito(c)
    setAgregados(prev => ({ ...prev, [p.id]: true }))
    setTimeout(() => setAgregados(prev => ({ ...prev, [p.id]: false })), 1500)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

      {/* Hero */}
      <div style={{ textAlign: 'center', padding: '40px 0 20px' }}>
        <h1 style={{
          fontFamily: 'var(--font-cormorant, serif)',
          fontSize: 'clamp(32px, 6vw, 56px)',
          fontWeight: 400,
          color: 'var(--gold)',
          letterSpacing: '0.1em',
          marginBottom: '12px',
        }}>
          ABUMA.MA
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '15px', maxWidth: '500px', margin: '0 auto' }}>
          Productos holísticos seleccionados para tu bienestar y espiritualidad
        </p>
      </div>

      {error && (
        <div style={{ background: 'var(--danger-bg)', border: '1px solid #3a1010', borderRadius: '8px', padding: '12px 16px', color: 'var(--danger)', fontSize: '13px' }}>
          Error: {error}
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar producto..."
          style={{ flex: '1', minWidth: '200px' }}
        />
        <select value={filterLinea} onChange={e => setFilterLinea(e.target.value)} style={{ flex: '0 1 200px' }}>
          <option value="">Todas las líneas</option>
          {lineas.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>

      {/* Grid de productos */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Cargando productos...</div>
      ) : filtrados.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>No se encontraron productos</div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: '16px',
        }}>
          {filtrados.map(p => (
            <div key={p.id} className="card" style={{
              padding: 0, display: 'flex', flexDirection: 'column',
              overflow: 'hidden', transition: 'border-color 0.2s',
            }}>
              {/* Imagen placeholder */}
              <Link href={`/tienda/producto/${p.id}`} style={{ textDecoration: 'none' }}>
                <div style={{
                  height: '180px',
                  background: 'linear-gradient(135deg, var(--bg-card-hover) 0%, rgba(200,169,110,0.08) 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderBottom: '1px solid var(--border)',
                }}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--gold-dim)" strokeWidth="1">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                  </svg>
                </div>
              </Link>

              {/* Info */}
              <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                {p.linea && (
                  <span style={{ fontSize: '11px', color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    {p.linea}
                  </span>
                )}
                <Link href={`/tienda/producto/${p.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text)', lineHeight: 1.3 }}>{p.nombre}</div>
                </Link>
                {p.fragancia && (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{p.fragancia}</div>
                )}
                <div style={{ marginTop: 'auto', paddingTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--gold)' }}>
                    {formatARS(p.precio_venta)}
                  </span>
                  {p.stock > 0 ? (
                    <button
                      onClick={() => agregarAlCarrito(p)}
                      style={{
                        padding: '7px 12px', borderRadius: '7px', fontSize: '13px', fontWeight: 600,
                        background: agregados[p.id] ? 'var(--success)' : 'var(--gold)',
                        color: '#000', border: 'none', cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      {agregados[p.id] ? '✓ Agregado' : '+ Agregar'}
                    </button>
                  ) : (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Sin stock</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}