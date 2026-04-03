'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Save } from 'lucide-react'

interface Config {
  razon_social: string; cuit: string; domicilio: string; telefono: string
  email: string; afip_punto_venta: string; afip_ambiente: string
}
const EMPTY: Config = { razon_social: '', cuit: '', domicilio: '', telefono: '', email: '', afip_punto_venta: '1', afip_ambiente: 'homologacion' }

export default function ConfiguracionPage() {
  const supabase = createClient()
  const [form, setForm] = useState<Config>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase.from('configuracion').select('*').eq('id', 1).single()
      if (data) setForm({
        razon_social: data.razon_social ?? '',
        cuit: data.cuit ?? '',
        domicilio: data.domicilio ?? '',
        telefono: data.telefono ?? '',
        email: data.email ?? '',
        afip_punto_venta: data.afip_punto_venta?.toString() ?? '1',
        afip_ambiente: data.afip_ambiente ?? 'homologacion',
      })
      setLoading(false)
    }
    fetch()
  }, [])

  async function handleGuardar(e: React.FormEvent) {
    e.preventDefault(); setSaving(true)
    await supabase.from('configuracion').upsert({
      id: 1,
      razon_social: form.razon_social || null,
      cuit: form.cuit || null,
      domicilio: form.domicilio || null,
      telefono: form.telefono || null,
      email: form.email || null,
      afip_punto_venta: parseInt(form.afip_punto_venta) || 1,
      afip_ambiente: form.afip_ambiente,
    })
    setSaving(false)
    setToast('Configuración guardada')
    setTimeout(() => setToast(''), 3000)
  }

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando...</div>

  return (
    <div style={{ maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '20px' }} className="fade-in">
      {toast && (
        <div style={{
          position: 'fixed', bottom: '24px', right: '24px',
          background: 'var(--bg-card)', border: '1px solid var(--border-light)',
          borderRadius: '8px', padding: '12px 16px', fontSize: '14px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)', zIndex: 200,
        }}>{toast}</div>
      )}

      <form onSubmit={handleGuardar} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Empresa */}
        <div className="card">
          <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px', color: 'var(--gold)' }}>Datos de la empresa</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {[
              { key: 'razon_social', label: 'Razón social' },
              { key: 'cuit', label: 'CUIT' },
              { key: 'domicilio', label: 'Domicilio' },
              { key: 'telefono', label: 'Teléfono' },
              { key: 'email', label: 'Email' },
            ].map(({ key, label }) => (
              <div key={key}>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '5px' }}>{label}</label>
                <input value={form[key as keyof Config]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
              </div>
            ))}
          </div>
        </div>

        {/* AFIP */}
        <div className="card">
          <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px', color: 'var(--gold)' }}>Configuración AFIP</h3>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Para emitir facturas electrónicas necesitás un certificado digital de AFIP.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '5px' }}>Punto de venta</label>
                <input type="number" min="1" value={form.afip_punto_venta} onChange={e => setForm(f => ({ ...f, afip_punto_venta: e.target.value }))} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '5px' }}>Ambiente</label>
                <select value={form.afip_ambiente} onChange={e => setForm(f => ({ ...f, afip_ambiente: e.target.value }))}>
                  <option value="homologacion">Homologación (pruebas)</option>
                  <option value="produccion">Producción</option>
                </select>
              </div>
            </div>
            <div style={{ background: 'var(--warning-bg)', border: '1px solid #3a2a00', borderRadius: '6px', padding: '12px', fontSize: '13px', color: 'var(--warning)' }}>
              El certificado digital AFIP (.crt y .key) se configura como variable de entorno en el servidor. Contactá al administrador para configurarlo.
            </div>
          </div>
        </div>

        <button type="submit" className="btn btn-primary" disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '8px', alignSelf: 'flex-start', padding: '10px 24px' }}>
          <Save size={15} /> {saving ? 'Guardando...' : 'Guardar configuración'}
        </button>
      </form>
    </div>
  )
}
