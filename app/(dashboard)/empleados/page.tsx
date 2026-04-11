'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Empleado } from '@/types'
import { Plus, X, Pencil } from 'lucide-react'
import { useRequireRole } from '@/hooks/useRequireRole'

interface FormData { nombre: string; dni: string; telefono: string; email: string; rol: string; salario: string }
const EMPTY: FormData = { nombre: '', dni: '', telefono: '', email: '', rol: 'empleado', salario: '' }

export default function EmpleadosPage() {
  useRequireRole(['admin'])
  const supabase = createClient()
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<Empleado | null>(null)
  const [form, setForm] = useState<FormData>(EMPTY)
  const [saving, setSaving] = useState(false)

  async function fetchEmpleados() {
    setLoading(true)
    const { data } = await supabase.from('empleados').select('*').eq('activo', true).order('nombre')
    setEmpleados(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchEmpleados() }, [])

  function abrirNuevo() { setEditando(null); setForm(EMPTY); setModal(true) }
  function abrirEditar(e: Empleado) {
    setEditando(e)
    setForm({ nombre: e.nombre, dni: e.dni ?? '', telefono: e.telefono ?? '', email: e.email ?? '', rol: e.rol ?? 'empleado', salario: e.salario?.toString() ?? '' })
    setModal(true)
  }

  async function handleGuardar(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const payload = { nombre: form.nombre, dni: form.dni || null, telefono: form.telefono || null, email: form.email || null, rol: form.rol, salario: form.salario ? parseFloat(form.salario) : null }
    if (editando) await supabase.from('empleados').update(payload).eq('id', editando.id)
    else await supabase.from('empleados').insert(payload)
    setSaving(false); setModal(false); setEditando(null); fetchEmpleados()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }} className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={abrirNuevo} className="btn btn-primary btn-sm"><Plus size={15} /> Nuevo empleado</button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Nombre</th><th>DNI</th><th>Teléfono</th><th>Email</th><th>Rol</th><th></th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Cargando...</td></tr>
              : empleados.length === 0 ? <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Sin empleados</td></tr>
              : empleados.map(e => (
                <tr key={e.id}>
                  <td style={{ fontWeight: 500 }}>{e.nombre}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{e.dni ?? '—'}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{e.telefono ?? '—'}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{e.email ?? '—'}</td>
                  <td><span className="badge badge-gold">{e.rol ?? '—'}</span></td>
                  <td><button className="btn-icon" onClick={() => abrirEditar(e)} style={{ borderRadius: '5px' }}><Pencil size={14} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div className="overlay" onClick={e => { if (e.target === e.currentTarget) setModal(false) }}>
          <div className="modal fade-in">
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600 }}>{editando ? 'Editar empleado' : 'Nuevo empleado'}</span>
              <button className="btn-icon" onClick={() => setModal(false)} style={{ borderRadius: '6px' }}><X size={16} /></button>
            </div>
            <form onSubmit={handleGuardar}>
              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {[
                  { key: 'nombre', label: 'Nombre *', required: true },
                  { key: 'dni', label: 'DNI' },
                  { key: 'telefono', label: 'Teléfono' },
                  { key: 'email', label: 'Email' },
                ].map(({ key, label, required }) => (
                  <div key={key}>
                    <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '5px' }}>{label}</label>
                    <input value={form[key as keyof FormData]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} required={required} />
                  </div>
                ))}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '5px' }}>Rol</label>
                    <select value={form.rol} onChange={e => setForm(f => ({ ...f, rol: e.target.value }))}>
                      <option value="admin">Admin</option>
                      <option value="empleado">Empleado</option>
                      <option value="contador">Contador</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '5px' }}>Salario</label>
                    <input type="number" min="0" value={form.salario} onChange={e => setForm(f => ({ ...f, salario: e.target.value }))} />
                  </div>
                </div>
              </div>
              <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-ghost" onClick={() => setModal(false)}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Guardando...' : editando ? 'Guardar' : 'Crear'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
