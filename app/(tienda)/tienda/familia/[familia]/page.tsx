'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Variante {
  id: number
  nombre: string
  fragancia: string | null
  precio_venta: number
  stock: number
  imagen_url: string | null
  linea: string | null
  marca: string | null
  descripcion: string | null
}

function formatARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

function getCarrito(): Record<number, number> {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem('carrito') ?? '{}') } catch { return {} }
}
function setCarritoStorage(c: Record<number, number>) {
  localStorage.setItem('carrito', JSON.stringify(c))
  window.dispatchEvent(new Event('carritoUpdate'))
}

export default function FamiliaPage() {
  const params = useParams()
  const familia = decodeURIComponent(params.familia as string)
  const supabase = createClient()
  const folderKey = `fotos-${familia.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/gi, '').replace(/\s+/g, '-').toLowerCase()}`

  const [variantes, setVariantes] = useState<Variante[]>([])
  const [loading, setLoading] = useState(true)
  const [seleccionada, setSeleccionada] = useState<Variante | null>(null)
  const [cantidad, setCantidad] = useState(1)
  const [agregado, setAgregado] = useState(false)
  const [esAdmin, setEsAdmin] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [fotos, setFotos] = useState<string[]>([])
  const [fotoIdx, setFotoIdx] = useState(0)
  const [descripcion, setDescripcion] = useState('')
  const [editandoDesc, setEditandoDesc] = useState(false)
  const [guardandoDesc, setGuardandoDesc] = useState(false)
  const [recargo, setRecargo] = useState(20)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { if (data.user) setEsAdmin(true) })
    supabase.from('configuracion').select('recargo_tarjeta').eq('id', 1).single()
      .then(({ data }) => { if (data?.recargo_tarjeta != null) setRecargo(Number(data.recargo_tarjeta)) })
  }, [])

  // Cargar fotos del storage para esta familia
  async function cargarFotos(variantesActuales?: Variante[]) {
    const { data } = await supabase.storage.from('productos').list(folderKey, { limit: 50, sortBy: { column: 'created_at', order: 'asc' } })
    if (data && data.length > 0) {
      const archivos = data.filter(f => f.name !== '.emptyFolderPlaceholder')
      if (archivos.length === 0) return
      const urls = archivos.map(f => supabase.storage.from('productos').getPublicUrl(`${folderKey}/${f.name}`).data.publicUrl)
      setFotos(urls)
      setFotoIdx(0)
      // Sincronizar imagen_url si los productos no tienen foto todavía
      const vars = variantesActuales ?? variantes
      const sinImagen = vars.every(v => !v.imagen_url)
      if (sinImagen && urls[0]) {
        await supabase.from('productos').update({ imagen_url: urls[0] }).eq('familia', familia)
      }
    }
  }

  async function subirFoto(files: FileList) {
    setSubiendo(true)
    let primeraUrl: string | null = null
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop()
      const path = `${folderKey}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from('productos').upload(path, file, { upsert: false })
      if (error) { alert('Error al subir: ' + error.message); setSubiendo(false); return }
      if (!primeraUrl) {
        primeraUrl = supabase.storage.from('productos').getPublicUrl(path).data.publicUrl
      }
    }
    // Sincronizar imagen_url en la tabla para que aparezca en la tienda principal
    if (primeraUrl && fotos.length === 0) {
      await supabase.from('productos').update({ imagen_url: primeraUrl }).eq('familia', familia)
    }
    await cargarFotos()
    setSubiendo(false)
  }

  async function eliminarFoto(url: string) {
    if (!confirm('¿Eliminar esta foto?')) return
    // La URL tiene formato: .../storage/v1/object/public/productos/PATH
    const parts = url.split('/storage/v1/object/public/productos/')
    if (parts.length < 2) { alert('No se pudo identificar el archivo'); return }
    const path = decodeURIComponent(parts[1])
    const { error } = await supabase.storage.from('productos').remove([path])
    if (error) { alert('Error: ' + error.message); return }
    await cargarFotos()
  }

  useEffect(() => {
    async function fetchData() {
      const { data } = await supabase
        .from('productos')
        .select('id, nombre, fragancia, precio_venta, stock, imagen_url, linea, marca, descripcion')
        .eq('familia', familia)
        .eq('activo', true)
        .order('fragancia')
      const vars = data ?? []
      setVariantes(vars)
      if (vars.length > 0) {
        const conStock = vars.find((v: Variante) => v.stock > 0) ?? vars[0]
        setSeleccionada(conStock)
        setDescripcion(vars[0].descripcion ?? '')
      }
      setLoading(false)
      await cargarFotos(vars)
    }
    fetchData()
  }, [familia])

  async function guardarDescripcion() {
    setGuardandoDesc(true)
    await supabase.from('productos').update({ descripcion: descripcion || null }).eq('familia', familia)
    setEditandoDesc(false)
    setGuardandoDesc(false)
  }

  function elegirVariante(v: Variante) {
    setSeleccionada(v)
    setCantidad(1)
    setAgregado(false)
  }

  function agregarAlCarrito() {
    if (!seleccionada || seleccionada.stock === 0) return
    const c = getCarrito()
    c[seleccionada.id] = (c[seleccionada.id] ?? 0) + cantidad
    setCarritoStorage(c)
    setAgregado(true)
    setTimeout(() => setAgregado(false), 2000)
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '80px', color: 'var(--text-muted)' }}>Cargando...</div>
  if (variantes.length === 0) return (
    <div style={{ textAlign: 'center', padding: '80px' }}>
      <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>Producto no encontrado</p>
      <Link href="/tienda" style={{ color: 'var(--gold)' }}>← Volver a la tienda</Link>
    </div>
  )

  const fotoActiva = fotos[fotoIdx] ?? null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      {/* Breadcrumb */}
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>
        <Link href="/tienda" style={{ color: 'var(--gold)' }}>Tienda</Link>
        <span>›</span>
        {variantes[0]?.linea && <><span>{variantes[0].linea}</span><span>›</span></>}
        <span style={{ color: 'var(--text)' }}>{familia}</span>
      </div>

      {/* Layout principal */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '48px', alignItems: 'start' }} className="familia-grid">

        {/* Columna izquierda: galería */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

          {/* Galería — swipeable en mobile, flechas en desktop */}
          <div style={{
            borderRadius: '16px', border: '1px solid var(--border)',
            overflow: 'hidden', aspectRatio: '1',
            background: 'linear-gradient(135deg, #1a1208 0%, #3d2a08 100%)',
            position: 'relative',
          }}
            onTouchStart={e => {
              const x = e.touches[0].clientX
              ;(e.currentTarget as HTMLDivElement).dataset.touchX = String(x)
            }}
            onTouchEnd={e => {
              const startX = Number((e.currentTarget as HTMLDivElement).dataset.touchX ?? 0)
              const endX = e.changedTouches[0].clientX
              const diff = startX - endX
              if (Math.abs(diff) > 40) {
                if (diff > 0) setFotoIdx(i => (i + 1) % fotos.length)
                else setFotoIdx(i => (i - 1 + fotos.length) % fotos.length)
              }
            }}
          >
            {/* Carrusel de imágenes */}
            <div style={{ display: 'flex', width: `${fotos.length * 100}%`, height: '100%', transform: `translateX(-${fotoIdx * (100 / fotos.length)}%)`, transition: 'transform 0.35s ease' }}>
              {fotos.length > 0 ? fotos.map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={url} alt={familia} style={{ width: `${100 / fotos.length}%`, height: '100%', objectFit: 'cover', flexShrink: 0 }} />
              )) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="rgba(200,169,110,0.2)" strokeWidth="0.8">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                  </svg>
                </div>
              )}
            </div>

            {/* Flechas — solo desktop */}
            {fotos.length > 1 && (
              <>
                <button onClick={() => setFotoIdx(i => (i - 1 + fotos.length) % fotos.length)} className="galeria-arrow galeria-arrow-left">‹</button>
                <button onClick={() => setFotoIdx(i => (i + 1) % fotos.length)} className="galeria-arrow galeria-arrow-right">›</button>
              </>
            )}

            {/* Dots */}
            {fotos.length > 1 && (
              <div style={{ position: 'absolute', bottom: '10px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '5px' }}>
                {fotos.map((_, i) => (
                  <div key={i} onClick={() => setFotoIdx(i)} style={{
                    width: '6px', height: '6px', borderRadius: '50%', cursor: 'pointer',
                    background: i === fotoIdx ? 'var(--gold)' : 'rgba(255,255,255,0.3)',
                    transition: 'background 0.2s',
                  }} />
                ))}
              </div>
            )}

            {/* Contador */}
            {fotos.length > 1 && (
              <div style={{ position: 'absolute', top: '10px', left: '10px', background: 'rgba(0,0,0,0.6)', borderRadius: '4px', padding: '2px 8px', fontSize: '11px', color: '#fff' }}>
                {fotoIdx + 1} / {fotos.length}
              </div>
            )}

            {/* Botón eliminar foto (admin) */}
            {esAdmin && fotoActiva && (
              <button onClick={() => eliminarFoto(fotoActiva)} style={{
                position: 'absolute', top: '10px', right: '10px',
                background: 'rgba(180,0,0,0.8)', border: 'none', borderRadius: '6px',
                padding: '4px 8px', cursor: 'pointer', fontSize: '11px', color: '#fff',
              }}>✕ Eliminar</button>
            )}
          </div>

          {/* Miniaturas — solo desktop, ocultas en mobile */}
          {fotos.length > 1 && (
            <div className="miniaturas-desktop" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {fotos.map((url, i) => (
                <button key={i} onClick={() => setFotoIdx(i)} style={{
                  width: '64px', height: '64px', borderRadius: '8px', overflow: 'hidden', padding: 0, cursor: 'pointer',
                  border: `2px solid ${i === fotoIdx ? 'var(--gold)' : 'var(--border)'}`, flexShrink: 0,
                }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </button>
              ))}
            </div>
          )}

          {/* Botón subir fotos (admin) — acepta múltiples */}
          {esAdmin && (
            <label style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
              padding: '10px', borderRadius: '8px', cursor: 'pointer',
              background: 'rgba(200,169,110,0.1)', border: '1px dashed rgba(200,169,110,0.4)',
              fontSize: '13px', color: 'var(--gold)', opacity: subiendo ? 0.6 : 1,
            }}>
              <input type="file" accept="image/*" multiple style={{ display: 'none' }}
                onChange={e => { if (e.target.files?.length) subirFoto(e.target.files) }}
                disabled={subiendo}
              />
              {subiendo ? '⏳ Subiendo...' : '📷 Agregar fotos (podés seleccionar varias)'}
            </label>
          )}
        </div>

        {/* Columna derecha: info + variantes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {variantes[0]?.linea && (
            <span style={{ fontSize: '12px', color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>
              {variantes[0].linea}
            </span>
          )}

          <h1 style={{ fontFamily: 'var(--font-cormorant, serif)', fontSize: 'clamp(26px, 4vw, 40px)', fontWeight: 500, color: 'var(--text)', lineHeight: 1.2 }}>
            {familia}
          </h1>

          {variantes[0]?.marca && (
            <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Marca: {variantes[0].marca}</p>
          )}

          {seleccionada && (
            <div>
              <div style={{ fontSize: '11px', color: 'rgba(240,235,227,0.4)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>Efectivo / Transferencia</div>
              <div style={{ fontSize: '34px', fontWeight: 700, color: 'var(--gold)', lineHeight: 1 }}>
                {formatARS(seleccionada.precio_venta)}
              </div>
              <div style={{ fontSize: '13px', color: 'rgba(240,235,227,0.4)', marginTop: '6px' }}>
                Tarjeta: {formatARS(Math.round(seleccionada.precio_venta * (1 + recargo / 100)))}
              </div>
            </div>
          )}

          {/* Descripción — editable inline para admin */}
          {esAdmin ? (
            <div>
              {editandoDesc ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <textarea
                    rows={5}
                    value={descripcion}
                    onChange={e => setDescripcion(e.target.value)}
                    placeholder="Escribí la descripción del producto..."
                    style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(200,169,110,0.3)', borderRadius: '8px', padding: '12px', color: '#f0ebe3', fontSize: '14px', lineHeight: 1.7, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
                    autoFocus
                  />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={guardarDescripcion} disabled={guardandoDesc} style={{ padding: '7px 18px', borderRadius: '6px', background: '#c8a96e', color: '#000', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>
                      {guardandoDesc ? 'Guardando...' : 'Guardar'}
                    </button>
                    <button onClick={() => setEditandoDesc(false)} style={{ padding: '7px 18px', borderRadius: '6px', background: 'transparent', color: 'rgba(240,235,227,0.4)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontSize: '13px' }}>
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div onClick={() => setEditandoDesc(true)} style={{ cursor: 'text', minHeight: '48px', padding: '10px 12px', borderRadius: '8px', border: '1px dashed rgba(200,169,110,0.2)', transition: 'border-color 0.2s' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(200,169,110,0.45)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(200,169,110,0.2)')}
                >
                  {descripcion ? (
                    <p style={{ fontSize: '14px', color: 'rgba(240,235,227,0.6)', lineHeight: 1.8, whiteSpace: 'pre-wrap', margin: 0 }}>{descripcion}</p>
                  ) : (
                    <p style={{ fontSize: '13px', color: 'rgba(240,235,227,0.2)', fontStyle: 'italic', margin: 0 }}>✏️ Click para agregar descripción...</p>
                  )}
                </div>
              )}
            </div>
          ) : descripcion ? (
            <p style={{ fontSize: '14px', color: 'rgba(240,235,227,0.6)', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{descripcion}</p>
          ) : null}

          {/* Selector de aroma */}
          <div>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {(() => {
                const l = (variantes[0]?.linea ?? familia).toLowerCase()
                if (l.includes('sahumer') || l.includes('incien') || l.includes('fluido') || l.includes('aroma')) return `Elegí tu aroma — ${variantes.length} opciones disponibles`
                if (l.includes('vela') || l.includes('velón')) return `Elegí tu color — ${variantes.length} opciones`
                if (l.includes('cristal') || l.includes('piedra')) return `Elegí tu cristal — ${variantes.length} opciones`
                return `Elegí tu variante — ${variantes.length} opciones`
              })()}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {variantes.map(v => (
                <button key={v.id} onClick={() => elegirVariante(v)} disabled={v.stock === 0} style={{
                  padding: '7px 14px', borderRadius: '20px', fontSize: '13px', cursor: v.stock === 0 ? 'not-allowed' : 'pointer',
                  border: `1px solid ${seleccionada?.id === v.id ? 'var(--gold)' : 'var(--border)'}`,
                  background: seleccionada?.id === v.id ? 'rgba(200,169,110,0.15)' : 'transparent',
                  color: v.stock === 0 ? 'var(--text-muted)' : seleccionada?.id === v.id ? 'var(--gold)' : 'var(--text-secondary)',
                  opacity: v.stock === 0 ? 0.5 : 1, transition: 'all 0.15s',
                  textDecoration: v.stock === 0 ? 'line-through' : 'none',
                }}>
                  {v.fragancia ?? v.nombre}
                </button>
              ))}
            </div>
          </div>

          {seleccionada && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', display: 'inline-block', background: seleccionada.stock > 0 ? 'var(--success)' : 'var(--danger)' }} />
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                {seleccionada.stock > 0 ? `${seleccionada.stock} disponibles` : 'Sin stock'}
              </span>
            </div>
          )}

          {seleccionada && seleccionada.stock > 0 && (
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                <button onClick={() => setCantidad(q => Math.max(1, q - 1))} style={{ padding: '10px 16px', background: 'transparent', color: 'var(--text)', border: 'none', cursor: 'pointer', fontSize: '18px' }}>−</button>
                <span style={{ padding: '10px 16px', fontSize: '16px', fontWeight: 600, minWidth: '40px', textAlign: 'center' }}>{cantidad}</span>
                <button onClick={() => setCantidad(q => Math.min(seleccionada.stock, q + 1))} style={{ padding: '10px 16px', background: 'transparent', color: 'var(--text)', border: 'none', cursor: 'pointer', fontSize: '18px' }}>+</button>
              </div>
              <button onClick={agregarAlCarrito} style={{
                flex: 1, padding: '12px 24px', borderRadius: '8px', fontSize: '15px', fontWeight: 600,
                background: agregado ? 'var(--success)' : 'var(--gold)',
                color: '#000', border: 'none', cursor: 'pointer', transition: 'all 0.2s',
              }}>
                {agregado ? '✓ Agregado al carrito' : 'Agregar al carrito'}
              </button>
            </div>
          )}

          {seleccionada && seleccionada.stock === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', fontStyle: 'italic' }}>
              Esta variante no tiene stock. Elegí otra de la lista.
            </p>
          )}

          <Link href="/tienda/carrito" style={{ display: 'block', textAlign: 'center', padding: '12px', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '14px', textDecoration: 'none' }}>
            Ver carrito →
          </Link>
        </div>
      </div>

      <style>{`
        @media (max-width: 640px) {
          .familia-grid { grid-template-columns: 1fr !important; }
          .miniaturas-desktop { display: none !important; }
          .galeria-arrow { display: none !important; }
        }
        @media (min-width: 641px) {
          .galeria-arrow {
            position: absolute; top: 50%; transform: translateY(-50%);
            background: rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.2);
            border-radius: 50%; width: 36px; height: 36px; cursor: pointer;
            color: #fff; font-size: 18px; display: flex; align-items: center; justify-content: center;
          }
          .galeria-arrow-left { left: 10px; }
          .galeria-arrow-right { right: 10px; }
        }
      `}</style>
    </div>
  )
}