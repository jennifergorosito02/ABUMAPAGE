'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { SesionCaja, Pago } from '@/types'
import {
  Wallet, LockOpen, Lock, Plus, X, History,
  ArrowUpCircle, ArrowDownCircle, RefreshCw,
} from 'lucide-react'

function formatARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

function formatFecha(s: string) {
  return new Date(s).toLocaleString('es-AR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })
}

export default function CajaPage() {
  const supabase = createClient()

  const [sesion, setSesion] = useState<SesionCaja | null>(null)
  const [historial, setHistorial] = useState<SesionCaja[]>([])
  const [pagos, setPagos] = useState<Pago[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'actual' | 'historial'>('actual')
  const [modalApertura, setModalApertura] = useState(false)
  const [modalCierre, setModalCierre] = useState(false)
  const [modalGasto, setModalGasto] = useState(false)
  const [saldoInicial, setSaldoInicial] = useState('')
  const [saldoContado, setSaldoContado] = useState('')
  const [gastoForm, setGastoForm] = useState({ tipo: 'gasto', concepto: '', monto: '', metodo_pago: 'efectivo' })
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => {
    setToast(msg); setTimeout(() => setToast(''), 3000)
  }

  const fetchData = useCallback(async () => {
    setLoading(true)

    // Sesión activa
    const { data: sesionData } = await supabase
      .from('sesiones_caja')
      .select('*, empleados(nombre)')
      .eq('estado', 'abierta')
      .order('apertura', { ascending: false })
      .limit(1)
      .single()
    setSesion(sesionData ?? null)

    // Pagos de la sesión activa
    if (sesionData) {
      const { data: pagosData } = await supabase
        .from('pagos')
        .select('*')
        .eq('sesion_caja_id', sesionData.id)
        .order('created_at', { ascending: false })
      setPagos(pagosData ?? [])
    }

    // Historial (últimas 10 sesiones cerradas)
    const { data: histData } = await supabase
      .from('sesiones_caja')
      .select('*, empleados(nombre)')
      .eq('estado', 'cerrada')
      .order('apertura', { ascending: false })
      .limit(10)
    setHistorial(histData ?? [])

    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  async function abrirCaja() {
    setSaving(true)
    const { error } = await supabase.from('sesiones_caja').insert({
      saldo_inicial: parseFloat(saldoInicial) || 0,
      estado: 'abierta',
    })
    setSaving(false)
    if (error) { showToast('Error al abrir caja'); return }
    setModalApertura(false)
    setSaldoInicial('')
    showToast('Caja abierta')
    fetchData()
  }

  async function cerrarCaja() {
    if (!sesion) return
    setSaving(true)
    const { error } = await supabase.from('sesiones_caja').update({
      estado: 'cerrada',
      cierre: new Date().toISOString(),
      saldo_final: parseFloat(saldoContado) || 0,
    }).eq('id', sesion.id)
    setSaving(false)
    if (error) { showToast('Error al cerrar caja'); return }
    setModalCierre(false)
    setSaldoContado('')
    showToast('Caja cerrada')
    fetchData()
  }

  async function registrarGasto() {
    if (!sesion || !gastoForm.concepto || !gastoForm.monto) return
    setSaving(true)
    const { error } = await supabase.from('pagos').insert({
      tipo: gastoForm.tipo,
      concepto: gastoForm.concepto,
      monto: parseFloat(gastoForm.monto),
      metodo_pago: gastoForm.metodo_pago,
      sesion_caja_id: sesion.id,
      fecha: new Date().toISOString().split('T')[0],
    })
    setSaving(false)
    if (error) { showToast('Error al registrar'); return }
    setModalGasto(false)
    setGastoForm({ tipo: 'gasto', concepto: '', monto: '', metodo_pago: 'efectivo' })
    showToast('Movimiento registrado')
    fetchData()
  }

  const totalGastos = pagos
    .filter(p => p.tipo === 'gasto' || p.tipo === 'pago_proveedor' || p.tipo === 'retiro')
    .reduce((s, p) => s + p.monto, 0)

  const saldoEsperado = sesion
    ? sesion.saldo_inicial + sesion.total_efectivo - totalGastos
    : 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }} className="fade-in">

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '24px', right: '24px',
          background: 'var(--bg-card)', border: '1px solid var(--border-light)',
          borderRadius: '8px', padding: '12px 16px', fontSize: '14px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)', zIndex: 200,
        }}>{toast}</div>
      )}

      {/* Header estado caja */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        {sesion ? (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: 'var(--success-bg)', border: '1px solid #1a3a20',
            borderRadius: '8px', padding: '10px 16px',
          }}>
            <LockOpen size={16} style={{ color: 'var(--success)' }} />
            <span style={{ color: 'var(--success)', fontWeight: 500, fontSize: '14px' }}>Caja abierta</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>desde {formatFecha(sesion.apertura)}</span>
          </div>
        ) : (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: 'var(--danger-bg)', border: '1px solid #3a1010',
            borderRadius: '8px', padding: '10px 16px',
          }}>
            <Lock size={16} style={{ color: 'var(--danger)' }} />
            <span style={{ color: 'var(--danger)', fontWeight: 500, fontSize: '14px' }}>Caja cerrada</span>
          </div>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={fetchData} className="btn btn-ghost btn-sm"><RefreshCw size={14} /></button>
          {sesion ? (
            <>
              <button onClick={() => setModalGasto(true)} className="btn btn-ghost btn-sm">
                <Plus size={14} /> Movimiento
              </button>
              <button onClick={() => setModalCierre(true)} className="btn btn-sm" style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid #3a1010' }}>
                <Lock size={14} /> Cerrar caja
              </button>
            </>
          ) : (
            <button onClick={() => setModalApertura(true)} className="btn btn-primary btn-sm">
              <LockOpen size={14} /> Abrir caja
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--border)', paddingBottom: '-1px' }}>
        {[
          { id: 'actual', label: 'Turno actual', icon: Wallet },
          { id: 'historial', label: 'Historial', icon: History },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setView(id as 'actual' | 'historial')}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px', background: 'none',
              border: 'none', borderBottom: view === id ? '2px solid var(--gold)' : '2px solid transparent',
              color: view === id ? 'var(--gold)' : 'var(--text-muted)',
              fontSize: '14px', cursor: 'pointer', marginBottom: '-1px',
            }}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Cargando...</div>
      ) : view === 'actual' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {!sesion ? (
            <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
              No hay caja abierta. Abrí un nuevo turno para comenzar.
            </div>
          ) : (
            <>
              {/* KPIs del turno */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
                {[
                  { label: 'Saldo inicial', value: sesion.saldo_inicial, color: 'var(--text-secondary)' },
                  { label: 'Ventas del turno', value: sesion.total_ventas, color: 'var(--success)' },
                  { label: 'Efectivo recibido', value: sesion.total_efectivo, color: 'var(--gold)' },
                  { label: 'Transferencias', value: sesion.total_transferencia, color: 'var(--gold)' },
                  { label: 'Tarjeta', value: sesion.total_tarjeta, color: 'var(--gold)' },
                  { label: 'Gastos / Retiros', value: -totalGastos, color: 'var(--danger)' },
                  { label: 'Saldo esperado caja', value: saldoEsperado, color: 'var(--gold-light)' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="card" style={{ padding: '14px 16px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>{label}</div>
                    <div style={{ fontSize: '20px', fontWeight: 700, color }}>{formatARS(Math.abs(value))}</div>
                  </div>
                ))}
              </div>

              {/* Movimientos del turno */}
              <div className="card" style={{ padding: 0 }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', fontSize: '14px', fontWeight: 600 }}>
                  Movimientos del turno
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Tipo</th>
                        <th>Concepto</th>
                        <th>Método</th>
                        <th style={{ textAlign: 'right' }}>Monto</th>
                        <th>Hora</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagos.length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                            Sin movimientos registrados
                          </td>
                        </tr>
                      ) : pagos.map(p => {
                        const esGasto = p.tipo === 'gasto' || p.tipo === 'pago_proveedor' || p.tipo === 'retiro'
                        return (
                          <tr key={p.id}>
                            <td>
                              <span className={`badge ${esGasto ? 'badge-red' : 'badge-green'}`}>
                                {p.tipo === 'gasto' ? 'Gasto' : p.tipo === 'pago_proveedor' ? 'Proveedor' : p.tipo === 'retiro' ? 'Retiro' : 'Cobro'}
                              </span>
                            </td>
                            <td>{p.concepto}</td>
                            <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{p.metodo_pago ?? '—'}</td>
                            <td style={{ textAlign: 'right', fontWeight: 600, color: esGasto ? 'var(--danger)' : 'var(--success)' }}>
                              {esGasto ? '-' : '+'}{formatARS(p.monto)}
                            </td>
                            <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{formatFecha(p.created_at)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        /* Historial */
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Apertura</th>
                  <th>Cierre</th>
                  <th style={{ textAlign: 'right' }}>Saldo inicial</th>
                  <th style={{ textAlign: 'right' }}>Ventas</th>
                  <th style={{ textAlign: 'right' }}>Saldo final</th>
                  <th style={{ textAlign: 'center' }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {historial.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                      No hay sesiones anteriores
                    </td>
                  </tr>
                ) : historial.map(s => (
                  <tr key={s.id}>
                    <td style={{ fontSize: '13px' }}>{formatFecha(s.apertura)}</td>
                    <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{s.cierre ? formatFecha(s.cierre) : '—'}</td>
                    <td style={{ textAlign: 'right' }}>{formatARS(s.saldo_inicial)}</td>
                    <td style={{ textAlign: 'right', color: 'var(--success)', fontWeight: 600 }}>{formatARS(s.total_ventas)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{s.saldo_final != null ? formatARS(s.saldo_final) : '—'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge ${s.estado === 'cerrada' ? 'badge-gray' : 'badge-green'}`}>
                        {s.estado === 'cerrada' ? 'Cerrada' : 'Abierta'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal apertura */}
      {modalApertura && (
        <div className="overlay" onClick={e => { if (e.target === e.currentTarget) setModalApertura(false) }}>
          <div className="modal fade-in" style={{ maxWidth: '380px' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '16px' }}>
                <LockOpen size={16} style={{ color: 'var(--success)' }} /> Abrir caja
              </div>
              <button className="btn-icon" onClick={() => setModalApertura(false)} style={{ borderRadius: '6px' }}><X size={16} /></button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Saldo inicial en caja (efectivo)
                </label>
                <input
                  type="number" min="0" value={saldoInicial}
                  onChange={e => setSaldoInicial(e.target.value)}
                  placeholder="0" autoFocus
                />
              </div>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setModalApertura(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={abrirCaja} disabled={saving}>
                {saving ? 'Abriendo...' : 'Abrir turno'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal cierre */}
      {modalCierre && sesion && (
        <div className="overlay" onClick={e => { if (e.target === e.currentTarget) setModalCierre(false) }}>
          <div className="modal fade-in" style={{ maxWidth: '420px' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '16px' }}>
                <Lock size={16} style={{ color: 'var(--danger)' }} /> Cerrar caja
              </div>
              <button className="btn-icon" onClick={() => setModalCierre(false)} style={{ borderRadius: '6px' }}><X size={16} /></button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Resumen */}
              <div style={{ background: 'var(--bg-input)', borderRadius: '8px', padding: '14px' }}>
                {[
                  { label: 'Saldo inicial', value: sesion.saldo_inicial },
                  { label: 'Total ventas', value: sesion.total_ventas },
                  { label: 'Efectivo recibido', value: sesion.total_efectivo },
                  { label: 'Gastos / Retiros', value: -totalGastos },
                  { label: 'Saldo esperado', value: saldoEsperado },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '3px 0' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                    <span style={{ fontWeight: 500 }}>{formatARS(Math.abs(value))}</span>
                  </div>
                ))}
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Efectivo contado en caja
                </label>
                <input
                  type="number" min="0" value={saldoContado}
                  onChange={e => setSaldoContado(e.target.value)}
                  placeholder="0" autoFocus
                />
                {saldoContado && (
                  <div style={{ marginTop: '6px', fontSize: '13px' }}>
                    Diferencia:{' '}
                    <strong style={{
                      color: parseFloat(saldoContado) >= saldoEsperado ? 'var(--success)' : 'var(--danger)',
                    }}>
                      {formatARS(parseFloat(saldoContado) - saldoEsperado)}
                    </strong>
                  </div>
                )}
              </div>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setModalCierre(false)}>Cancelar</button>
              <button
                className="btn btn-sm"
                style={{ background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid #3a1010' }}
                onClick={cerrarCaja} disabled={saving}
              >
                {saving ? 'Cerrando...' : 'Confirmar cierre'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal gasto */}
      {modalGasto && (
        <div className="overlay" onClick={e => { if (e.target === e.currentTarget) setModalGasto(false) }}>
          <div className="modal fade-in" style={{ maxWidth: '400px' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, fontSize: '16px' }}>Registrar movimiento</span>
              <button className="btn-icon" onClick={() => setModalGasto(false)} style={{ borderRadius: '6px' }}><X size={16} /></button>
            </div>
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Tipo</label>
                <select value={gastoForm.tipo} onChange={e => setGastoForm(f => ({ ...f, tipo: e.target.value }))}>
                  <option value="gasto">Gasto</option>
                  <option value="retiro">Retiro de caja</option>
                  <option value="pago_proveedor">Pago a proveedor</option>
                  <option value="cobro">Cobro extra</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Concepto *</label>
                <input
                  value={gastoForm.concepto}
                  onChange={e => setGastoForm(f => ({ ...f, concepto: e.target.value }))}
                  placeholder="Descripción del movimiento"
                  autoFocus
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Monto *</label>
                  <input
                    type="number" min="0"
                    value={gastoForm.monto}
                    onChange={e => setGastoForm(f => ({ ...f, monto: e.target.value }))}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>Método</label>
                  <select value={gastoForm.metodo_pago} onChange={e => setGastoForm(f => ({ ...f, metodo_pago: e.target.value }))}>
                    <option value="efectivo">Efectivo</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="tarjeta">Tarjeta</option>
                  </select>
                </div>
              </div>
            </div>
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setModalGasto(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={registrarGasto} disabled={saving || !gastoForm.concepto || !gastoForm.monto}>
                {saving ? 'Guardando...' : 'Registrar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
