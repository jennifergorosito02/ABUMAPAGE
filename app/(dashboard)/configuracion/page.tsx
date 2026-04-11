'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Save, ImagePlus, Trash2 } from 'lucide-react'
import { useRequireRole } from '@/hooks/useRequireRole'

interface Config {
  razon_social: string; cuit: string; domicilio: string; telefono: string
  email: string; afip_punto_venta: string; afip_ambiente: string
  wsp: string; instagram: string; direccion_tienda: string
  texto_nosotras: string; texto_promos: string; recargo_tarjeta: string
}
const EMPTY: Config = { razon_social: '', cuit: '', domicilio: '', telefono: '', email: '', afip_punto_venta: '1', afip_ambiente: 'homologacion', wsp: '', instagram: '', direccion_tienda: '', texto_nosotras: '', texto_promos: '', recargo_tarjeta: '20' }

interface ImagenTienda {
  name: string
  url: string
}

export default function ConfiguracionPage() {
  useRequireRole(['admin'])
  const supabase = createClient()
  const [form, setForm] = useState<Config>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [imagenes, setImagenes] = useState<ImagenTienda[]>([])
  const [subiendo, setSubiendo] = useState(false)

  async function fetchImagenes() {
    const { data } = await supabase.storage.from('tienda').list('', { limit: 100, sortBy: { column: 'created_at', order: 'desc' } })
    if (data) {
      setImagenes(data.filter((f: { name: string }) => f.name !== '.emptyFolderPlaceholder').map((f: { name: string }) => ({
        name: f.name,
        url: supabase.storage.from('tienda').getPublicUrl(f.name).data.publicUrl,
      })))
    }
  }

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
        wsp: data.wsp ?? '',
        instagram: data.instagram ?? '',
        direccion_tienda: data.direccion_tienda ?? '',
        texto_nosotras: data.texto_nosotras ?? '',
        texto_promos: data.texto_promos ?? '',
        recargo_tarjeta: data.recargo_tarjeta?.toString() ?? '20',
      })
      setLoading(false)
    }
    fetch()
    fetchImagenes()
  }, [])

  async function handleSubirImagenTienda(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setSubiendo(true)
    const nombre = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`
    const { error } = await supabase.storage.from('tienda').upload(nombre, file)
    if (error) { setToast('Error: ' + error.message); setSubiendo(false); return }
    setToast('Imagen subida correctamente')
    setSubiendo(false)
    fetchImagenes()
    e.target.value = ''
  }

  async function handleEliminarImagen(name: string) {
    if (!confirm('¿Eliminar esta imagen?')) return
    await supabase.storage.from('tienda').remove([name])
    setImagenes(prev => prev.filter(i => i.name !== name))
    setToast('Imagen eliminada')
  }

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
      wsp: form.wsp || null,
      instagram: form.instagram || null,
      direccion_tienda: form.direccion_tienda || null,
      texto_nosotras: form.texto_nosotras || null,
      texto_promos: form.texto_promos || null,
      recargo_tarjeta: parseFloat(form.recargo_tarjeta) || 20,
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

        {/* Contacto tienda online */}
        <div className="card">
          <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px', color: 'var(--gold)' }}>Contacto de la tienda</h3>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>Aparece en el menú y footer de la tienda online</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '5px' }}>WhatsApp (solo números, con código de país)</label>
              <input placeholder="5491112345678" value={form.wsp} onChange={e => setForm(f => ({ ...f, wsp: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '5px' }}>Instagram (sin @)</label>
              <input placeholder="abuma.ma" value={form.instagram} onChange={e => setForm(f => ({ ...f, instagram: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '5px' }}>Dirección</label>
              <input placeholder="Buenos Aires, Argentina" value={form.direccion_tienda} onChange={e => setForm(f => ({ ...f, direccion_tienda: e.target.value }))} />
            </div>
          </div>
        </div>

        {/* Contenido páginas */}
        <div className="card">
          <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px', color: 'var(--gold)' }}>Nosotras</h3>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>Texto que aparece en la página "Nosotras" de la tienda</p>
          <textarea
            rows={8}
            placeholder="Contá quiénes son, su historia, valores, misión..."
            value={form.texto_nosotras}
            onChange={e => setForm(f => ({ ...f, texto_nosotras: e.target.value }))}
            style={{ width: '100%', resize: 'vertical', boxSizing: 'border-box' }}
          />
        </div>

        <div className="card">
          <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px', color: 'var(--gold)' }}>Promos</h3>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>Texto o descripción de promociones vigentes</p>
          <textarea
            rows={6}
            placeholder="Ej: 2x1 en sahumerios, envío gratis en compras mayores a $10.000..."
            value={form.texto_promos}
            onChange={e => setForm(f => ({ ...f, texto_promos: e.target.value }))}
            style={{ width: '100%', resize: 'vertical', boxSizing: 'border-box' }}
          />
        </div>

        {/* Precios */}
        <div className="card">
          <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px', color: 'var(--gold)' }}>Precios</h3>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            El precio base es para efectivo y transferencia. El recargo se aplica al precio con tarjeta.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '5px' }}>Recargo tarjeta (%)</label>
              <input
                type="number" min="0" max="100" step="0.5"
                value={form.recargo_tarjeta}
                onChange={e => setForm(f => ({ ...f, recargo_tarjeta: e.target.value }))}
                style={{ maxWidth: '160px' }}
              />
            </div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', paddingTop: '20px' }}>
              Ej: precio $1000 → tarjeta <strong style={{ color: 'var(--text)' }}>${(1000 * (1 + (parseFloat(form.recargo_tarjeta) || 0) / 100)).toLocaleString('es-AR', { maximumFractionDigits: 0 })}</strong>
            </div>
          </div>
        </div>

        <button type="submit" className="btn btn-primary" disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '8px', alignSelf: 'flex-start', padding: '10px 24px' }}>
          <Save size={15} /> {saving ? 'Guardando...' : 'Guardar configuración'}
        </button>
      </form>

      {/* Imágenes de tienda */}
      <div className="card" style={{ marginTop: '8px' }}>
        <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px', color: 'var(--gold)' }}>Imágenes de la tienda</h3>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Fotos decorativas que aparecen en la tienda online (banners, ambiente, etc.)
        </p>

        {/* Botón subir */}
        <label style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px',
          padding: '9px 18px', borderRadius: '8px', cursor: 'pointer',
          background: 'var(--bg-input)', border: '1px solid var(--border-light)',
          fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '20px',
          opacity: subiendo ? 0.6 : 1,
        }}>
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleSubirImagenTienda} disabled={subiendo} />
          <ImagePlus size={15} />
          {subiendo ? 'Subiendo...' : 'Subir imagen'}
        </label>

        {/* Grid de imágenes */}
        {imagenes.length === 0 ? (
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No hay imágenes cargadas aún</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '12px' }}>
            {imagenes.map(img => (
              <div key={img.name} style={{ position: 'relative', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border)', aspectRatio: '1' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={img.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button
                  onClick={() => handleEliminarImagen(img.name)}
                  title="Eliminar"
                  style={{
                    position: 'absolute', top: '6px', right: '6px',
                    background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: '4px',
                    color: 'var(--danger)', cursor: 'pointer', padding: '4px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
