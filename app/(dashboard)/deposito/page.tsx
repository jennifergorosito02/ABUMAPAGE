'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { MovimientoStock } from '@/types'
import { ArrowUp, ArrowDown, RefreshCw } from 'lucide-react'

function formatFecha(s: string) {
  return new Date(s).toLocaleString('es-AR', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' })
}

export default function DepositoPage() {
  const supabase = createClient()
  const [movimientos, setMovimientos] = useState<MovimientoStock[]>([])
  const [loading, setLoading] = useState(true)
  const [filterTipo, setFilterTipo] = useState('')

  async function fetchMovimientos() {
    setLoading(true)
    let query = supabase
      .from('movimientos_stock')
      .select('*, productos(nombre)')
      .order('created_at', { ascending: false })
      .limit(200)
    if (filterTipo) query = query.eq('tipo', filterTipo)
    const { data } = await query
    setMovimientos(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchMovimientos() }, [filterTipo])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }} className="fade-in">
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <select value={filterTipo} onChange={e => setFilterTipo(e.target.value)} style={{ maxWidth: '200px' }}>
          <option value="">Todos los movimientos</option>
          <option value="entrada">Entradas</option>
          <option value="salida">Salidas</option>
          <option value="ajuste">Ajustes</option>
          <option value="venta">Ventas</option>
        </select>
        <button onClick={fetchMovimientos} className="btn btn-ghost btn-sm"><RefreshCw size={14} /></button>
        <span style={{ marginLeft: 'auto', fontSize: '13px', color: 'var(--text-muted)' }}>
          {loading ? 'Cargando...' : `${movimientos.length} movimientos`}
        </span>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Producto</th>
                <th>Tipo</th>
                <th style={{ textAlign: 'center' }}>Cantidad</th>
                <th style={{ textAlign: 'center' }}>Anterior</th>
                <th style={{ textAlign: 'center' }}>Nuevo</th>
                <th>Motivo</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Cargando...</td></tr>
              ) : movimientos.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Sin movimientos</td></tr>
              ) : movimientos.map(m => {
                const esEntrada = m.tipo === 'entrada' || (m.tipo === 'ajuste' && m.cantidad > 0)
                return (
                  <tr key={m.id}>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatFecha(m.created_at)}</td>
                    <td style={{ fontSize: '13px' }}>{(m.productos as any)?.nombre ?? '—'}</td>
                    <td>
                      <span className={`badge ${m.tipo === 'venta' ? 'badge-gold' : esEntrada ? 'badge-green' : 'badge-red'}`}>
                        {m.tipo === 'entrada' ? 'Entrada' : m.tipo === 'salida' ? 'Salida' : m.tipo === 'ajuste' ? 'Ajuste' : 'Venta'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                        {esEntrada ? <ArrowUp size={13} style={{ color: 'var(--success)' }} /> : <ArrowDown size={13} style={{ color: 'var(--danger)' }} />}
                        <span style={{ fontWeight: 600 }}>{m.cantidad}</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>{m.stock_anterior}</td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{m.stock_nuevo}</td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{m.motivo ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
