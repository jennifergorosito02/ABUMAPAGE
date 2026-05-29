'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
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
  imagen_url: string | null
}

function isVideo(url: string) {
  return /\.(mp4|mov|webm|avi|ogv)(\?|#|$)/i.test(url)
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

export default function ProductoPage() {
  const { id } = useParams()
  const supabase = createClient()
  const [producto, setProducto] = useState<Producto | null>(null)
  const [loading, setLoading] = useState(true)
  const [cantidad, setCantidad] = useState(1)
  const [agregado, setAgregado] = useState(false)
  const [esAdmin, setEsAdmin] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [fotos, setFotos] = useState<string[]>([])
  const [fotosNombres, setFotosNombres] = useState<string[]>([])
  const [fotoIdx, setFotoIdx] = useState(0)
  const [modoOrden, setModoOrden] = useState(false)
  const [ordenGuardado, setOrdenGuardado] = useState(false)
  const [dragIdx, setDragIdx] = useState<number | null>(null)

  const folderKey = `fotos-producto-${id}`

  useEffect(() => {
    supabase.auth.getUser().then(r => { if (r.data.user) setEsAdmin(true) })
  }, [])

  useEffect(() => {
    async function init() {
      const { data } = await supabase
        .from('productos')
        .select('id, nombre, linea, marca, fragancia, precio_venta, stock, imagen_url')
        .eq('id', id)
        .eq('activo', true)
        .single()
      if (data) {
        setProducto(data)
        await cargarFotos(data)
      }
      setLoading(false)
    }
    if (id) init()
  }, [id])

  async function cargarFotos(prod?: Producto) {
    const { data } = await supabase.storage.from('productos').list(folderKey, { limit: 50, sortBy: { column: 'created_at', order: 'asc' } })
    if (data && data.length > 0) {
      let archivos = data.filter((f: { name: string }) => f.name !== '.emptyFolderPlaceholder')
      if (archivos.length === 0) return

      const savedOrder = typeof window !== 'undefined' ? localStorage.getItem(`fotos-orden-${folderKey}`) : null
      if (savedOrder) {
        try {
          const names = JSON.parse(savedOrder) as string[]
          const ordenados = names.map(n => archivos.find((f: { name: string }) => f.name === n)).filter(Boolean)
          const inOrder = new Set(names)
          const nuevas = archivos.filter((f: { name: string }) => !inOrder.has(f.name))
          archivos = [...ordenados, ...nuevas]
        } catch {}
      }

      const nombres = archivos.map((f: { name: string }) => f.name)
      const urls = archivos.map((f: { name: string }) => supabase.storage.from('productos').getPublicUrl(`${folderKey}/${f.name}`).data.publicUrl)
      setFotos(urls)
      setFotosNombres(nombres)
      setFotoIdx(0)
      const p = prod ?? producto
      if (p && !p.imagen_url && urls[0]) {
        await supabase.from('productos').update({ imagen_url: urls[0] }).eq('id', p.id)
      }
    }
  }

  async function subirFotos(files: FileList) {
    setSubiendo(true)
    let primeraUrl: string | null = null
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop() ?? 'jpg'
      const path = `${folderKey}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const fd = new FormData()
      fd.append('file', file)
      fd.append('path', path)
      const res = await fetch('/api/upload-foto', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) { alert('Error al subir: ' + (json.error ?? 'Error desconocido')); setSubiendo(false); return }
      if (!primeraUrl) primeraUrl = json.url
    }
    if (primeraUrl && fotos.length === 0 && producto) {
      await supabase.from('productos').update({ imagen_url: primeraUrl }).eq('id', producto.id)
      setProducto(prev => prev ? { ...prev, imagen_url: primeraUrl } : prev)
    }
    await cargarFotos()
    setSubiendo(false)
  }

  async function subirVideo(files: FileList) {
    setSubiendo(true)
    let primeraUrl: string | null = null
    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop() ?? 'mp4'
      const path = `${folderKey}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const res = await fetch(`/api/upload-foto?path=${encodeURIComponent(path)}`)
      if (!res.ok) { const j = await res.json(); alert('Error al preparar upload: ' + j.error); setSubiendo(false); return }
      const { token } = await res.json()
      const { error } = await supabase.storage.from('productos').uploadToSignedUrl(path, token, file, { contentType: file.type })
      if (error) { alert('Error al subir video: ' + error.message); setSubiendo(false); return }
      if (!primeraUrl) primeraUrl = supabase.storage.from('productos').getPublicUrl(path).data.publicUrl
    }
    if (primeraUrl && fotos.length === 0 && producto) {
      await supabase.from('productos').update({ imagen_url: primeraUrl }).eq('id', producto.id)
      setProducto(prev => prev ? { ...prev, imagen_url: primeraUrl } : prev)
    }
    await cargarFotos()
    setSubiendo(false)
  }

  async function eliminarFoto(url: string) {
    if (!confirm('¿Eliminar este archivo?')) return
    const parts = url.split('/storage/v1/object/public/productos/')
    if (parts.length < 2) return
    const path = decodeURIComponent(parts[1])
    const res = await fetch('/api/upload-foto', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path }) })
    if (!res.ok) { const j = await res.json(); alert('Error: ' + j.error); return }
    await cargarFotos()
  }

  async function guardarOrden() {
    localStorage.setItem(`fotos-orden-${folderKey}`, JSON.stringify(fotosNombres))
    if (fotos[0] && producto) {
      await supabase.from('productos').update({ imagen_url: fotos[0] }).eq('id', producto.id)
    }
    setModoOrden(false)
    setOrdenGuardado(true)
    setTimeout(() => setOrdenGuardado(false), 2000)
  }

  function agregarAlCarrito() {
    if (!producto) return
    const c = getCarrito()
    c[producto.id] = (c[producto.id] ?? 0) + cantidad
    setCarritoStorage(c)
    setAgregado(true)
    setTimeout(() => setAgregado(false), 2000)
  }

  if (loading) return <div style={{ textAlign: 'center', padding: '80px', color: 'var(--text-muted)' }}>Cargando...</div>
  if (!producto) return (
    <div style={{ textAlign: 'center', padding: '80px' }}>
      <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>Producto no encontrado</p>
      <Link href="/tienda" style={{ color: 'var(--gold)' }}>← Volver a la tienda</Link>
    </div>
  )

  const fotoActiva = fotos[fotoIdx] ?? null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>
        <Link href="/tienda" style={{ color: 'var(--gold)' }}>Tienda</Link>
        <span>›</span>
        {producto.linea && <><span>{producto.linea}</span><span>›</span></>}
        <span style={{ color: 'var(--text)' }}>{producto.nombre}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }} className="producto-grid">

        {/* Galería */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{
            borderRadius: '16px', border: '1px solid var(--border)', overflow: 'hidden', aspectRatio: '1',
            background: 'linear-gradient(135deg, #1a1208 0%, #3d2a08 100%)', position: 'relative',
          }}
            onTouchStart={e => { (e.currentTarget as HTMLDivElement).dataset.touchX = String(e.touches[0].clientX) }}
            onTouchEnd={e => {
              const diff = Number((e.currentTarget as HTMLDivElement).dataset.touchX ?? 0) - e.changedTouches[0].clientX
              if (Math.abs(diff) > 40) setFotoIdx(i => diff > 0 ? (i + 1) % fotos.length : (i - 1 + fotos.length) % fotos.length)
            }}
          >
            <div style={{ display: 'flex', width: `${fotos.length * 100}%`, height: '100%', transform: `translateX(-${fotoIdx * (100 / fotos.length)}%)`, transition: 'transform 0.35s ease' }}>
              {fotos.length > 0 ? fotos.map((url, i) => (
                isVideo(url)
                  ? <video key={i} src={url} style={{ width: `${100 / fotos.length}%`, height: '100%', objectFit: 'cover', flexShrink: 0 }} controls playsInline />
                  // eslint-disable-next-line @next/next/no-img-element
                  : <img key={i} src={url} alt={producto.nombre} style={{ width: `${100 / fotos.length}%`, height: '100%', objectFit: 'cover', flexShrink: 0 }} />
              )) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="rgba(200,169,110,0.2)" strokeWidth="0.8">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                  </svg>
                </div>
              )}
            </div>
            {fotos.length > 1 && (
              <>
                <button onClick={() => setFotoIdx(i => (i - 1 + fotos.length) % fotos.length)} className="galeria-arrow galeria-arrow-left">‹</button>
                <button onClick={() => setFotoIdx(i => (i + 1) % fotos.length)} className="galeria-arrow galeria-arrow-right">›</button>
                <div style={{ position: 'absolute', bottom: '10px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '5px' }}>
                  {fotos.map((_, i) => <div key={i} onClick={() => setFotoIdx(i)} style={{ width: '6px', height: '6px', borderRadius: '50%', cursor: 'pointer', background: i === fotoIdx ? 'var(--gold)' : 'rgba(255,255,255,0.3)' }} />)}
                </div>
                <div style={{ position: 'absolute', top: '10px', left: '10px', background: 'rgba(0,0,0,0.6)', borderRadius: '4px', padding: '2px 8px', fontSize: '11px', color: '#fff' }}>
                  {fotoIdx + 1} / {fotos.length}
                </div>
              </>
            )}
            {esAdmin && fotoActiva && (
              <button onClick={() => eliminarFoto(fotoActiva)} style={{ position: 'absolute', top: '10px', right: '10px', background: 'rgba(180,0,0,0.8)', border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', fontSize: '11px', color: '#fff' }}>✕ Eliminar</button>
            )}
          </div>

          {/* Miniaturas */}
          {fotos.length > 1 && !modoOrden && (
            <div className="miniaturas-desktop" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {fotos.map((url, i) => (
                <button key={i} onClick={() => setFotoIdx(i)} style={{ width: '64px', height: '64px', borderRadius: '8px', overflow: 'hidden', padding: 0, cursor: 'pointer', border: `2px solid ${i === fotoIdx ? 'var(--gold)' : 'var(--border)'}`, flexShrink: 0, position: 'relative' }}>
                  {isVideo(url) ? (
                    <>
                      <video src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)', color: '#fff', fontSize: '20px' }}>▶</div>
                    </>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Panel reorden */}
          {modoOrden && (
            <div style={{ background: 'rgba(200,169,110,0.05)', border: '1px solid rgba(200,169,110,0.25)', borderRadius: '12px', padding: '14px' }}>
              <p style={{ fontSize: '11px', color: 'rgba(200,169,110,0.6)', marginBottom: '12px', textAlign: 'center', letterSpacing: '0.06em' }}>
                ARRASTRÁ LAS FOTOS PARA ORDENARLAS · LA N°1 SERÁ LA PORTADA
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '8px' }}>
                {fotos.map((url, i) => (
                  <div key={i} draggable
                    onDragStart={() => setDragIdx(i)}
                    onDragOver={e => {
                      e.preventDefault()
                      if (dragIdx === null || dragIdx === i) return
                      const f = [...fotos], n = [...fotosNombres]
                      ;[f[dragIdx], f[i]] = [f[i], f[dragIdx]]
                      ;[n[dragIdx], n[i]] = [n[i], n[dragIdx]]
                      setFotos(f); setFotosNombres(n); setDragIdx(i)
                    }}
                    onDragEnd={() => setDragIdx(null)}
                    style={{ borderRadius: '10px', overflow: 'hidden', position: 'relative', cursor: 'grab', border: i === 0 ? '2px solid var(--gold)' : '2px solid rgba(255,255,255,0.08)', opacity: dragIdx === i ? 0.3 : 1 }}
                  >
                    {isVideo(url) ? (
                      <div style={{ width: '100%', aspectRatio: '1', position: 'relative', background: '#111', display: 'block' }}>
                        <video src={url} style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '24px', pointerEvents: 'none' }}>▶</div>
                      </div>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={url} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block', pointerEvents: 'none' }} />
                    )}
                    <div style={{ position: 'absolute', top: '5px', left: '5px', background: i === 0 ? 'var(--gold)' : 'rgba(0,0,0,0.75)', color: i === 0 ? '#000' : '#fff', borderRadius: '50%', width: '20px', height: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, pointerEvents: 'none' }}>{i + 1}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button onClick={() => { setModoOrden(false); setFotoIdx(0) }} style={{ flex: 1, padding: '10px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(240,235,227,0.4)' }}>Cancelar</button>
                <button onClick={guardarOrden} style={{ flex: 2, padding: '10px', borderRadius: '8px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', background: ordenGuardado ? 'rgba(80,200,120,0.2)' : '#c8a96e', border: 'none', color: ordenGuardado ? '#50c878' : '#000' }}>
                  {ordenGuardado ? '✓ Guardado' : 'Guardar orden'}
                </button>
              </div>
            </div>
          )}

          {/* Botones admin */}
          {esAdmin && !modoOrden && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px', borderRadius: '8px', cursor: 'pointer', background: 'rgba(200,169,110,0.1)', border: '1px dashed rgba(200,169,110,0.4)', fontSize: '13px', color: 'var(--gold)', opacity: subiendo ? 0.6 : 1 }}>
                <input type="file" accept="image/*" multiple style={{ display: 'none' }}
                  onChange={e => { if (e.target.files?.length) subirFotos(e.target.files) }}
                  disabled={subiendo}
                />
                {subiendo ? '⏳ Subiendo...' : '📷 Agregar fotos (podés seleccionar varias)'}
              </label>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '10px', borderRadius: '8px', cursor: 'pointer', background: 'rgba(200,169,110,0.1)', border: '1px dashed rgba(200,169,110,0.4)', fontSize: '13px', color: 'var(--gold)', opacity: subiendo ? 0.6 : 1 }}>
                <input type="file" accept="video/mp4,video/quicktime,video/webm,video/avi" multiple style={{ display: 'none' }}
                  onChange={e => { if (e.target.files?.length) subirVideo(e.target.files) }}
                  disabled={subiendo}
                />
                {subiendo ? '⏳ Subiendo...' : '🎥 Agregar video'}
              </label>
              {fotos.length > 1 && (
                <button onClick={() => { setModoOrden(true); setFotoIdx(0) }} style={{ padding: '10px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', background: 'rgba(200,169,110,0.08)', border: '1px solid rgba(200,169,110,0.35)', color: 'var(--gold)', width: '100%', fontWeight: 600 }}>
                  ↕ Reordenar fotos
                </button>
              )}
            </div>
          )}
        </div>

        {/* Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {producto.linea && (
            <span style={{ fontSize: '12px', color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{producto.linea}</span>
          )}
          <h1 style={{ fontFamily: 'var(--font-cormorant, serif)', fontSize: 'clamp(24px, 4vw, 36px)', fontWeight: 500, color: 'var(--text)', lineHeight: 1.2 }}>
            {producto.nombre}
          </h1>
          {producto.marca && <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Marca: {producto.marca}</p>}
          {producto.fragancia && <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Fragancia: {producto.fragancia}</p>}

          <div style={{ fontSize: '32px', fontWeight: 700, color: 'var(--gold)' }}>
            {formatARS(Math.round(producto.precio_venta * 1.20))}
          </div>
          <div style={{ fontSize: '12px', color: '#5ecb8a', fontWeight: 600, letterSpacing: '0.03em' }}>
            10% OFF pagando con Transferencia o QR
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: producto.stock > 0 ? 'var(--success)' : 'var(--danger)' }} />
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{producto.stock > 0 ? `${producto.stock} disponibles` : 'Sin stock'}</span>
          </div>

          {producto.stock > 0 && (
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
                <button onClick={() => setCantidad(q => Math.max(1, q - 1))} style={{ padding: '10px 16px', background: 'transparent', color: 'var(--text)', border: 'none', cursor: 'pointer', fontSize: '18px' }}>−</button>
                <span style={{ padding: '10px 16px', fontSize: '16px', fontWeight: 600, minWidth: '40px', textAlign: 'center' }}>{cantidad}</span>
                <button onClick={() => setCantidad(q => Math.min(producto.stock, q + 1))} style={{ padding: '10px 16px', background: 'transparent', color: 'var(--text)', border: 'none', cursor: 'pointer', fontSize: '18px' }}>+</button>
              </div>
              <button onClick={agregarAlCarrito} style={{ flex: 1, padding: '12px 24px', borderRadius: '8px', fontSize: '15px', fontWeight: 600, background: agregado ? 'var(--success)' : 'var(--gold)', color: '#000', border: 'none', cursor: 'pointer', transition: 'all 0.2s' }}>
                {agregado ? '✓ Agregado al carrito' : 'Agregar al carrito'}
              </button>
            </div>
          )}

          <Link href="/tienda/carrito" style={{ display: 'block', textAlign: 'center', padding: '12px', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '14px', textDecoration: 'none' }}>
            Ver carrito →
          </Link>
        </div>
      </div>

      <style>{`
        @media (max-width: 640px) {
          .producto-grid { grid-template-columns: 1fr !important; }
          .miniaturas-desktop { display: none !important; }
          .galeria-arrow { display: none !important; }
        }
        @media (min-width: 641px) {
          .galeria-arrow { position: absolute; top: 50%; transform: translateY(-50%); background: rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.2); border-radius: 50%; width: 36px; height: 36px; cursor: pointer; color: #fff; font-size: 18px; display: flex; align-items: center; justify-content: center; }
          .galeria-arrow-left { left: 10px; }
          .galeria-arrow-right { right: 10px; }
        }
      `}</style>
    </div>
  )
}