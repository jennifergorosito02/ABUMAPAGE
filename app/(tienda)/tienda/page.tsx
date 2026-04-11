'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef } from 'react'
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
  familia: string | null
}

interface FamiliaCard {
  familia: string
  linea: string | null
  imagen_url: string | null
  count: number
  precio_desde: number
  hay_stock: boolean
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

function getLineGradient(linea: string | null): string {
  if (!linea) return 'linear-gradient(135deg, #1a1020 0%, #2d1f10 100%)'
  const l = linea.toLowerCase()
  if (l.includes('sahumer') || l.includes('inciens')) return 'linear-gradient(135deg, #1a1208 0%, #3d2a08 100%)'
  if (l.includes('vela') || l.includes('velón')) return 'linear-gradient(135deg, #12081a 0%, #2a1040 100%)'
  if (l.includes('aroma')) return 'linear-gradient(135deg, #081a12 0%, #103020 100%)'
  if (l.includes('cristal') || l.includes('piedra')) return 'linear-gradient(135deg, #081218 0%, #0f2030 100%)'
  return 'linear-gradient(135deg, #1a1020 0%, #2d1f10 100%)'
}

// Hook para animación al scroll
function useReveal() {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    // Fallback: si el observer no dispara en 800ms (frecuente en mobile), forzar visible
    const fallback = setTimeout(() => setVisible(true), 800)
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setVisible(true); obs.disconnect(); clearTimeout(fallback) } },
      { threshold: 0, rootMargin: '0px 0px 120px 0px' }
    )
    obs.observe(el)
    return () => { obs.disconnect(); clearTimeout(fallback) }
  }, [])
  return { ref, visible }
}

function RevealDiv({ children, delay = 0, style = {} }: { children: React.ReactNode; delay?: number; style?: React.CSSProperties }) {
  const { ref, visible } = useReveal()
  return (
    <div ref={ref} style={{
      ...style,
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(24px)',
      transition: `opacity 0.6s ease ${delay}ms, transform 0.6s ease ${delay}ms`,
    }}>
      {children}
    </div>
  )
}

// Las fotos del hero se cargan desde el bucket 'tienda' en Supabase Storage

