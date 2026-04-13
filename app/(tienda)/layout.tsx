'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface ContactoConfig {
  wsp: string | null
  instagram: string | null
  direccion_tienda: string | null
}

export default function TiendaLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const [menuOpen, setMenuOpen] = useState(false)
  const [productosOpen, setProductosOpen] = useState(false)
  const [contacto, setContacto] = useState<ContactoConfig>({ wsp: null, instagram: null, direccion_tienda: null })

  const [carritoCount, setCarritoCount] = useState(0)

  const actualizarCarrito = useCallback(() => {
    try {
      const c = JSON.parse(localStorage.getItem('carrito') ?? '{}')
      setCarritoCount(Object.values(c as Record<string, number>).reduce((s, v) => s + v, 0))
    } catch { setCarritoCount(0) }
  }, [])

  useEffect(() => {
    actualizarCarrito()
    window.addEventListener('carritoUpdate', actualizarCarrito)
    return () => window.removeEventListener('carritoUpdate', actualizarCarrito)
  }, [actualizarCarrito])

  useEffect(() => {
    async function cargarContacto() {
      const result = await supabase.from('configuracion').select('wsp, instagram, direccion_tienda').eq('id', 1).single()
      if (result.data) setContacto(result.data)
    }
    cargarContacto()
  }, [])

  // Cerrar menú al navegar
  useEffect(() => {
    if (menuOpen) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  const navLinks = [
    { label: 'Inicio', href: '/tienda', external: false },
    { label: 'Marcas', href: '#marcas', external: false },
    { label: 'Contacto', href: '/tienda/contacto', external: false },
  ]

  const productosLinks = [
    { label: 'Todos los productos', href: '/tienda#productos' },
    { label: 'Sahumerios', href: '/tienda?buscar=sahumerio' },
    { label: 'Velas', href: '/tienda?buscar=vela' },
    { label: 'Cristales', href: '/tienda?buscar=cristal' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#050407', color: '#f0ebe3' }}>

      {/* Header flotante */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: 'rgba(5,4,7,0.7)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(200,169,110,0.1)',
      }}>
        <div style={{
          maxWidth: '1280px', margin: '0 auto',
          padding: '0 24px', height: '68px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <a href="/tienda" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="ABUMA.MA" style={{ width: '38px', height: '38px', objectFit: 'contain', mixBlendMode: 'lighten' }} />
            <div>
              <div style={{ fontFamily: 'var(--font-cormorant, serif)', fontSize: '22px', fontWeight: 700, color: '#c8a96e', letterSpacing: '0.12em', lineHeight: 1 }}>ABUMA.MA</div>
              <div style={{ fontSize: '9px', color: 'rgba(200,169,110,0.5)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>Tienda Holística</div>
            </div>
          </a>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {/* Carrito */}
            <a href="/tienda/carrito" id="carrito-btn" style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '9px 20px', borderRadius: '100px',
              background: 'rgba(200,169,110,0.1)',
              border: '1px solid rgba(200,169,110,0.25)',
              color: '#c8a96e', textDecoration: 'none',
              fontSize: '13px', letterSpacing: '0.05em',
              transition: 'all 0.2s',
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(200,169,110,0.2)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(200,169,110,0.1)' }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
                <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
              </svg>
              <span>Carrito{carritoCount > 0 ? ` (${carritoCount})` : ''}</span>
            </a>

            {/* Hamburguesa */}
            <button
              onClick={() => setMenuOpen(o => !o)}
              style={{
                display: 'flex', flexDirection: 'column', gap: '5px',
                background: 'none', border: 'none', cursor: 'pointer', padding: '8px',
              }}
              aria-label="Menú"
            >
              <span style={{ display: 'block', width: '22px', height: '2px', background: '#c8a96e', transition: 'all 0.3s', transform: menuOpen ? 'rotate(45deg) translate(5px, 5px)' : 'none' }} />
              <span style={{ display: 'block', width: '22px', height: '2px', background: '#c8a96e', transition: 'all 0.3s', opacity: menuOpen ? 0 : 1 }} />
              <span style={{ display: 'block', width: '22px', height: '2px', background: '#c8a96e', transition: 'all 0.3s', transform: menuOpen ? 'rotate(-45deg) translate(5px, -5px)' : 'none' }} />
            </button>
          </div>
        </div>
      </header>

      {/* Menú lateral */}
      <>
        {/* Overlay */}
        <div onClick={() => setMenuOpen(false)} style={{
          position: 'fixed', inset: 0, zIndex: 150,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          opacity: menuOpen ? 1 : 0,
          pointerEvents: menuOpen ? 'all' : 'none',
          transition: 'opacity 0.3s',
        }} />

        {/* Panel */}
        <div style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 160,
          width: 'min(320px, 85vw)',
          background: 'rgba(8,6,12,0.98)',
          borderLeft: '1px solid rgba(200,169,110,0.15)',
          backdropFilter: 'blur(20px)',
          transform: menuOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.35s cubic-bezier(0.4,0,0.2,1)',
          display: 'flex', flexDirection: 'column',
          overflowY: 'auto',
        }}>
          {/* Cerrar */}
          <div style={{ padding: '20px 24px', display: 'flex', justifyContent: 'flex-end', borderBottom: '1px solid rgba(200,169,110,0.08)' }}>
            <button onClick={() => setMenuOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(240,235,227,0.5)', fontSize: '22px', lineHeight: 1 }}>✕</button>
          </div>

          {/* Links */}
          <nav style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>

            {/* Productos con submenu */}
            <div>
              <button
                onClick={() => setProductosOpen(o => !o)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: '14px 0', borderBottom: '1px solid rgba(200,169,110,0.07)',
                  color: '#f0ebe3', fontSize: '15px', letterSpacing: '0.08em', textTransform: 'uppercase',
                }}
              >
                <span>Productos</span>
                <span style={{ fontSize: '12px', color: '#c8a96e', transition: 'transform 0.2s', display: 'inline-block', transform: productosOpen ? 'rotate(180deg)' : 'none' }}>▾</span>
              </button>
              {productosOpen && (
                <div style={{ paddingLeft: '16px', paddingBottom: '8px' }}>
                  {productosLinks.map(l => (
                    <a key={l.label} href={l.href} onClick={() => setMenuOpen(false)} style={{
                      display: 'block', padding: '10px 0',
                      color: 'rgba(240,235,227,0.6)', fontSize: '14px', textDecoration: 'none',
                      borderBottom: '1px solid rgba(200,169,110,0.04)',
                      transition: 'color 0.2s',
                    }}
                      onMouseEnter={e => (e.currentTarget.style.color = '#c8a96e')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'rgba(240,235,227,0.6)')}
                    >
                      {l.label}
                    </a>
                  ))}
                </div>
              )}
            </div>

            {navLinks.map(l => (
              <a key={l.label} href={l.href} onClick={() => setMenuOpen(false)}
                target={l.external ? '_blank' : undefined}
                rel={l.external ? 'noopener noreferrer' : undefined}
                style={{
                  display: 'block', padding: '14px 0',
                  borderBottom: '1px solid rgba(200,169,110,0.07)',
                  color: 'rgba(240,235,227,0.75)', fontSize: '15px',
                  textDecoration: 'none', letterSpacing: '0.08em', textTransform: 'uppercase',
                  transition: 'color 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#c8a96e')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(240,235,227,0.75)')}
              >
                {l.label}
              </a>
            ))}

            {/* Redes sociales */}
            <div style={{ marginTop: 'auto', paddingTop: '32px', display: 'flex', gap: '16px' }}>
              {contacto.instagram && (
                <a href={`https://instagram.com/${contacto.instagram}`} target="_blank" rel="noopener noreferrer"
                  style={{ color: 'rgba(200,169,110,0.6)', textDecoration: 'none', fontSize: '13px' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#c8a96e')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(200,169,110,0.6)')}
                >
                  Instagram
                </a>
              )}
              {contacto.wsp && (
                <a href={`https://wa.me/${contacto.wsp}`} target="_blank" rel="noopener noreferrer"
                  style={{ color: 'rgba(200,169,110,0.6)', textDecoration: 'none', fontSize: '13px' }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#c8a96e')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(200,169,110,0.6)')}
                >
                  WhatsApp
                </a>
              )}
            </div>
          </nav>
        </div>
      </>

      {/* Contenido */}
      <main style={{ paddingTop: '68px' }}>
        {children}
      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid rgba(200,169,110,0.1)', padding: '60px 32px 40px', marginTop: '80px' }}>
        <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '40px' }} className="footer-grid">
          <div>
            <div style={{ fontFamily: 'var(--font-cormorant, serif)', fontSize: '28px', color: '#c8a96e', marginBottom: '12px', letterSpacing: '0.1em' }}>ABUMA.MA</div>
            <p style={{ fontSize: '13px', color: 'rgba(240,235,227,0.4)', lineHeight: 1.7, maxWidth: '240px' }}>
              Productos naturales para tu bienestar, espiritualidad y energía.
            </p>
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'rgba(200,169,110,0.6)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '16px' }}>Navegación</div>
            {[
              { label: 'Tienda', href: '/tienda' },
              { label: 'Contacto', href: '/tienda/contacto' },
              { label: 'Carrito', href: '/tienda/carrito' },
            ].map(l => (
              <a key={l.label} href={l.href} style={{ display: 'block', fontSize: '14px', color: 'rgba(240,235,227,0.5)', textDecoration: 'none', marginBottom: '8px', transition: 'color 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#c8a96e')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(240,235,227,0.5)')}>
                {l.label}
              </a>
            ))}
          </div>
          <div>
            <div style={{ fontSize: '11px', color: 'rgba(200,169,110,0.6)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: '16px' }}>Contacto</div>
            {contacto.direccion_tienda && <p style={{ fontSize: '13px', color: 'rgba(240,235,227,0.4)', marginBottom: '8px' }}>{contacto.direccion_tienda}</p>}
            {contacto.instagram && (
              <a href={`https://instagram.com/${contacto.instagram}`} target="_blank" rel="noopener noreferrer"
                style={{ display: 'block', fontSize: '13px', color: 'rgba(240,235,227,0.4)', textDecoration: 'none', marginBottom: '8px', transition: 'color 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#c8a96e')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(240,235,227,0.4)')}
              >
                @{contacto.instagram}
              </a>
            )}
            {contacto.wsp && (
              <a href={`https://wa.me/${contacto.wsp}`} target="_blank" rel="noopener noreferrer"
                style={{ display: 'block', fontSize: '13px', color: 'rgba(240,235,227,0.4)', textDecoration: 'none', transition: 'color 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#c8a96e')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(240,235,227,0.4)')}
              >
                WhatsApp
              </a>
            )}
          </div>
        </div>
        <div style={{ maxWidth: '1280px', margin: '40px auto 0', paddingTop: '24px', borderTop: '1px solid rgba(200,169,110,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'rgba(240,235,227,0.25)' }}>
          <span>© 2026 ABUMA.MA. Todos los derechos reservados.</span>
          <span>Tienda Holística · Argentina</span>
        </div>
      </footer>

      <style>{`
        @media (max-width: 768px) {
          .footer-grid { grid-template-columns: 1fr !important; gap: 24px !important; }
        }
      `}</style>
    </div>
  )
}