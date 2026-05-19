'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
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

function normMarca(m: string) {
  return m.trim().toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

const BRAND_LOGOS = [
  { marca: 'Sagrada Madre', src: '/brand-logos/sagrada-madre.svg' },
  { marca: 'Satya', src: '/brand-logos/satya.svg' },
  { marca: 'Iluminarte', src: '/brand-logos/iluminarte.svg' },
  { marca: 'Aromanza', src: '/brand-logos/aromanza.svg' },
]

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

function TiendaInner() {
  const supabase = createClient()
  const rawParams = useSearchParams()

  const [productos, setProductos] = useState<Producto[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterMarca, setFilterMarca] = useState('')
  const [filterCategoria, setFilterCategoria] = useState('')
  const [filterLinea, setFilterLinea] = useState('')
  const [agregados, setAgregados] = useState<Record<number, boolean>>({})
  const [error, setError] = useState('')
  const [esAdmin, setEsAdmin] = useState(false)
  const [subiendoFoto, setSubiendoFoto] = useState<string | null>(null)
  const [heroFotos, setHeroFotos] = useState<string[]>([])
  const [heroVideo, setHeroVideo] = useState<string | null>(null)
  const [marcaLogos, setMarcaLogos] = useState<Record<string, string>>({})
  const [marcasOcultas, setMarcasOcultas] = useState<Set<string>>(new Set())
  const [hoverImages, setHoverImages] = useState<Record<number, string>>({})
  const videoRef = useRef<HTMLVideoElement>(null)

  const vieneDeMenu = !!(
    rawParams.get('categoria') || rawParams.get('linea') ||
    rawParams.get('marca') || rawParams.get('buscar')
  )

  // Sync filters from URL reactively
  useEffect(() => {
    setFilterCategoria(rawParams.get('categoria') ?? '')
    setSearch(rawParams.get('buscar') ?? '')
    setFilterLinea(rawParams.get('linea') ?? '')
    setFilterMarca(rawParams.get('marca') ?? '')
  }, [rawParams])

  // Video autoplay
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

  // Hero assets
  useEffect(() => {
    async function cargarHero() {
      const result = await supabase.storage.from('tienda').list('', { limit: 30, sortBy: { column: 'created_at', order: 'asc' } })
      if (!result.data) return
      const archivos = result.data.filter((f: { name: string }) => f.name !== '.emptyFolderPlaceholder')
      const videos = archivos.filter((f: { name: string }) => /\.(mp4|webm|mov)$/i.test(f.name))
      const fotos = archivos.filter((f: { name: string }) => !/\.(mp4|webm|mov)$/i.test(f.name))
      if (videos.length > 0)
        setHeroVideo(supabase.storage.from('tienda').getPublicUrl(videos[0].name).data.publicUrl)
      setHeroFotos(fotos.map((f: { name: string }) => supabase.storage.from('tienda').getPublicUrl(f.name).data.publicUrl))
    }
    cargarHero()
  }, [])

  // Admin check
  useEffect(() => {
    supabase.auth.getUser().then(r => { if (r.data.user) setEsAdmin(true) })
  }, [])

  // Marca logos
  async function fetchMarcaLogos() {
    const { data } = await supabase.storage.from('productos').list('marca-logos', { limit: 50 })
    if (!data) return
    const logos: Record<string, string> = {}
    for (const f of data) {
      if (f.name === '.emptyFolderPlaceholder') continue
      logos[f.name.replace(/\.[^.]+$/, '')] = supabase.storage.from('productos').getPublicUrl(`marca-logos/${f.name}`).data.publicUrl
    }
    setMarcaLogos(logos)
  }
  useEffect(() => { fetchMarcaLogos() }, [])

  // Hover images: files named {id}-2.{ext}
  useEffect(() => {
    async function cargarHover() {
      const { data } = await supabase.storage.from('productos').list('', { limit: 500 })
      if (!data) return
      const mapa: Record<number, string> = {}
      for (const file of data) {
        const m = file.name.match(/^(\d+)-2\.[^.]+$/)
        if (m) mapa[parseInt(m[1])] = supabase.storage.from('productos').getPublicUrl(file.name).data.publicUrl
      }
      setHoverImages(mapa)
    }
    cargarHover()
  }, [])

  // marcas_ocultas
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('marcas_ocultas') ?? '[]')
      setMarcasOcultas(new Set(Array.isArray(saved) ? saved : []))
    } catch { setMarcasOcultas(new Set()) }
  }, [])


  // Products
  useEffect(() => {
    supabase.from('productos')
      .select('id, nombre, linea, marca, fragancia, precio_venta, stock, imagen_url, familia')
      .eq('activo', true).order('linea').order('nombre')
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else setProductos(data ?? [])
        setLoading(false)
      })
  }, [])

  function slugMarca(m: string) {
    return m.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s-]/gi, '').replace(/\s+/g, '-').toLowerCase()
  }

  function normLinea(l: string) {
    return l.trim().toLowerCase()
      .replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e')
      .replace(/[íìï]/g, 'i').replace(/[óòö]/g, 'o')
      .replace(/[úùü]/g, 'u').replace(/ñ/g, 'n')
  }

  function ocultarMarca(marca: string) {
    const s = new Set(marcasOcultas); s.add(marca); setMarcasOcultas(s)
    localStorage.setItem('marcas_ocultas', JSON.stringify([...s]))
  }
  function restaurarMarca(marca: string) {
    const s = new Set(marcasOcultas); s.delete(marca); setMarcasOcultas(s)
    localStorage.setItem('marcas_ocultas', JSON.stringify([...s]))
  }

  async function subirLogoMarca(marca: string, file: File) {
    setSubiendoFoto(`logo-${marca}`)
    const ext = file.name.split('.').pop()
    await supabase.storage.from('productos').upload(`marca-logos/${slugMarca(marca)}.${ext}`, file, { upsert: true })
    await fetchMarcaLogos()
    setSubiendoFoto(null)
  }

  async function subirFotoFamilia(familia: string, file: File) {
    setSubiendoFoto(familia)
    const ext = file.name.split('.').pop()
    const slug = familia.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s-]/gi, '').replace(/\s+/g, '-').toLowerCase()
    const path = `familia-${slug}.${ext}`
    const { error: upErr } = await supabase.storage.from('productos').upload(path, file, { upsert: true })
    if (!upErr) {
      const { data: { publicUrl } } = supabase.storage.from('productos').getPublicUrl(path)
      await supabase.from('productos').update({ imagen_url: publicUrl }).eq('familia', familia)
      setProductos(prev => prev.map(p => p.familia === familia ? { ...p, imagen_url: publicUrl } : p))
    }
    setSubiendoFoto(null)
  }

  async function subirFotoProducto(id: number, file: File, tipo: 'primary' | 'hover' = 'primary') {
    const key = tipo === 'hover' ? `ph-${id}` : `p-${id}`
    setSubiendoFoto(key)
    const ext = file.name.split('.').pop()
    const path = tipo === 'hover' ? `${id}-2.${ext}` : `${id}.${ext}`
    const { error: upErr } = await supabase.storage.from('productos').upload(path, file, { upsert: true })
    if (!upErr) {
      const { data: { publicUrl } } = supabase.storage.from('productos').getPublicUrl(path)
      if (tipo === 'primary') {
        await supabase.from('productos').update({ imagen_url: publicUrl }).eq('id', id)
        setProductos(prev => prev.map(p => p.id === id ? { ...p, imagen_url: publicUrl } : p))
      } else {
        setHoverImages(prev => ({ ...prev, [id]: publicUrl }))
      }
    }
    setSubiendoFoto(null)
  }

  function agregarAlCarrito(p: Producto) {
    const c = getCarrito()
    c[p.id] = (c[p.id] ?? 0) + 1
    setCarritoStorage(c)
    setAgregados(prev => ({ ...prev, [p.id]: true }))
    setTimeout(() => setAgregados(prev => ({ ...prev, [p.id]: false })), 1500)
  }

  // ── CHIP_GRUPOS ──
  const CHIP_GRUPOS = [
    { slug: 'sahumerios', label: 'Sahumerios',    test: (l: string) => /sahumerio/i.test(l) },
    { slug: 'velas',      label: 'Velas',         test: (l: string) => /^(vela|vel[oó]n)/i.test(l) },
    { slug: 'defumacion', label: 'Defumación',    test: (l: string) => /defumaci/i.test(l) },
    { slug: 'lociones',   label: 'Lociones',      test: (l: string) => /loci[oó]n|lociones/i.test(l) },
    { slug: 'cristales',  label: 'Cristales',     test: (l: string) => /cristal|piedra/i.test(l) },
    { slug: 'sales',      label: 'Sales de Baño', test: (l: string) => /sales? de ba/i.test(l) },
  ]

  const filtrados = productos.filter(p => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      p.nombre.toLowerCase().includes(q) ||
      (p.marca ?? '').toLowerCase().includes(q) ||
      (p.fragancia ?? '').toLowerCase().includes(q) ||
      (p.familia ?? '').toLowerCase().includes(q) ||
      (p.linea ?? '').toLowerCase().includes(q)
    const matchMarca = !filterMarca || normMarca(p.marca ?? '') === filterMarca
    const grupo = CHIP_GRUPOS.find(g => g.slug === filterCategoria)
    const matchCat = !filterCategoria ||
      (grupo ? (p.linea ? grupo.test(p.linea) : false) : p.linea === filterCategoria)
    const matchLinea = !filterLinea || normLinea(p.linea ?? '') === normLinea(filterLinea)
    return matchSearch && matchMarca && matchCat && matchLinea
  })

  // Group by familia
  const familias: FamiliaCard[] = []
  const vistas = new Set<string>()
  const individuales: Producto[] = []
  for (const p of filtrados) {
    if (p.familia) {
      if (!vistas.has(p.familia)) {
        vistas.add(p.familia)
        const vars = filtrados.filter(x => x.familia === p.familia)
        familias.push({
          familia: p.familia, linea: p.linea,
          imagen_url: vars.find(v => v.imagen_url)?.imagen_url ?? null,
          count: vars.length,
          precio_desde: Math.min(...vars.map(v => Math.round(v.precio_venta * 1.20))),
          hay_stock: vars.some(v => v.stock > 0),
        })
      }
    } else { individuales.push(p) }
  }
  const cards = [
    ...familias.map(f => ({ tipo: 'familia' as const, data: f })),
    ...individuales.map(p => ({ tipo: 'producto' as const, data: p })),
  ]

  const todasMarcas = [...new Set(productos.map(p => p.marca ? normMarca(p.marca) : null).filter(Boolean))].sort() as string[]
  const marcas = esAdmin ? todasMarcas : todasMarcas.filter(m => !marcasOcultas.has(m))

  const lineasEnCategoria = filterCategoria ? (() => {
    const g = CHIP_GRUPOS.find(x => x.slug === filterCategoria)
    if (!g) return []
    const rawLineas = productos.filter(p => p.linea && g.test(p.linea)).map(p => p.linea!)
    const canonical = new Map<string, string>()
    for (const l of rawLineas) {
      const key = normLinea(l)
      const existing = canonical.get(key)
      if (!existing || (/[áéíóúñ]/i.test(l) && !/[áéíóúñ]/i.test(existing))) canonical.set(key, l)
    }
    return [...canonical.values()].sort()
  })() : []

  const marcasEnCategoria = filterCategoria ? (() => {
    const g = CHIP_GRUPOS.find(x => x.slug === filterCategoria)
    const ps = g ? productos.filter(p => p.linea && g.test(p.linea)) : productos.filter(p => p.linea === filterCategoria)
    return [...new Set(ps.map(p => p.marca ? normMarca(p.marca) : null).filter(Boolean))].sort() as string[]
  })() : []

  const lineasUnicas = [...new Set(productos.map(p => p.linea).filter(Boolean))].sort() as string[]
  const gruposConProductos = CHIP_GRUPOS
    .map(g => ({ ...g, count: productos.filter(p => p.linea && g.test(p.linea)).length }))
    .filter(g => g.count > 0)
  const lineasSueltas = lineasUnicas.filter(l => !CHIP_GRUPOS.some(g => g.test(l)))
  const todosChips = [
    ...gruposConProductos,
    ...lineasSueltas.map(l => ({ slug: l, label: l, count: productos.filter(p => p.linea === l).length, test: null as null | ((l: string) => boolean) })),
  ]

  const hayFiltros = !!search || !!filterMarca || !!filterCategoria || !!filterLinea

  return (
    <div style={{ background: '#080608', minHeight: '100vh', color: '#f0ebe3' }}>

      {/* ADMIN BAR */}
      {esAdmin && (
        <div style={{ background: 'rgba(200,169,110,0.07)', borderBottom: '1px solid rgba(200,169,110,0.15)', padding: '8px 24px', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px' }}>
          <span style={{ color: 'rgba(200,169,110,0.7)' }}>🔐 Admin</span>
          <span style={{ color: 'rgba(240,235,227,0.25)' }}>·</span>
          <span style={{ color: 'rgba(240,235,227,0.35)' }}>📷 foto principal · 📷² foto hover</span>
          <a href="/dashboard" style={{ marginLeft: 'auto', color: '#c8a96e', textDecoration: 'none', border: '1px solid rgba(200,169,110,0.25)', borderRadius: '6px', padding: '3px 12px', fontSize: '12px' }}>Sistema →</a>
        </div>
      )}

      {/* HERO */}
      {!vieneDeMenu && (
        <div style={{ position: 'relative', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          {heroFotos[0] && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={heroFotos[0]} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center center', opacity: 0.65, pointerEvents: 'none' }} />
          )}
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video ref={videoRef} src={heroVideo ?? undefined} loop playsInline preload="auto" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', opacity: heroVideo ? 0.75 : 0, pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(5,4,7,0.5) 0%, rgba(5,4,7,0.15) 40%, rgba(5,4,7,0.88) 100%)' }} />
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(200,169,110,0.07) 0%, transparent 65%)', pointerEvents: 'none' }} />

          <div style={{ position: 'relative', zIndex: 2, textAlign: 'center', padding: '0 20px', maxWidth: '680px', width: '100%' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-symbol.png" alt="ABUMA.MA" style={{ width: 'clamp(220px, 30vw, 420px)', height: 'clamp(220px, 30vw, 420px)', objectFit: 'contain', display: 'block', margin: '0 auto' }} />

            <div style={{ fontSize: '10px', letterSpacing: '0.3em', color: 'rgba(200,169,110,0.65)', textTransform: 'uppercase', marginBottom: '4px' }}>
              Tienda Holística · Argentina
            </div>

            <h1 style={{ fontFamily: 'var(--font-cormorant, serif)', fontSize: 'clamp(40px, 9vw, 90px)', fontWeight: 700, lineHeight: 0.95, letterSpacing: '-0.02em', color: '#f0ebe3', marginBottom: '10px' }}>
              ABUMA<span style={{ color: '#c8a96e' }}>.MA</span>
            </h1>

            <p style={{ fontSize: 'clamp(13px, 1.8vw, 16px)', color: 'rgba(240,235,227,0.45)', maxWidth: '420px', margin: '0 auto 20px', lineHeight: 1.6, letterSpacing: '0.02em' }}>
              Productos naturales para tu bienestar, espiritualidad y energía
            </p>

            <div style={{ position: 'relative', maxWidth: '460px', margin: '0 auto 16px' }}>
              <svg style={{ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c8a96e" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscá sahumerios, velas, cristales..."
                style={{ width: '100%', padding: '13px 18px 13px 46px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(200,169,110,0.2)', borderRadius: '100px', fontSize: '14px', color: '#f0ebe3', outline: 'none', backdropFilter: 'blur(20px)', transition: 'border-color 0.2s', boxSizing: 'border-box' }}
                onFocus={e => (e.target.style.borderColor = 'rgba(200,169,110,0.5)')}
                onBlur={e => (e.target.style.borderColor = 'rgba(200,169,110,0.2)')}
              />
            </div>

            <a href="#productos" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 28px', borderRadius: '100px', background: '#c8a96e', color: '#050407', fontSize: '13px', fontWeight: 700, letterSpacing: '0.08em', textDecoration: 'none', transition: 'all 0.2s', textTransform: 'uppercase' }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLAnchorElement; el.style.background = '#dbb97e'; el.style.transform = 'scale(1.03)' }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLAnchorElement; el.style.background = '#c8a96e'; el.style.transform = 'scale(1)' }}
            >
              Ver productos
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
            </a>
          </div>
        </div>
      )}

      {/* STICKY FILTER BAR */}
      <div style={{ position: 'sticky', top: '68px', zIndex: 50, background: 'rgba(8,6,8,0.94)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 24px' }}>

          {/* Count + clear row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 0 0' }}>
            {hayFiltros && (
              <button onClick={() => { setSearch(''); setFilterMarca(''); setFilterCategoria(''); setFilterLinea(''); if (typeof window !== 'undefined') window.history.replaceState({}, '', '/tienda') }}
                style={{ padding: '7px 16px', borderRadius: '100px', cursor: 'pointer', background: 'transparent', border: '1px solid rgba(200,169,110,0.2)', color: '#c8a96e', fontSize: '12px', whiteSpace: 'nowrap', transition: 'all 0.15s' }}>
                ← Todos
              </button>
            )}
            {!loading && (
              <div style={{ marginLeft: 'auto', fontSize: '11px', color: 'rgba(240,235,227,0.18)', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>
                {cards.length} productos
              </div>
            )}
          </div>

          {/* Category chips */}
          <div className="chips-scroll" style={{ display: 'flex', gap: '6px', overflowX: 'auto', padding: '10px 0 12px' }}>
            <button onClick={() => { setFilterCategoria(''); setFilterMarca(''); setFilterLinea('') }}
              className={`chip${!filterCategoria ? ' chip-active' : ''}`}>
              Todos
            </button>
            {todosChips.map(chip => (
              <button key={chip.slug}
                onClick={() => { setFilterCategoria(filterCategoria === chip.slug ? '' : chip.slug); setFilterMarca(''); setFilterLinea('') }}
                className={`chip${filterCategoria === chip.slug ? ' chip-active' : ''}`}>
                {chip.label}
              </button>
            ))}
          </div>

          {/* Sub-filters */}
          {filterCategoria && (lineasEnCategoria.length > 1 || marcasEnCategoria.length > 1) && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', paddingBottom: '10px' }}>
              {lineasEnCategoria.length > 1 && lineasEnCategoria.map(l => (
                <button key={l} onClick={() => setFilterLinea(filterLinea === l ? '' : l)}
                  className={`chip chip-sm${filterLinea === l ? ' chip-active' : ''}`}>{l}</button>
              ))}
              {marcasEnCategoria.length > 1 && marcasEnCategoria.map(m => (
                <button key={m} onClick={() => setFilterMarca(filterMarca === m ? '' : m)}
                  className={`chip chip-sm${filterMarca === m ? ' chip-active' : ''}`}>{m}</button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* MAIN */}
      <div id="productos" style={{ maxWidth: '1280px', margin: '0 auto', padding: '48px 24px 100px' }}>

        {/* BRANDS — infinite marquee carousel */}
        {!hayFiltros && (
          <div style={{ marginBottom: '72px' }}>
            <style dangerouslySetInnerHTML={{ __html: `
              @keyframes marquee-brands {
                from { transform: translateX(0); }
                to { transform: translateX(-50%); }
              }
              .marquee-track { animation: marquee-brands 32s linear infinite; }
              .marquee-track:hover { animation-play-state: paused; }
              .marquee-logo-btn { background: none; border: none; cursor: pointer; padding: 0; flex-shrink: 0; display: flex; align-items: center; justify-content: center; width: 270px; height: 120px; overflow: hidden; }
              .marquee-logo { width: 200px; height: 100px; object-fit: contain; filter: brightness(0) invert(1); opacity: 0.65; transition: opacity 0.3s, transform 0.3s; }
              .marquee-logo.aromanza { transform: scale(1.85); }
              .marquee-logo:hover { opacity: 1; }
              .marquee-logo:hover, .marquee-logo.aromanza:hover { opacity: 1; transform: scale(1.85); }
              .marquee-logo.active { opacity: 1; filter: brightness(0) invert(1) sepia(1) saturate(3); }
            ` }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '36px' }}>
              <div style={{ flex: 1, height: '1px', background: 'rgba(200,169,110,0.1)' }} />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '10px', letterSpacing: '0.3em', color: 'rgba(200,169,110,0.5)', textTransform: 'uppercase', marginBottom: '8px' }}>Explorá por</div>
                <h2 style={{ fontFamily: 'var(--font-cormorant, serif)', fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 600, color: '#f0ebe3', letterSpacing: '-0.01em' }}>Nuestras Marcas</h2>
              </div>
              <div style={{ flex: 1, height: '1px', background: 'rgba(200,169,110,0.1)' }} />
            </div>
            <div style={{ position: 'relative', overflow: 'hidden', borderTop: '1px solid rgba(200,169,110,0.1)', borderBottom: '1px solid rgba(200,169,110,0.1)' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '140px', background: 'linear-gradient(to right, #080608 30%, transparent)', zIndex: 2, pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '140px', background: 'linear-gradient(to left, #080608 30%, transparent)', zIndex: 2, pointerEvents: 'none' }} />
              <div className="marquee-track" style={{ display: 'flex', width: 'max-content', alignItems: 'center' }}>
                {[...BRAND_LOGOS, ...BRAND_LOGOS].map((logo, i) => (
                  <button key={i} onClick={() => setFilterMarca(filterMarca === logo.marca ? '' : logo.marca)}
                    className="marquee-logo-btn">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={logo.src}
                      alt={logo.marca}
                      className={`marquee-logo${logo.marca === 'Aromanza' ? ' aromanza' : ''}${filterMarca === logo.marca ? ' active' : ''}`}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* NUESTRA ESENCIA */}
        {!hayFiltros && (
          <section className="esencia-section" style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            minHeight: '440px',
            marginBottom: '64px',
            borderRadius: '20px',
            overflow: 'hidden',
            backgroundImage: `radial-gradient(ellipse at 20% 50%, #2a0f4e 0%, #0d0820 40%, #050010 100%), url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='20' cy='30' r='0.8' fill='white' opacity='0.4'/%3E%3Ccircle cx='80' cy='10' r='0.5' fill='white' opacity='0.3'/%3E%3Ccircle cx='50' cy='80' r='0.6' fill='white' opacity='0.25'/%3E%3Ccircle cx='150' cy='40' r='0.7' fill='white' opacity='0.35'/%3E%3Ccircle cx='30' cy='150' r='0.5' fill='white' opacity='0.2'/%3E%3Ccircle cx='170' cy='120' r='0.9' fill='white' opacity='0.3'/%3E%3Ccircle cx='110' cy='170' r='0.4' fill='white' opacity='0.25'/%3E%3C/svg%3E")`,
            backgroundSize: 'cover, 200px 200px',
            backgroundBlendMode: 'normal, screen',
          }}>
            {/* Texto */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              padding: 'clamp(40px, 5vw, 72px) clamp(32px, 4vw, 60px)',
              gap: '22px',
              background: 'radial-gradient(ellipse at 15% 55%, #2a1800 0%, #110a00 45%, #050300 100%)',
            }}>
              <div style={{ fontSize: '11px', letterSpacing: '0.3em', color: '#c9a84c', textTransform: 'uppercase', fontWeight: 600 }}>
                Nuestra Esencia
              </div>
              <h2 style={{
                fontFamily: 'var(--font-cormorant, serif)',
                fontSize: 'clamp(28px, 3.2vw, 46px)',
                fontWeight: 600,
                color: '#f0ebe3',
                lineHeight: 1.25,
                letterSpacing: '-0.01em',
                margin: 0,
              }}>
                Cada producto es un puente hacia tu equilibrio interior
              </h2>
              <p style={{ fontSize: '15px', color: '#a090c8', lineHeight: 1.75, margin: 0 }}>
                Inciensos, velas y rituales para acompañar tu camino.
              </p>
            </div>
            {/* Imagen completa */}
            <div style={{
              overflow: 'hidden',
              position: 'relative',
            }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/buda.png"
                alt="Buda"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition: 'center top',
                  display: 'block',
                  opacity: 0.9,
                }}
              />
            </div>
          </section>
        )}

        {/* SECTION HEADING */}
        <div style={{ marginBottom: '28px' }}>
          <h2 style={{ fontFamily: 'var(--font-cormorant, serif)', fontSize: 'clamp(22px, 3vw, 34px)', fontWeight: 600, color: '#f0ebe3', display: 'inline' }}>
            {filterCategoria
              ? CHIP_GRUPOS.find(g => g.slug === filterCategoria)?.label ?? filterCategoria
              : search ? `Resultados para "${search}"`
              : 'Todos los productos'}
          </h2>
          {filterMarca && <span style={{ fontSize: '14px', color: 'rgba(200,169,110,0.55)', marginLeft: '12px' }}>· {filterMarca}</span>}
        </div>

        {error && <div style={{ color: '#e05c5c', padding: '14px 18px', borderRadius: '10px', background: 'rgba(224,92,92,0.08)', marginBottom: '24px', fontSize: '13px' }}>{error}</div>}

        {loading ? (
          <div style={{ padding: '100px 0', textAlign: 'center', color: 'rgba(240,235,227,0.12)', fontSize: '12px', letterSpacing: '0.35em' }}>CARGANDO...</div>
        ) : cards.length === 0 ? (
          <div style={{ padding: '100px 0', textAlign: 'center' }}>
            <p style={{ color: 'rgba(240,235,227,0.2)', marginBottom: '20px', fontSize: '13px', letterSpacing: '0.1em' }}>SIN RESULTADOS</p>
            <button onClick={() => { setSearch(''); setFilterMarca(''); setFilterCategoria(''); setFilterLinea(''); if (typeof window !== 'undefined') window.history.replaceState({}, '', '/tienda') }}
              style={{ color: '#c8a96e', background: 'none', border: '1px solid rgba(200,169,110,0.25)', borderRadius: '100px', padding: '9px 24px', cursor: 'pointer', fontSize: '13px' }}>
              Limpiar filtros
            </button>
          </div>
        ) : (
          <div className="product-grid">
            {cards.map(card => {
              if (card.tipo === 'familia') {
                const f = card.data as FamiliaCard
                return (
                  <div key={`f-${f.familia}`} className="pcard" style={{ opacity: !f.hay_stock ? 0.65 : 1 }}>
                    <Link href={`/tienda/familia/${encodeURIComponent(f.familia)}`} style={{ textDecoration: 'none', display: 'block' }}>
                      <div className="pcard-img">
                        {f.imagen_url
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={f.imagen_url} alt={f.familia} className="pcard-primary" />
                          : <div className="pcard-placeholder" />
                        }
                        <div className="pcard-overlay"><span>Ver variantes →</span></div>
                        <div style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 3 }}>
                          <span style={{ background: 'rgba(200,169,110,0.88)', borderRadius: '100px', padding: '3px 10px', fontSize: '10px', color: '#080608', fontWeight: 700, letterSpacing: '0.05em' }}>{f.count} variantes</span>
                        </div>
                        {!f.hay_stock && <div className="pcard-no-stock">Sin stock</div>}
                        {esAdmin && (
                          <label onClick={e => e.preventDefault()} className="admin-btn" style={{ position: 'absolute', bottom: '10px', right: '10px', opacity: subiendoFoto === f.familia ? 0.4 : 1 }}>
                            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const file = e.target.files?.[0]; if (file) subirFotoFamilia(f.familia, file) }} />
                            {subiendoFoto === f.familia ? '⏳' : '📷'}
                          </label>
                        )}
                      </div>
                    </Link>
                    <div className="pcard-body">
                      {f.linea && <div className="pcard-linea">{f.linea}</div>}
                      <Link href={`/tienda/familia/${encodeURIComponent(f.familia)}`} style={{ textDecoration: 'none' }}>
                        <div className="pcard-name">{f.familia}</div>
                      </Link>
                      <div className="pcard-footer">
                        <div>
                          <div style={{ fontSize: '10px', color: 'rgba(240,235,227,0.22)', letterSpacing: '0.06em', marginBottom: '2px' }}>DESDE</div>
                          <div className="pcard-price">{formatARS(f.precio_desde)}</div>
                        </div>
                        <Link href={`/tienda/familia/${encodeURIComponent(f.familia)}`} className="ver-btn">Ver →</Link>
                      </div>
                    </div>
                  </div>
                )
              }

              const p = card.data as Producto
              const hoverUrl = hoverImages[p.id]
              return (
                <div key={`p-${p.id}`} className="pcard" style={{ opacity: p.stock === 0 ? 0.65 : 1 }}>
                  <Link href={`/tienda/producto/${p.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                    <div className="pcard-img">
                      {hoverUrl && <img src={hoverUrl} alt="" className="pcard-hover" aria-hidden />}
                      {p.imagen_url
                        // eslint-disable-next-line @next/next/no-img-element
                        ? <img src={p.imagen_url} alt={p.nombre} className={`pcard-primary${hoverUrl ? ' has-hover' : ''}`} />
                        : <div className="pcard-placeholder" />
                      }
                      <div className="pcard-overlay"><span>Ver producto →</span></div>
                      {p.marca && <div className="pcard-marca">{p.marca}</div>}
                      {p.stock === 0 && <div className="pcard-no-stock">Sin stock</div>}
                      {esAdmin && (
                        <div onClick={e => e.preventDefault()} style={{ position: 'absolute', bottom: '10px', left: '10px', display: 'flex', gap: '4px', zIndex: 5 }}>
                          <label className="admin-btn" style={{ opacity: subiendoFoto === `p-${p.id}` ? 0.4 : 1 }}>
                            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) subirFotoProducto(p.id, f, 'primary') }} />
                            📷
                          </label>
                          <label className="admin-btn" style={{ opacity: subiendoFoto === `ph-${p.id}` ? 0.4 : 1, background: 'rgba(80,40,160,0.75)' }}>
                            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) subirFotoProducto(p.id, f, 'hover') }} />
                            📷²
                          </label>
                        </div>
                      )}
                    </div>
                  </Link>
                  <div className="pcard-body">
                    {p.linea && <div className="pcard-linea">{p.linea}</div>}
                    <Link href={`/tienda/producto/${p.id}`} style={{ textDecoration: 'none' }}>
                      <div className="pcard-name">{p.nombre}</div>
                    </Link>
                    {p.fragancia && <div className="pcard-fragancia">{p.fragancia}</div>}
                    <div className="pcard-footer">
                      <div>
                        <div className="pcard-price">{formatARS(Math.round(p.precio_venta * 1.20))}</div>
                        <div style={{ fontSize: '10px', color: '#5ecb8a', marginTop: '2px', fontWeight: 600 }}>10% OFF QR / Transferencia</div>
                      </div>
                      {p.stock > 0
                        ? <button onClick={() => agregarAlCarrito(p)} className={`add-btn${agregados[p.id] ? ' added' : ''}`}>{agregados[p.id] ? '✓' : '+ Agregar'}</button>
                        : <span style={{ fontSize: '11px', color: 'rgba(240,235,227,0.18)', fontStyle: 'italic' }}>Sin stock</span>
                      }
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <style>{`
        /* Chips */
        .chips-scroll { scrollbar-width: none; }
        .chips-scroll::-webkit-scrollbar { display: none; }
        .chip {
          padding: 6px 16px; border-radius: 100px; font-size: 12px; cursor: pointer;
          white-space: nowrap; flex-shrink: 0;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.09);
          color: rgba(240,235,227,0.45);
          transition: all 0.15s; letter-spacing: 0.03em;
        }
        .chip:hover { border-color: rgba(200,169,110,0.25); color: rgba(240,235,227,0.7); }
        .chip-active {
          background: rgba(200,169,110,0.11) !important;
          border-color: rgba(200,169,110,0.5) !important;
          color: #c8a96e !important; font-weight: 600;
        }
        .chip-sm { padding: 4px 13px; font-size: 11px; }

        /* Product grid */
        .product-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }
        @media (max-width: 1100px) { .product-grid { grid-template-columns: repeat(3, 1fr); } }
        @media (max-width: 768px)  { .product-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; } }
        @media (max-width: 420px)  { .product-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; } }

        /* Card */
        .pcard {
          background: #0f0d10;
          border-radius: 14px;
          overflow: hidden;
          border: 1px solid rgba(255,255,255,0.05);
          display: flex; flex-direction: column;
          transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
        }
        .pcard:hover {
          transform: translateY(-5px);
          box-shadow: 0 20px 50px rgba(0,0,0,0.55);
          border-color: rgba(200,169,110,0.1);
        }

        /* Image area */
        .pcard-img {
          position: relative; aspect-ratio: 1/1;
          overflow: hidden; background: #1b1820;
        }
        .pcard-primary {
          width: 100%; height: 100%; object-fit: cover;
          transition: transform 0.55s ease, opacity 0.35s ease;
          position: relative; z-index: 1;
          display: block;
        }
        .pcard:hover .pcard-primary { transform: scale(1.06); }
        .pcard:hover .pcard-primary.has-hover { opacity: 0; }

        .pcard-hover {
          position: absolute; inset: 0;
          width: 100%; height: 100%; object-fit: cover;
          opacity: 0; transition: opacity 0.35s ease;
          z-index: 2; display: block;
        }
        .pcard:hover .pcard-hover { opacity: 1; }

        .pcard-placeholder {
          width: 100%; height: 100%;
          background: linear-gradient(135deg, #1b1820 0%, #251c2e 100%);
        }

        /* Hover overlay text */
        .pcard-overlay {
          position: absolute; inset: 0;
          background: linear-gradient(to top, rgba(0,0,0,0.5) 0%, transparent 55%);
          opacity: 0; transition: opacity 0.25s ease;
          display: flex; align-items: flex-end; justify-content: center;
          padding-bottom: 16px; z-index: 4;
        }
        .pcard-overlay span {
          font-size: 11px; color: rgba(240,235,227,0.8);
          letter-spacing: 0.08em; font-weight: 500;
        }
        .pcard:hover .pcard-overlay { opacity: 1; }

        /* Badges */
        .pcard-marca {
          position: absolute; top: 10px; left: 10px; z-index: 3;
          background: rgba(0,0,0,0.68); backdrop-filter: blur(8px);
          border-radius: 100px; padding: 3px 9px;
          font-size: 10px; color: rgba(240,235,227,0.75);
          letter-spacing: 0.06em; font-weight: 600;
        }
        .pcard-no-stock {
          position: absolute; top: 10px; right: 10px; z-index: 3;
          background: rgba(0,0,0,0.68);
          border-radius: 100px; padding: 3px 9px;
          font-size: 10px; color: rgba(240,235,227,0.32);
        }

        /* Card body */
        .pcard-body { padding: 14px 15px 16px; flex: 1; display: flex; flex-direction: column; }
        .pcard-linea { font-size: 9px; color: rgba(200,169,110,0.45); letter-spacing: 0.18em; text-transform: uppercase; margin-bottom: 4px; }
        .pcard-name { font-size: 13px; font-weight: 500; color: #f0ebe3; line-height: 1.4; margin-bottom: 4px; }
        .pcard-fragancia { font-size: 11px; color: rgba(240,235,227,0.28); margin-bottom: 10px; }
        .pcard-price { font-size: 17px; font-weight: 700; color: #c8a96e; }
        .pcard-footer { display: flex; align-items: center; justify-content: space-between; margin-top: auto; padding-top: 12px; }

        /* Add to cart */
        .add-btn {
          padding: 7px 16px; border-radius: 100px; font-size: 12px; font-weight: 700;
          background: rgba(200,169,110,0.1); color: #c8a96e;
          border: 1px solid rgba(200,169,110,0.22);
          cursor: pointer; transition: all 0.2s; letter-spacing: 0.04em; white-space: nowrap;
        }
        .add-btn:hover { background: rgba(200,169,110,0.18); border-color: rgba(200,169,110,0.45); }
        .add-btn.added { background: rgba(80,200,120,0.12); color: #50c878; border-color: rgba(80,200,120,0.3); }

        /* Ver button (familia) */
        .ver-btn {
          font-size: 12px; color: rgba(200,169,110,0.55);
          text-decoration: none; letter-spacing: 0.05em; transition: color 0.2s;
        }
        .ver-btn:hover { color: #c8a96e; }

        /* Admin upload btn */
        .admin-btn {
          background: rgba(0,0,0,0.75);
          border: 1px solid rgba(200,169,110,0.3);
          border-radius: 6px; padding: 4px 8px;
          cursor: pointer; font-size: 11px; color: #c8a96e; display: block;
        }

        /* Mobile tweaks */
        @media (max-width: 768px) {
          #productos { padding: 28px 16px 80px !important; }
          .pcard:hover { transform: none; }
          .pcard:hover .pcard-primary { transform: none; }
          .pcard-overlay { opacity: 0 !important; }
          .pcard-name { font-size: 12px; }
          .pcard-price { font-size: 15px; }
          .add-btn { padding: 6px 12px; font-size: 11px; }
          .esencia-section { grid-template-columns: 1fr !important; }
          .esencia-section > div:last-child { min-height: 240px !important; order: -1; }
        }
        input::placeholder { color: rgba(240,235,227,0.18); }
      `}</style>
    </div>
  )
}

export default function TiendaPage() {
  return (
    <Suspense fallback={<div style={{ background: '#080608', minHeight: '100vh' }} />}>
      <TiendaInner />
    </Suspense>
  )
}