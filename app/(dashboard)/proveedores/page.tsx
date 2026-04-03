'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Proveedor } from '@/types'
import { Plus, X, Pencil } from 'lucide-react'

interface FormData { nombre: string; contacto: string; telefono: string; email: string; cuit: string; direccion: string; notas: string }
const EMPTY: FormData = { nombre: '', contacto: '', telefono: '', email: '', cuit: '', direccion: '', notas: '' }

export default function ProveedoresPage() {
  const supabase = createClient()
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editando, setEditando] = useState<Proveedor | null>(null)
  const [form, setForm] = useState<FormData>(EMPTY)
  const [saving, setSaving] = useState(false)

  async function fetch() {
    setLoading(true)
    const { data } = await supabase.from('proveedores').select('*').eq('activo', true).order('nombre')
    setProveedores(data ?? [])
    setLoading(false)
  }

  useEffect(() => { fetch() }, [])

  function abrirEditar(p: Proveedor) {
    setEditando(p)
    setForm({ nombre: p.nombre, contacto: p.contacto ?? '', telefono: p.telefono ?? '', email: p.email ?? '', cuit: p.cuit ?? '', direccion: p.direccion ?? '', notas: p.notas ?? '' })
    setModal(true)
  }

  async function handleGuardar(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    const payload = { nombre: form.nombre, contacto: form.contacto || null, telefono: form.telefono || null, email: form.email || null, cuit: form.cuit || null, direccion: form.direccion || null, notas: form.notas || null }
    if (editando) await supabase.from('proveedores').update(payload).eq('id', editando.id)
    else await supabase.from('proveedores').insert(payload)
    setSaving(false); setModal(false); setEditando(null); fetch()
  }

  const campos: { key: keyof FormData; label: string; required?: boolean }[] = [
    { key: 'nombre', label: 'Nombre *', required: true },
    { key: 'contacto', label: 'Contacto' },
    { key: 'telefono', label: 'Teléfono' },
    { key: 'email', label: 'Email' },
    { key: 'cuit', label: 'CUIT' },
    { key: 'direccion', label: 'Dirección' },
    { key: 'notas', label: 'Notas' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }} className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => { setEditando(null); setForm(EMPTY); setModal(true) }} className="btn btn-primary btn-sm">
          <Plus size={15} /> Nuevo proveedor
        </button>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Nombre</th><th>Contacto</th><th>Teléfono</th><th>CUIT</th><th>Email</th><th></th></tr></thead>
            <tbody>
              {loading ? <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Cargando...</td></tr>
              : proveedores.length === 0 ? <tr><td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Sin proveedores</td></tr>
              : proveedores.map(p => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 500 }}>{p.nombre}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{p.contacto ?? '—'}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{p.telefono ?? '—'}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{p.cuit ?? '—'}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{p.email ?? '—'}</td>
                  <td><button className="btn-icon" onClick={() => abrirEditar(p)} style={{ borderRadius: '5px' }}><Pencil size={14} /></button></td>
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
              <span style={{ fontWeight: 600 }}>{editando ? 'Editar proveedor' : 'Nuevo proveedor'}</span>
              <button className="btn-icon" onClick={() => setModal(false)} style={{ borderRadius: '6px' }}><X size={16} /></button>
            </div>
            <form onSubmit={handleGuardar}>
              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {campos.map(({ key, label, required }) => (
                  <div key={key}>
                    <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '5px' }}>{label}</label>
                    {key === 'notas'
                      ? <textarea value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} rows={3} />
                      : <input value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} required={required} />
                    }
                  </div>
                ))}
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