export default function TiendaPage() {
  const supabase = createClient()
  const [productos, setProductos] = useState<Producto[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterMarca, setFilterMarca] = useState('')
  const [agregados, setAgregados] = useState<Record<number, boolean>>({})
  const [error, setError] = useState('')
  const [esAdmin, setEsAdmin] = useState(false)
  const [subiendoFoto, setSubiendoFoto] = useState<string | null>(null)
  const [heroFotos, setHeroFotos] = useState<string[]>([])
  const [marcaLogos, setMarcaLogos] = useState<Record<string, string>>({})
  const [heroVideo, setHeroVideo] = useState<string | null>(null)
  const [recargo, setRecargo] = useState(20)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    v.muted = true
    v.setAttribute('playsinline', '')
    v.setAttribute('webkit-playsinline', '')
    v.load()
    const tryPlay = () => { v.muted = true; v.play().catch(() => {}) }
    v.addEventListener('loadedmetadata', tryPlay, { once: true })
    v.addEventListener('canplay', tryPlay, { once: true })
    tryPlay()
  }, [heroVideo])

  // Cargar archivos del bucket 'tienda' — separa videos de fotos
  useEffect(() => {
    supabase.storage.from('tienda').list('', { limit: 30, sortBy: { column: 'created_at', order: 'asc' } })
      .then(({ data }) => {
        if (!data) return
        const archivos = data.filter((f: { name: string }) => f.name !== '.emptyFolderPlaceholder')
        const videos = archivos.filter((f: { name: string }) => f.name.endsWith('.mp4') || f.name.endsWith('.webm') || f.name.endsWith('.mov'))
        const fotos = archivos.filter((f: { name: string }) => !f.name.endsWith('.mp4') && !f.name.endsWith('.webm') && !f.name.endsWith('.mov'))
        if (videos.length > 0) {
          setHeroVideo(supabase.storage.from('tienda').getPublicUrl(videos[0].name).data.publicUrl)
        }
        const urls = fotos.map((f: { name: string }) => supabase.storage.from('tienda').getPublicUrl(f.name).data.publicUrl)
        if (urls.length > 0) setHeroFotos(urls)
      })
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => { if (data.user) setEsAdmin(true) })
  }, [])

  // Cargar logos de marcas desde productos/marca-logos/
  async function fetchMarcaLogos() {
    const { data } = await supabase.storage.from('productos').list('marca-logos', { limit: 50 })
    if (!data) return
    const logos: Record<string, string> = {}
    for (const f of data) {
      if (f.name === '.emptyFolderPlaceholder') continue
      const slug = f.name.replace(/\.[^.]+$/, '') // quitar extensión
      logos[slug] = supabase.storage.from('productos').getPublicUrl(`marca-logos/${f.name}`).data.publicUrl
    }
    setMarcaLogos(logos)
  }

  useEffect(() => { fetchMarcaLogos() }, [])

  useEffect(() => {
    supabase.from('configuracion').select('recargo_tarjeta').eq('id', 1).single()
      .then(({ data }) => { if (data?.recargo_tarjeta != null) setRecargo(Number(data.recargo_tarjeta)) })
  }, [])

  function slugMarca(marca: string) {
    return marca.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/gi, '').replace(/\s+/g, '-').toLowerCase()
  }

  async function subirLogoMarca(marca: string, file: File) {
    setSubiendoFoto(`logo-${marca}`)
    const ext = file.name.split('.').pop()
    const path = `marca-logos/${slugMarca(marca)}.${ext}`
    await supabase.storage.from('productos').upload(path, file, { upsert: true })
    await fetchMarcaLogos()
    setSubiendoFoto(null)
  }

  async function eliminarLogoMarca(marca: string) {
    const logoUrl = marcaLogos[slugMarca(marca)]
    if (!logoUrl) return
    const parts = logoUrl.split('/marca-logos/')
    if (parts.length < 2) return
    const filename = parts[1].split('?')[0]
    await supabase.storage.from('productos').remove([`marca-logos/${filename}`])
    await fetchMarcaLogos()
  }

  async function subirFotoFamilia(familia: string, file: File) {
    setSubiendoFoto(familia)
    const ext = file.name.split('.').pop()
    const path = `familia-${familia.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/gi, '').replace(/\s+/g, '-').toLowerCase()}.${ext}`
    const { error: upErr } = await supabase.storage.from('productos').upload(path, file, { upsert: true })
    if (upErr) { setSubiendoFoto(null); return }
    const { data: { publicUrl } } = supabase.storage.from('productos').getPublicUrl(path)
    await supabase.from('productos').update({ imagen_url: publicUrl }).eq('familia', familia)
    setProductos(prev => prev.map(p => p.familia === familia ? { ...p, imagen_url: publicUrl } : p))
    setSubiendoFoto(null)
  }

  async function subirFotoProducto(id: number, file: File) {
    setSubiendoFoto(`p-${id}`)
    const ext = file.name.split('.').pop()
    const path = `${id}.${ext}`
    const { error: upErr } = await supabase.storage.from('productos').upload(path, file, { upsert: true })
    if (upErr) { setSubiendoFoto(null); return }
    const { data: { publicUrl } } = supabase.storage.from('productos').getPublicUrl(path)
    await supabase.from('productos').update({ imagen_url: publicUrl }).eq('id', id)
    setProductos(prev => prev.map(p => p.id === id ? { ...p, imagen_url: publicUrl } : p))
    setSubiendoFoto(null)
  }

  useEffect(() => {
    async function fetchProductos() {
      const { data, error: err } = await supabase
        .from('productos')
        .select('id, nombre, linea, marca, fragancia, precio_venta, stock, imagen_url, familia')
        .eq('activo', true)
        .eq('en_tienda', true)
        .order('linea').order('nombre')
      if (err) { setError(err.message); setLoading(false); return }
      setProductos(data ?? [])
      setLoading(false)
    }
    fetchProductos()
  }, [])

  const filtrados = productos.filter(p => {
    const q = search.toLowerCase()
    const matchSearch = !q || p.nombre.toLowerCase().includes(q) || (p.marca ?? '').toLowerCase().includes(q) || (p.fragancia ?? '').toLowerCase().includes(q) || (p.familia ?? '').toLowerCase().includes(q)
    const matchMarca = !filterMarca || p.marca === filterMarca
    return matchSearch && matchMarca
  })

  // Agrupar por familia
  const familias: FamiliaCard[] = []
  const familiasVistas = new Set<string>()
  const individuales: Producto[] = []
  for (const p of filtrados) {
    if (p.familia) {
      if (!familiasVistas.has(p.familia)) {
        familiasVistas.add(p.familia)
        const variantes = filtrados.filter(x => x.familia === p.familia)
        familias.push({
          familia: p.familia, linea: p.linea,
          imagen_url: variantes.find(v => v.imagen_url)?.imagen_url ?? null,
          count: variantes.length,
          precio_desde: Math.min(...variantes.map(v => v.precio_venta)),
          hay_stock: variantes.some(v => v.stock > 0),
        })
      }
    } else {
      individuales.push(p)
    }
  }
  const cards = [...familias.map(f => ({ tipo: 'familia' as const, data: f })), ...individuales.map(p => ({ tipo: 'producto' as const, data: p }))]

  const marcas = [...new Set(productos.map(p => p.marca).filter(Boolean))].sort() as string[]
  const hayFiltros = !!search || !!filterMarca

  function agregarAlCarrito(p: Producto) {
    const c = getCarrito()
    c[p.id] = (c[p.id] ?? 0) + 1
    setCarritoStorage(c)
    setAgregados(prev => ({ ...prev, [p.id]: true }))
    setTimeout(() => setAgregados(prev => ({ ...prev, [p.id]: false })), 1500)
  }

  return (
    <div style={{ background: '#050407', minHeight: '100vh' }}>

      {/* BARRA ADMIN */}
      {esAdmin && (
        <div style={{
          background: 'rgba(200,169,110,0.08)', borderBottom: '1px solid rgba(200,169,110,0.2)',
          padding: '10px 32px', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px',
        }}>
          <span style={{ color: 'rgba(200,169,110,0.7)' }}>🔐 Modo admin</span>
          <span style={{ color: 'rgba(240,235,227,0.3)' }}>—</span>
          <span style={{ color: 'rgba(240,235,227,0.4)' }}>Cada tarjeta tiene botón <strong style={{ color: '#c8a96e' }}>📷 Foto</strong></span>
          <a href="/dashboard" style={{ marginLeft: 'auto', color: '#c8a96e', fontSize: '12px', textDecoration: 'none', border: '1px solid rgba(200,169,110,0.3)', borderRadius: '6px', padding: '4px 12px' }}>
            Ir al sistema →
          </a>
        </div>
      )}

      {/* HERO — imagen sahumador con humo animado */}
      <div style={{
        position: 'relative', minHeight: '100vh',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        {/* IMAGEN FALLBACK — siempre visible, video se superpone encima en desktop */}
        {heroFotos[0] && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={heroFotos[0]} alt="" style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: 'center center',
            opacity: 0.65, pointerEvents: 'none',
          }} />
        )}
        {/* VIDEO DE FONDO — .play() forzado por JS cuando el src está listo */}
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          src={heroVideo ?? undefined}
          loop playsInline preload="auto"
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: 'center',
            opacity: heroVideo ? 0.75 : 0, pointerEvents: 'none',
          }}
        />
        {/* Overlay oscuro degradado */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(5,4,7,0.5) 0%, rgba(5,4,7,0.15) 40%, rgba(5,4,7,0.88) 100%)' }} />
        {/* Viñeta dorada sutil */}
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(200,169,110,0.07) 0%, transparent 65%)', pointerEvents: 'none' }} />

        {/* Contenido hero — todo compacto, una sola capa */}
        <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', padding: '0 20px', maxWidth: '680px', width: '100%' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-symbol.png" alt="ABUMA.MA" style={{ width: 'clamp(220px, 30vw, 420px)', height: 'clamp(220px, 30vw, 420px)', objectFit: 'contain', display: 'block', margin: '0 auto 0' }} />

          <div style={{ fontSize: '10px', letterSpacing: '0.3em', color: 'rgba(200,169,110,0.65)', textTransform: 'uppercase', marginBottom: '4px' }}>
            Tienda Holística · Argentina
          </div>

          <h1 style={{
            fontFamily: 'var(--font-cormorant, serif)',
            fontSize: 'clamp(40px, 9vw, 90px)',
            fontWeight: 700,
            lineHeight: 0.95,
            letterSpacing: '-0.02em',
            color: '#f0ebe3',
            marginBottom: '10px',
          }}>
            ABUMA<span style={{ color: '#c8a96e' }}>.MA</span>
          </h1>

          <p style={{ fontSize: 'clamp(13px, 1.8vw, 16px)', color: 'rgba(240,235,227,0.45)', maxWidth: '420px', margin: '0 auto 20px', lineHeight: 1.6, letterSpacing: '0.02em' }}>
            Productos naturales para tu bienestar, espiritualidad y energía
          </p>

          {/* Buscador */}
          <div style={{ position: 'relative', maxWidth: '460px', margin: '0 auto 16px' }}>
            <svg style={{ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c8a96e" strokeWidth="2">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscá sahumerios, velas, cristales..."
              style={{
                width: '100%', padding: '13px 18px 13px 46px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(200,169,110,0.2)',
                borderRadius: '100px', fontSize: '14px',
                color: '#f0ebe3', outline: 'none',
                backdropFilter: 'blur(20px)',
                transition: 'border-color 0.2s',
                boxSizing: 'border-box',
              }}
              onFocus={e => (e.target.style.borderColor = 'rgba(200,169,110,0.5)')}
              onBlur={e => (e.target.style.borderColor = 'rgba(200,169,110,0.2)')}
            />
          </div>

          <a href="#productos" style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '12px 28px', borderRadius: '100px',
            background: '#c8a96e', color: '#050407',
            fontSize: '13px', fontWeight: 700, letterSpacing: '0.08em', textDecoration: 'none',
            transition: 'all 0.2s', textTransform: 'uppercase',
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#dbb97e'; (e.currentTarget as HTMLAnchorElement).style.transform = 'scale(1.03)' }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = '#c8a96e'; (e.currentTarget as HTMLAnchorElement).style.transform = 'scale(1)' }}
          >
            Ver productos
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
          </a>
        </div>
      </div>

      {/* SECCIÓN VELAS — imagen estática debajo del hero */}
      {heroFotos[1] && (
        <div style={{ position: 'relative', height: '65vh', overflow: 'hidden' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={heroFotos[1]} alt="" style={{
            width: '100%', height: '100%', objectFit: 'cover',
            objectPosition: 'center 60%',
          }} />
          {/* Overlay arriba y abajo para integrar con el fondo oscuro */}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(5,4,7,0.7) 0%, rgba(5,4,7,0.1) 30%, rgba(5,4,7,0.1) 70%, rgba(5,4,7,0.8) 100%)' }} />
          {/* Texto centrado opcional */}
          <div style={{
            position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 24px',
          }}>
            <div style={{ fontSize: '10px', letterSpacing: '0.35em', color: 'rgba(200,169,110,0.55)', textTransform: 'uppercase', marginBottom: '12px' }}>
              Luz · Aroma · Energía
            </div>
            <p style={{
              fontFamily: 'var(--font-cormorant, serif)',
              fontSize: 'clamp(28px, 5vw, 56px)',
              fontWeight: 400,
              color: 'rgba(240,235,227,0.88)',
              letterSpacing: '0.04em',
              lineHeight: 1.3,
              maxWidth: '640px',
            }}>
              Cada llama es un ritual
            </p>
          </div>
        </div>
      )}

      {/* MARCAS */}
      {!hayFiltros && marcas.length > 0 && (
        <div style={{ padding: '100px 32px 60px', maxWidth: '1280px', margin: '0 auto' }}>
          <RevealDiv>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '48px' }}>
              <div style={{ flex: 1, height: '1px', background: 'rgba(200,169,110,0.12)' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '10px', letterSpacing: '0.3em', color: 'rgba(200,169,110,0.5)', textTransform: 'uppercase', marginBottom: '8px' }}>Explorá por</div>
                <h2 style={{ fontFamily: 'var(--font-cormorant, serif)', fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 600, color: '#f0ebe3', letterSpacing: '-0.01em' }}>Nuestras Marcas</h2>
              </div>
              <div style={{ flex: 1, height: '1px', background: 'rgba(200,169,110,0.12)' }} />
            </div>
          </RevealDiv>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' }}>
            {marcas.map((marca, i) => {
              const count = productos.filter(p => p.marca === marca).length
              const logoUrl = marcaLogos[slugMarca(marca)]
              return (
                <RevealDiv key={marca} delay={i * 60} style={{ position: 'relative' }}>
                  <button onClick={() => setFilterMarca(filterMarca === marca ? '' : marca)} style={{
                    width: '100%', padding: logoUrl ? '16px' : '24px 20px', borderRadius: '16px', cursor: 'pointer',
                    background: filterMarca === marca ? 'rgba(200,169,110,0.12)' : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${filterMarca === marca ? 'rgba(200,169,110,0.4)' : 'rgba(255,255,255,0.06)'}`,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
                    transition: 'all 0.2s', textAlign: 'center',
                  }}
                    onMouseEnter={e => { if (filterMarca !== marca) { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(200,169,110,0.06)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(200,169,110,0.2)'; (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)' } }}
                    onMouseLeave={e => { if (filterMarca !== marca) { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.02)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)' } }}
                  >
                    {logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logoUrl} alt={marca} style={{ width: '100%', height: '80px', objectFit: 'contain', mixBlendMode: 'lighten', opacity: filterMarca === marca ? 1 : 0.85 }} />
                    ) : (
                      <div style={{ fontSize: '15px', fontWeight: 600, color: filterMarca === marca ? '#c8a96e' : '#f0ebe3', letterSpacing: '0.02em' }}>{marca}</div>
                    )}
                    <div style={{ fontSize: '11px', color: 'rgba(240,235,227,0.3)', letterSpacing: '0.05em' }}>{count} productos</div>
                  </button>
                  {/* Botones admin */}
                  {esAdmin && (
                    <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', gap: '4px' }}>
                      {logoUrl && (
                        <button onClick={() => eliminarLogoMarca(marca)} style={{
                          background: 'rgba(180,0,0,0.8)', border: 'none',
                          borderRadius: '6px', padding: '3px 7px', cursor: 'pointer',
                          fontSize: '11px', color: '#fff',
                        }}>✕</button>
                      )}
                      <label style={{
                        background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(200,169,110,0.3)',
                        borderRadius: '6px', padding: '3px 7px', cursor: 'pointer',
                        fontSize: '11px', color: '#c8a96e',
                        opacity: subiendoFoto === `logo-${marca}` ? 0.5 : 1,
                      }}>
                        <input type="file" accept="image/*" style={{ display: 'none' }}
                          onChange={e => { const f = e.target.files?.[0]; if (f) subirLogoMarca(marca, f) }}
                        />
                        {subiendoFoto === `logo-${marca}` ? '⏳' : '📷'}
                      </label>
                    </div>
                  )}
                </RevealDiv>
              )
            })}
          </div>
        </div>
      )}

      {/* SEPARADOR FOTO */}
      {!hayFiltros && (
        <div style={{ position: 'relative', height: '280px', overflow: 'hidden', margin: '0' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={heroFotos[1] ?? heroFotos[0] ?? ''} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 40%', filter: 'brightness(0.35) saturate(0.8)' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(5,4,7,1) 0%, transparent 30%, transparent 70%, rgba(5,4,7,1) 100%)' }} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px' }}>
            <div style={{ width: '40px', height: '1px', background: 'rgba(200,169,110,0.4)' }} />
            <p style={{ fontFamily: 'var(--font-cormorant, serif)', fontSize: 'clamp(20px, 3vw, 32px)', color: 'rgba(240,235,227,0.7)', letterSpacing: '0.15em', textAlign: 'center', fontStyle: 'italic' }}>
              "Conectá con tu energía interior"
            </p>
            <div style={{ width: '40px', height: '1px', background: 'rgba(200,169,110,0.4)' }} />
          </div>
        </div>
      )}

      {/* PRODUCTOS */}
      <div id="productos" style={{ padding: '80px 32px 120px', maxWidth: '1280px', margin: '0 auto' }}>

        {/* Header sección */}
        <RevealDiv style={{ marginBottom: '48px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {hayFiltros && (
                <button onClick={() => { setSearch(''); setFilterMarca('') }} style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '6px 14px', borderRadius: '100px', cursor: 'pointer',
                  background: 'rgba(200,169,110,0.1)', border: '1px solid rgba(200,169,110,0.3)',
                  color: '#c8a96e', fontSize: '12px', letterSpacing: '0.05em',
                }}>
                  ← Todos
                </button>
              )}
              {filterMarca && (
                <div style={{ fontSize: '11px', letterSpacing: '0.2em', color: 'rgba(200,169,110,0.6)', textTransform: 'uppercase' }}>
                  {filterMarca}
                </div>
              )}
            </div>
            {!loading && (
              <div style={{ fontSize: '12px', color: 'rgba(240,235,227,0.25)', letterSpacing: '0.1em' }}>
                {cards.length} {cards.length === 1 ? 'PRODUCTO' : 'PRODUCTOS'}
              </div>
            )}
          </div>
        </RevealDiv>

        {error && <div style={{ color: '#e05c5c', padding: '16px', borderRadius: '8px', background: 'rgba(224,92,92,0.1)', marginBottom: '24px' }}>{error}</div>}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '120px 0', color: 'rgba(240,235,227,0.2)', fontSize: '14px', letterSpacing: '0.2em' }}>CARGANDO...</div>
        ) : cards.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '120px 0' }}>
            <p style={{ color: 'rgba(240,235,227,0.3)', marginBottom: '20px', letterSpacing: '0.1em' }}>SIN RESULTADOS</p>
            <button onClick={() => { setSearch(''); setFilterMarca('') }} style={{ color: '#c8a96e', background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', letterSpacing: '0.05em' }}>Limpiar filtros</button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '16px' }}>
            {cards.map((card, i) => {
              if (card.tipo === 'familia') {
                const f = card.data as FamiliaCard
                return (
                  <RevealDiv key={`f-${f.familia}`} delay={(i % 8) * 50}>
                    <div style={{ borderRadius: '20px', overflow: 'hidden', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', transition: 'all 0.3s', height: '100%' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(200,169,110,0.25)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 20px 60px rgba(0,0,0,0.4)' }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none' }}
                    >
                      {/* Imagen */}
                      <Link href={`/tienda/familia/${encodeURIComponent(f.familia)}`} style={{ textDecoration: 'none', display: 'block' }}>
                        <div style={{ height: '220px', background: getLineGradient(f.linea), position: 'relative', overflow: 'hidden' }}>
                          {f.imagen_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={f.imagen_url} alt={f.familia} style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.5s ease' }}
                              onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.05)')}
                              onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                            />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(200,169,110,0.15)" strokeWidth="0.8">
                                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                              </svg>
                            </div>
                          )}
                          <div style={{ position: 'absolute', top: '12px', left: '12px', background: 'rgba(200,169,110,0.9)', borderRadius: '100px', padding: '3px 10px', fontSize: '10px', color: '#050407', fontWeight: 700, letterSpacing: '0.08em' }}>
                            {f.count} AROMAS
                          </div>
                          {!f.hay_stock && (
                            <div style={{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(0,0,0,0.7)', borderRadius: '100px', padding: '3px 10px', fontSize: '10px', color: 'rgba(240,235,227,0.5)' }}>Sin stock</div>
                          )}
                        </div>
                      </Link>
                      {/* Info */}
                      <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                        {f.linea && <span style={{ fontSize: '9px', color: 'rgba(200,169,110,0.5)', textTransform: 'uppercase', letterSpacing: '0.18em' }}>{f.linea}</span>}
                        <Link href={`/tienda/familia/${encodeURIComponent(f.familia)}`} style={{ textDecoration: 'none' }}>
                          <div style={{ fontWeight: 600, fontSize: '14px', color: '#f0ebe3', lineHeight: 1.3 }}>{f.familia}</div>
                        </Link>
                        <div style={{ marginTop: 'auto', paddingTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ fontSize: '10px', color: 'rgba(240,235,227,0.3)', letterSpacing: '0.08em', marginBottom: '2px' }}>DESDE</div>
                            <div style={{ fontSize: '17px', fontWeight: 700, color: '#c8a96e' }}>{formatARS(f.precio_desde)}</div>
                          </div>
                          {esAdmin ? (
                            <label style={{ background: 'rgba(200,169,110,0.1)', border: '1px solid rgba(200,169,110,0.3)', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '11px', color: '#c8a96e', display: 'flex', alignItems: 'center', gap: '4px', opacity: subiendoFoto === f.familia ? 0.5 : 1 }}>
                              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const file = e.target.files?.[0]; if (file) subirFotoFamilia(f.familia, file) }} disabled={subiendoFoto === f.familia} />
                              {subiendoFoto === f.familia ? '...' : '📷'}
                            </label>
                          ) : (
                            <Link href={`/tienda/familia/${encodeURIComponent(f.familia)}`} style={{ fontSize: '12px', color: 'rgba(200,169,110,0.7)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px', letterSpacing: '0.05em' }}>
                              Ver →
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  </RevealDiv>
                )
              }

              const p = card.data as Producto
              return (
                <RevealDiv key={`p-${p.id}`} delay={(i % 8) * 50}>
                  <div style={{ borderRadius: '20px', overflow: 'hidden', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', transition: 'all 0.3s', height: '100%' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(200,169,110,0.25)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 20px 60px rgba(0,0,0,0.4)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none' }}
                  >
                    <Link href={`/tienda/producto/${p.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                      <div style={{ height: '220px', background: getLineGradient(p.linea), position: 'relative', overflow: 'hidden' }}>
                        {p.imagen_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.imagen_url} alt={p.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.5s ease' }}
                            onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.05)')}
                            onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                          />
                        ) : (
                          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(200,169,110,0.15)" strokeWidth="0.8">
                              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                            </svg>
                          </div>
                        )}
                        {p.stock === 0 && (
                          <div style={{ position: 'absolute', top: '12px', right: '12px', background: 'rgba(0,0,0,0.7)', borderRadius: '100px', padding: '3px 10px', fontSize: '10px', color: 'rgba(240,235,227,0.5)' }}>Sin stock</div>
                        )}
                        {/* Botón foto admin */}
                        {esAdmin && (
                          <label onClick={e => e.stopPropagation()} style={{ position: 'absolute', bottom: '10px', right: '10px', background: 'rgba(0,0,0,0.75)', border: '1px solid rgba(200,169,110,0.4)', borderRadius: '8px', padding: '5px 10px', cursor: 'pointer', fontSize: '11px', color: '#c8a96e', opacity: subiendoFoto === `p-${p.id}` ? 0.5 : 1 }}>
                            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const file = e.target.files?.[0]; if (file) subirFotoProducto(p.id, file) }} />
                            📷
                          </label>
                        )}
                      </div>
                    </Link>
                    <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                      {p.linea && <span style={{ fontSize: '9px', color: 'rgba(200,169,110,0.5)', textTransform: 'uppercase', letterSpacing: '0.18em' }}>{p.linea}</span>}
                      <Link href={`/tienda/producto/${p.id}`} style={{ textDecoration: 'none' }}>
                        <div style={{ fontWeight: 600, fontSize: '14px', color: '#f0ebe3', lineHeight: 1.3 }}>{p.nombre}</div>
                      </Link>
                      {p.fragancia && <div style={{ fontSize: '12px', color: 'rgba(240,235,227,0.3)' }}>{p.fragancia}</div>}
                      <div style={{ marginTop: 'auto', paddingTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ fontSize: '17px', fontWeight: 700, color: '#c8a96e' }}>{formatARS(p.precio_venta)}</div>
                          <div style={{ fontSize: '11px', color: 'rgba(240,235,227,0.35)', marginTop: '2px' }}>Tarjeta: {formatARS(Math.round(p.precio_venta * (1 + recargo / 100)))}</div>
                        </div>
                        {p.stock > 0 ? (
                          <button onClick={() => agregarAlCarrito(p)} style={{
                            padding: '7px 16px', borderRadius: '100px', fontSize: '12px', fontWeight: 700,
                            background: agregados[p.id] ? 'rgba(80,200,120,0.2)' : 'rgba(200,169,110,0.15)',
                            color: agregados[p.id] ? '#50c878' : '#c8a96e',
                            border: `1px solid ${agregados[p.id] ? 'rgba(80,200,120,0.4)' : 'rgba(200,169,110,0.3)'}`,
                            cursor: 'pointer', transition: 'all 0.2s', letterSpacing: '0.05em',
                          }}>
                            {agregados[p.id] ? '✓' : '+ Agregar'}
                          </button>
                        ) : (
                          <span style={{ fontSize: '11px', color: 'rgba(240,235,227,0.2)', fontStyle: 'italic' }}>Sin stock</span>
                        )}
                      </div>
                    </div>
                  </div>
                </RevealDiv>
              )
            })}
          </div>
        )}
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-12px); }
        }
        @keyframes bounce {
          0%, 100% { transform: translateX(-50%) translateY(0); opacity: 1; }
          50% { transform: translateX(-50%) translateY(8px); opacity: 0.4; }
        }
        @keyframes wisp {
          0%   { opacity: 0;    transform: translateY(0px)    translateX(0px)          scaleX(1);    }
          10%  { opacity: 1;                                                                          }
          40%  { opacity: 0.7;  transform: translateY(-80px)  translateX(var(--dx))    scaleX(1.2);  }
          75%  { opacity: 0.3;  transform: translateY(-160px) translateX(calc(var(--dx) * -0.6)) scaleX(1.5); }
          100% { opacity: 0;    transform: translateY(-240px) translateX(calc(var(--dx) * 0.4))  scaleX(1.8); }
        }
        input::placeholder { color: rgba(240,235,227,0.25); }
        @media (max-width: 768px) {
          #productos { padding: 60px 20px 80px !important; }
}
      `}</style>
    </div>
  )
}