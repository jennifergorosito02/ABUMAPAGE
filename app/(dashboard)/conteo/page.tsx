'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  ClipboardList, Plus, CheckCircle2, AlertTriangle,
  History, X, ChevronDown, ChevronUp, RefreshCw,
} from 'lucide-react'

function formatFecha(s: string) {
  return new Date(s).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

type Turno = 'mañana' | 'tarde' | 'noche'
type Vista = 'nuevo' | 'activo' | 'historial' | 'alertas'

interface Producto { id: number; nombre: string; linea: string | null; fragancia: string | null; stock: number }
interface ItemConteo {
  producto_id: number
  nombre: string
  linea: string | null
  fragancia: string | null
  stock_sistema: number
  stock_fisico: string
  motivo_diferencia: string
}
interface ConteoHistorial {
  id: number
  fecha: string
  turno: string
  estado: string
  observaciones: string | null
  created_at: string
  empleados: { nombre: string } | null
  items_con_diferencia: number
  total_items: number
}

export default function ConteoPage() {
  const supabase = createClient()

  const [vista, setVista] = useState<Vista>('nuevo')
  const [turno, setTurno] = useState<Turno>('mañana')
  const [observaciones, setObservaciones] = useState('')
  const [items, setItems] = useState<ItemConteo[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [conteoActivo, setConteoActivo] = useState<number | null>(null)
  const [historial, setHistorial] = useState<ConteoHistorial[]>([])
  const [alertas, setAlertas] = useState<{
    id: number; conteo_id: number; fecha: string; turno: string;
    nombre: string; stock_sistema: number; stock_fisico: number; diferencia: number
  }[]>([])
  const [filterLinea, setFilterLinea] = useState('')
  const [lineas, setLineas] = useState<string[]>([])
  const [toast, setToast] = useState<{ msg: string; tipo: 'ok' | 'error' } | null>(null)
  const [justificandoId, setJustificandoId] = useState<number | null>(null)
  const [motivoJustif, setMotivoJustif] = useState('')

  const showToast = (msg: string, tipo: 'ok' | 'error' = 'ok') => {
    setToast({ msg, tipo }); setTimeout(() => setToast(null), 3500)
  }

  const fetchHistorial = useCallback(async () => {
    const { data } = await supabase
      .from('conteos_stock')
      .select('*, empleados(nombre)')
      .order('created_at', { ascending: false })
      .limit(30)

    if (!data) return

    // Para cada conteo, contar items con diferencia
    const conResumen = await Promise.all(data.map(async c => {
      const { data: its } = await supabase
        .from('conteo_items')
        .select('id, diferencia')
        .eq('conteo_id', c.id)
        .not('diferencia', 'is', null)
      const total = its?.length ?? 0
      const conDif = its?.filter(i => i.diferencia !== 0).length ?? 0
      return { ...c, items_con_diferencia: conDif, total_items: total }
    }))
    setHistorial(conResumen)
  }, [])

  const fetchAlertas = useCallback(async () => {
    const { data } = await supabase
      .from('conteo_items')
      .select('id, conteo_id, diferencia, stock_sistema, stock_fisico, motivo_diferencia, productos(nombre), conteos_stock(fecha, turno)')
      .not('diferencia', 'is', null)
      .neq('diferencia', 0)
      .is('motivo_diferencia', null)
      .order('id', { ascending: false })

    setAlertas((data ?? []).map((d: any) => ({
      id: d.id,
      conteo_id: d.conteo_id,
      fecha: d.conteos_stock?.fecha ?? '',
      turno: d.conteos_stock?.turno ?? '',
      nombre: d.productos?.nombre ?? '',
      stock_sistema: d.stock_sistema,
      stock_fisico: d.stock_fisico,
      diferencia: d.diferencia,
    })))
  }, [])

  useEffect(() => {
    fetchHistorial()
    fetchAlertas()
  }, [fetchHistorial, fetchAlertas])

  async function iniciarConteo() {
    setLoading(true)
    const { data: prods } = await supabase
      .from('productos')
      .select('id, nombre, linea, fragancia, stock')
      .eq('activo', true)
      .order('linea')
      .order('nombre')

    const productos = prods ?? []
    const lineasUnicas = [...new Set(productos.map(p => p.linea).filter(Boolean))].sort() as string[]
    setLineas(lineasUnicas)

    const itemsInicio: ItemConteo[] = productos.map(p => ({
      producto_id: p.id,
      nombre: p.nombre,
      linea: p.linea,
      fragancia: p.fragancia,
      stock_sistema: p.stock,
      stock_fisico: '',
      motivo_diferencia: '',
    }))
    setItems(itemsInicio)

    // Crear conteo en BD con estado en_proceso
    const authResult = await supabase.auth.getUser()
    const user = authResult.data.user
    let empleadoId: number | null = null
    if (user) {
      const empResult = await supabase.from('empleados').select('id').eq('user_id', user.id).single()
      empleadoId = empResult.data?.id ?? null
    }

    const { data: conteo, error } = await supabase
      .from('conteos_stock')
      .insert({ turno, empleado_id: empleadoId, estado: 'en_proceso', observaciones: observaciones || null })
      .select()
      .single()

    if (error || !conteo) {
      showToast('Error al iniciar el conteo', 'error')
      setLoading(false)
      return
    }

    setConteoActivo(conteo.id)
    setVista('activo')
    setLoading(false)
  }

  async function guardarConteo() {
    if (!conteoActivo) return
    setSaving(true)

    const itemsContados = items.filter(i => i.stock_fisico !== '')
    if (itemsContados.length === 0) {
      showToast('Ingresá al menos un conteo físico', 'error')
      setSaving(false)
      return
    }

    // Verificar que items con diferencia tengan motivo
    const sinMotivo = itemsContados.filter(i => {
      const fisico = parseInt(i.stock_fisico)
      const diferencia = fisico - i.stock_sistema
      return diferencia !== 0 && !i.motivo_diferencia.trim()
    })

    if (sinMotivo.length > 0) {
      showToast(`${sinMotivo.length} producto(s) con diferencia sin motivo. Completá el campo "Motivo".`, 'error')
      setSaving(false)
      return
    }

    const payload = itemsContados.map(i => ({
      conteo_id: conteoActivo,
      producto_id: i.producto_id,
      stock_sistema: i.stock_sistema,
      stock_fisico: parseInt(i.stock_fisico),
      motivo_diferencia: i.motivo_diferencia.trim() || null,
    }))

    const { error: itemsError } = await supabase.from('conteo_items').insert(payload)
    if (itemsError) {
      showToast('Error al guardar los items', 'error')
      setSaving(false)
      return
    }

    await supabase.from('conteos_stock')
      .update({ estado: 'completado' })
      .eq('id', conteoActivo)

    setSaving(false)
    showToast('Conteo guardado correctamente')
    setConteoActivo(null)
    setItems([])
    setObservaciones('')
    setVista('historial')
    fetchHistorial()
    fetchAlertas()
  }

  async function cancelarConteo() {
    if (!conteoActivo) return
    await supabase.from('conteos_stock').delete().eq('id', conteoActivo)
    setConteoActivo(null)
    setItems([])
    setVista('nuevo')
  }

  async function justificar() {
    if (!justificandoId || !motivoJustif.trim()) return
    await supabase.from('conteo_items')
      .update({ motivo_diferencia: motivoJustif.trim() })
      .eq('id', justificandoId)
    setJustificandoId(null)
    setMotivoJustif('')
    fetchAlertas()
    showToast('Diferencia justificada')
  }

  const itemsFiltrados = filterLinea
    ? items.filter(i => i.linea === filterLinea)
    : items

  const itemsContados = items.filter(i => i.stock_fisico !== '').length
  const itemsConDiferencia = items.filter(i => {
    if (i.stock_fisico === '') return false
    return parseInt(i.stock_fisico) !== i.stock_sistema
  }).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }} className="fade-in">

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '24px', right: '24px',
          background: toast.tipo === 'error' ? 'var(--danger-bg)' : 'var(--bg-card)',
          border: `1px solid ${toast.tipo === 'error' ? '#3a1010' : 'var(--border-light)'}`,
          color: toast.tipo === 'error' ? 'var(--danger)' : 'var(--text)',
          borderRadius: '8px', padding: '12px 16px', fontSize: '14px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)', zIndex: 200,
        }}>{toast.msg}</div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <ClipboardList size={20} style={{ color: 'var(--gold)' }} />
          <h1 style={{ fontSize: '20px', fontWeight: 700 }}>Conteo de Stock</h1>
          {alertas.length > 0 && (
            <span style={{
              background: 'var(--danger)', color: '#fff',
              borderRadius: '10px', padding: '2px 8px', fontSize: '12px', fontWeight: 700,
            }}>{alertas.length} alerta{alertas.length !== 1 ? 's' : ''}</span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--border)' }}>
        {([
          { id: 'nuevo', label: 'Nuevo conteo', disabled: !!conteoActivo },
          { id: 'activo', label: conteoActivo ? `En proceso (${itemsContados}/${items.length})` : 'En proceso', disabled: !conteoActivo },
          { id: 'historial', label: 'Historial', disabled: false },
          { id: 'alertas', label: `Alertas${alertas.length > 0 ? ` (${alertas.length})` : ''}`, disabled: false },
        ] as { id: Vista; label: string; disabled: boolean }[]).map(({ id, label, disabled }) => (
          <button
            key={id}
            onClick={() => !disabled && setVista(id)}
            disabled={disabled}
            style={{
              padding: '8px 16px', background: 'none', border: 'none',
              borderBottom: vista === id ? '2px solid var(--gold)' : '2px solid transparent',
              color: disabled ? 'var(--text-muted)' : vista === id ? 'var(--gold)' : 'var(--text-secondary)',
              fontSize: '14px', cursor: disabled ? 'not-allowed' : 'pointer',
              marginBottom: '-1px', fontWeight: vista === id ? 500 : 400,
              opacity: disabled ? 0.5 : 1,
            }}
          >{label}</button>
        ))}
      </div>

      {/* ── VISTA: NUEVO ── */}
      {vista === 'nuevo' && (
        <div className="card" style={{ padding: '24px', maxWidth: '480px' }}>
          <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '20px' }}>Configurar nuevo conteo</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Turno</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                {(['mañana', 'tarde', 'noche'] as Turno[]).map(t => (
                  <button
                    key={t}
                    onClick={() => setTurno(t)}
                    style={{
                      padding: '10px', borderRadius: '7px', cursor: 'pointer',
                      border: `1px solid ${turno === t ? 'var(--gold)' : 'var(--border)'}`,
                      background: turno === t ? 'rgba(201,162,39,0.08)' : 'transparent',
                      color: turno === t ? 'var(--gold)' : 'var(--text-secondary)',
                      fontSize: '13px', fontWeight: turno === t ? 600 : 400, textTransform: 'capitalize',
                    }}
                  >{t}</button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Observaciones (opcional)
              </label>
              <textarea
                rows={2}
                value={observaciones}
                onChange={e => setObservaciones(e.target.value)}
                placeholder="Ej: conteo post-inventario, feriado, etc."
                style={{ width: '100%', resize: 'vertical', boxSizing: 'border-box' }}
              />
            </div>
            <button
              className="btn btn-primary"
              onClick={iniciarConteo}
              disabled={loading}
              style={{ justifyContent: 'center', padding: '12px' }}
            >
              {loading ? 'Cargando productos...' : <><Plus size={16} /> Iniciar conteo</>}
            </button>
          </div>
        </div>
      )}

      {/* ── VISTA: ACTIVO ── */}
      {vista === 'activo' && conteoActivo && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* Stats del conteo en curso */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
            {[
              { label: 'Total productos', value: items.length, color: 'var(--text)' },
              { label: 'Contados', value: itemsContados, color: 'var(--success)' },
              { label: 'Con diferencia', value: itemsConDiferencia, color: itemsConDiferencia > 0 ? 'var(--danger)' : 'var(--text-muted)' },
              { label: 'Sin contar', value: items.length - itemsContados, color: 'var(--text-muted)' },
            ].map(({ label, value, color }) => (
              <div key={label} className="card" style={{ padding: '12px 16px' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>{label}</div>
                <div style={{ fontSize: '22px', fontWeight: 700, color }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Filtro por línea */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={filterLinea}
              onChange={e => setFilterLinea(e.target.value)}
              style={{ flex: '0 1 220px' }}
            >
              <option value="">Todas las líneas</option>
              {lineas.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              {itemsFiltrados.length} producto{itemsFiltrados.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Tabla de conteo */}
          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Línea</th>
                    <th style={{ textAlign: 'center' }}>Sistema</th>
                    <th style={{ textAlign: 'center', minWidth: '100px' }}>Físico</th>
                    <th style={{ textAlign: 'center' }}>Dif.</th>
                    <th style={{ minWidth: '180px' }}>Motivo diferencia</th>
                  </tr>
                </thead>
                <tbody>
                  {itemsFiltrados.map((item, idx) => {
                    const globalIdx = items.findIndex(i => i.producto_id === item.producto_id)
                    const fisico = item.stock_fisico !== '' ? parseInt(item.stock_fisico) : null
                    const diferencia = fisico !== null ? fisico - item.stock_sistema : null
                    const hayDif = diferencia !== null && diferencia !== 0

                    return (
                      <tr key={item.producto_id} style={{
                        background: hayDif ? 'rgba(220,53,69,0.04)' : undefined,
                      }}>
                        <td>
                          <div style={{ fontWeight: 500, fontSize: '13px' }}>{item.nombre}</div>
                          {item.fragancia && (
                            <div style={{ fontSize: '11px', color: 'var(--gold)', opacity: 0.7 }}>{item.fragancia}</div>
                          )}
                        </td>
                        <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{item.linea ?? '—'}</td>
                        <td style={{ textAlign: 'center', fontWeight: 500 }}>{item.stock_sistema}</td>
                        <td style={{ textAlign: 'center' }}>
                          <input
                            type="number"
                            min="0"
                            value={item.stock_fisico}
                            onChange={e => {
                              const val = e.target.value
                              setItems(prev => prev.map((it, i) =>
                                i === globalIdx ? { ...it, stock_fisico: val } : it
                              ))
                            }}
                            placeholder="—"
                            style={{
                              width: '70px', textAlign: 'center', padding: '5px 8px',
                              border: `1px solid ${hayDif ? 'var(--danger)' : 'var(--border)'}`,
                            }}
                          />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {diferencia !== null ? (
                            <span style={{
                              fontWeight: 700, fontSize: '14px',
                              color: diferencia === 0 ? 'var(--success)' : diferencia > 0 ? 'var(--warning)' : 'var(--danger)',
                            }}>
                              {diferencia > 0 ? '+' : ''}{diferencia}
                            </span>
                          ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        </td>
                        <td>
                          {hayDif ? (
                            <input
                              value={item.motivo_diferencia}
                              onChange={e => {
                                const val = e.target.value
                                setItems(prev => prev.map((it, i) =>
                                  i === globalIdx ? { ...it, motivo_diferencia: val } : it
                                ))
                              }}
                              placeholder="Motivo obligatorio *"
                              style={{
                                fontSize: '12px', padding: '5px 8px',
                                border: `1px solid ${!item.motivo_diferencia.trim() ? 'var(--danger)' : 'var(--border)'}`,
                              }}
                            />
                          ) : (
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Acciones */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button className="btn btn-ghost" onClick={cancelarConteo}>
              <X size={14} /> Cancelar conteo
            </button>
            <button
              className="btn btn-primary"
              onClick={guardarConteo}
              disabled={saving || itemsContados === 0}
              style={{ opacity: saving || itemsContados === 0 ? 0.5 : 1 }}
            >
              {saving ? 'Guardando...' : <><CheckCircle2 size={15} /> Finalizar conteo ({itemsContados} productos)</>}
            </button>
          </div>
        </div>
      )}

      {/* ── VISTA: HISTORIAL ── */}
      {vista === 'historial' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button onClick={fetchHistorial} className="btn btn-ghost btn-sm"><RefreshCw size={14} /></button>
          </div>
          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Turno</th>
                    <th>Empleado</th>
                    <th style={{ textAlign: 'center' }}>Productos</th>
                    <th style={{ textAlign: 'center' }}>Diferencias</th>
                    <th style={{ textAlign: 'center' }}>Estado</th>
                    <th>Observaciones</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                      No hay conteos registrados
                    </td></tr>
                  ) : historial.map(c => (
                    <tr key={c.id}>
                      <td style={{ fontSize: '13px' }}>{c.fecha} · {formatFecha(c.created_at).split(' ')[1]}</td>
                      <td style={{ textTransform: 'capitalize', fontSize: '13px' }}>{c.turno}</td>
                      <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{c.empleados?.nombre ?? '—'}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="badge badge-gold">{c.total_items}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {c.items_con_diferencia > 0
                          ? <span className="badge badge-red">{c.items_con_diferencia}</span>
                          : <span className="badge badge-green">0</span>}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`badge ${c.estado === 'completado' ? 'badge-green' : c.estado === 'en_proceso' ? 'badge-yellow' : 'badge-gray'}`}>
                          {c.estado}
                        </span>
                      </td>
                      <td style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '200px' }}>
                        {c.observaciones ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── VISTA: ALERTAS ── */}
      {vista === 'alertas' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Diferencias registradas sin justificar
            </span>
            <button onClick={fetchAlertas} className="btn btn-ghost btn-sm"><RefreshCw size={14} /></button>
          </div>

          {alertas.length === 0 ? (
            <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
              <CheckCircle2 size={32} style={{ color: 'var(--success)', margin: '0 auto 12px' }} />
              <div style={{ fontWeight: 600, marginBottom: '4px' }}>Sin alertas pendientes</div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Todas las diferencias están justificadas</div>
            </div>
          ) : (
            <div className="card" style={{ padding: 0 }}>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Fecha</th>
                      <th>Turno</th>
                      <th style={{ textAlign: 'center' }}>Sistema</th>
                      <th style={{ textAlign: 'center' }}>Físico</th>
                      <th style={{ textAlign: 'center' }}>Diferencia</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alertas.map(a => (
                      <tr key={a.id}>
                        <td style={{ fontWeight: 500, fontSize: '13px' }}>{a.nombre}</td>
                        <td style={{ fontSize: '13px' }}>{a.fecha}</td>
                        <td style={{ textTransform: 'capitalize', fontSize: '13px' }}>{a.turno}</td>
                        <td style={{ textAlign: 'center' }}>{a.stock_sistema}</td>
                        <td style={{ textAlign: 'center' }}>{a.stock_fisico}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span style={{
                            fontWeight: 700, fontSize: '14px',
                            color: a.diferencia > 0 ? 'var(--warning)' : 'var(--danger)',
                          }}>
                            {a.diferencia > 0 ? '+' : ''}{a.diferencia}
                          </span>
                        </td>
                        <td>
                          {justificandoId === a.id ? (
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                              <input
                                autoFocus
                                value={motivoJustif}
                                onChange={e => setMotivoJustif(e.target.value)}
                                placeholder="Motivo..."
                                style={{ fontSize: '12px', padding: '4px 8px', width: '160px' }}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') justificar()
                                  if (e.key === 'Escape') { setJustificandoId(null); setMotivoJustif('') }
                                }}
                              />
                              <button className="btn btn-primary btn-sm" onClick={justificar} style={{ padding: '4px 10px', fontSize: '12px' }}>OK</button>
                              <button className="btn btn-ghost btn-sm" onClick={() => { setJustificandoId(null); setMotivoJustif('') }} style={{ padding: '4px 8px' }}>✕</button>
                            </div>
                          ) : (
                            <button
                              className="btn btn-sm"
                              style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid #3a1010', fontSize: '12px', padding: '4px 10px' }}
                              onClick={() => { setJustificandoId(a.id); setMotivoJustif('') }}
                            >
                              <AlertTriangle size={12} /> Justificar
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal justificación (modal overlay para mobile) */}
      {justificandoId !== null && (
        <style>{`.conteo-justif-overlay { display: none; }`}</style>
      )}
    </div>
  )
}