'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface PedidoItem {
  nombre: string
  cantidad: number
  precio_unitario: number
}

interface Pedido {
  id: string
  cliente_nombre: string | null
  cliente_email: string | null
  cliente_telefono: string | null
  metodo_pago: string | null
  subtotal: number
  total: number
  recargo_pct: number
  estado: 'pendiente' | 'aprobado' | 'cancelado'
  mp_payment_id: string | null
  created_at: string
  pedido_items: PedidoItem[]
}

function formatARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const BADGE: Record<string, { label: string; color: string; bg: string }> = {
  pendiente:  { label: 'Pendiente',  color: '#c8a96e', bg: 'rgba(200,169,110,0.12)' },
  aprobado:   { label: 'Aprobado',   color: '#3aaa6e', bg: 'rgba(58,170,110,0.12)'  },
  cancelado:  { label: 'Cancelado',  color: '#e05252', bg: 'rgba(220,82,82,0.12)'   },
}

export default function PedidosPage() {
  const supabase = createClient()
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(true)
  const [expandido, setExpandido] = useState<string | null>(null)
  const [filtro, setFiltro] = useState<'todos' | 'pendiente' | 'aprobado' | 'cancelado'>('todos')

  async function fetchPedidos() {
    const q = supabase
      .from('pedidos')
      .select('*, pedido_items(nombre, cantidad, precio_unitario)')
      .order('created_at', { ascending: false })
      .limit(100)

    const { data } = await q
    setPedidos((data ?? []) as Pedido[])
    setLoading(false)
  }

  useEffect(() => { fetchPedidos() }, [])

  const pedidosFiltrados = filtro === 'todos' ? pedidos : pedidos.filter(p => p.estado === filtro)

  const stats = {
    total: pedidos.length,
    aprobados: pedidos.filter(p => p.estado === 'aprobado').length,
    pendientes: pedidos.filter(p => p.estado === 'pendiente').length,
    ingresos: pedidos.filter(p => p.estado === 'aprobado').reduce((s, p) => s + p.total, 0),
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>Cargando pedidos...</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      <div>
        <h1 style={{ fontFamily: 'var(--font-cormorant, serif)', fontSize: '32px', fontWeight: 600, color: 'var(--gold)', margin: 0 }}>
          Pedidos Online
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>Compras realizadas desde la tienda web</p>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }} className="pedidos-stats">
        {[
          { label: 'Total pedidos', value: stats.total },
          { label: 'Aprobados', value: stats.aprobados },
          { label: 'Pendientes', value: stats.pendientes },
          { label: 'Ingresos MP', value: formatARS(stats.ingresos) },
        ].map(({ label, value }) => (
          <div key={label} className="card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--gold)' }}>{value}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {(['todos', 'pendiente', 'aprobado', 'cancelado'] as const).map(f => (
          <button key={f} onClick={() => setFiltro(f)} style={{
            padding: '6px 16px', borderRadius: '20px', fontSize: '13px', cursor: 'pointer',
            border: `1px solid ${filtro === f ? 'var(--gold)' : 'var(--border)'}`,
            background: filtro === f ? 'rgba(200,169,110,0.12)' : 'transparent',
            color: filtro === f ? 'var(--gold)' : 'var(--text-secondary)',
            fontWeight: filtro === f ? 600 : 400, textTransform: 'capitalize',
          }}>
            {f === 'todos' ? 'Todos' : BADGE[f].label}
            {f !== 'todos' && (
              <span style={{ marginLeft: '6px', fontSize: '11px', opacity: 0.7 }}>
                ({pedidos.filter(p => p.estado === f).length})
              </span>
            )}
          </button>
        ))}
        <button onClick={fetchPedidos} style={{
          marginLeft: 'auto', padding: '6px 14px', borderRadius: '20px', fontSize: '13px',
          background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-muted)', cursor: 'pointer',
        }}>
          ↻ Actualizar
        </button>
      </div>

      {/* Lista */}
      {pedidosFiltrados.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)', fontSize: '14px' }}>
          No hay pedidos {filtro !== 'todos' ? `con estado "${BADGE[filtro].label}"` : ''} todavía.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {pedidosFiltrados.map(p => {
            const badge = BADGE[p.estado]
            const abierto = expandido === p.id
            return (
              <div key={p.id} className="card" style={{ padding: 0, overflow: 'hidden' }}>

                {/* Fila principal */}
                <button
                  onClick={() => setExpandido(abierto ? null : p.id)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: '16px',
                    padding: '16px 20px', background: 'transparent', border: 'none',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  {/* Estado badge */}
                  <span style={{
                    padding: '3px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700,
                    color: badge.color, background: badge.bg, flexShrink: 0,
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                  }}>
                    {badge.label}
                  </span>

                  {/* Cliente */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.cliente_nombre ?? 'Sin nombre'}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {formatFecha(p.created_at)}
                      {p.cliente_telefono && ` · WhatsApp: ${p.cliente_telefono}`}
                    </div>
                  </div>

                  {/* Método */}
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', flexShrink: 0 }}>
                    {p.metodo_pago === 'tarjeta' ? '💳 Tarjeta' : '💵 Efectivo'}
                  </div>

                  {/* Total */}
                  <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--gold)', flexShrink: 0 }}>
                    {formatARS(p.total)}
                  </div>

                  {/* Chevron */}
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', transition: 'transform 0.2s', display: 'inline-block', transform: abierto ? 'rotate(180deg)' : 'none' }}>
                    ▾
                  </span>
                </button>

                {/* Detalle expandido */}
                {abierto && (
                  <div style={{ borderTop: '1px solid var(--border)', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

                    {/* Contacto */}
                    <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                      {p.cliente_email && (
                        <div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>Email</div>
                          <a href={`mailto:${p.cliente_email}`} style={{ fontSize: '13px', color: 'var(--gold)', textDecoration: 'none' }}>{p.cliente_email}</a>
                        </div>
                      )}
                      {p.cliente_telefono && (
                        <div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>WhatsApp</div>
                          <a href={`https://wa.me/${p.cliente_telefono.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: '13px', color: '#3aaa6e', textDecoration: 'none' }}>
                            {p.cliente_telefono} →
                          </a>
                        </div>
                      )}
                      {p.mp_payment_id && (
                        <div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>ID de pago MP</div>
                          <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>{p.mp_payment_id}</span>
                        </div>
                      )}
                    </div>

                    {/* Items */}
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>Productos</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {p.pedido_items.map((item, idx) => (
                          <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                            <span style={{ color: 'var(--text-secondary)' }}>{item.nombre} <span style={{ color: 'var(--text-muted)' }}>x{item.cantidad}</span></span>
                            <span style={{ color: 'var(--text)', fontWeight: 500 }}>{formatARS(item.precio_unitario * item.cantidad)}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Totales */}
                    <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {p.recargo_pct > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-muted)' }}>
                          <span>Subtotal (sin recargo)</span>
                          <span>{formatARS(p.subtotal)}</span>
                        </div>
                      )}
                      {p.recargo_pct > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'rgba(168,159,223,0.7)' }}>
                          <span>Recargo tarjeta ({p.recargo_pct}%)</span>
                          <span>+ {formatARS(p.total - p.subtotal)}</span>
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 700, color: 'var(--gold)', marginTop: '4px' }}>
                        <span>Total cobrado</span>
                        <span>{formatARS(p.total)}</span>
                      </div>
                    </div>

                    {/* Acción contacto rápido */}
                    {p.cliente_telefono && (
                      <a
                        href={`https://wa.me/${p.cliente_telefono.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola ${p.cliente_nombre ?? ''}! Te escribimos de ABUMA.MA por tu pedido. ¿Cómo podemos coordinar la entrega?`)}`}
                        target="_blank" rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '8px',
                          padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                          background: 'rgba(37,211,102,0.15)', border: '1px solid rgba(37,211,102,0.3)',
                          color: '#25d366', textDecoration: 'none', width: 'fit-content',
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.123.554 4.117 1.524 5.847L.057 23.272a.75.75 0 0 0 .92.92l5.424-1.467A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75c-1.9 0-3.68-.508-5.215-1.393l-.374-.22-3.872 1.047 1.046-3.87-.221-.374A9.714 9.714 0 0 1 2.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z"/>
                        </svg>
                        Contactar por WhatsApp
                      </a>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <style>{`
        @media (max-width: 640px) {
          .pedidos-stats { grid-template-columns: 1fr 1fr !important; }
        }
      `}</style>
    </div>
  )
}