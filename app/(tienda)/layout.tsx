import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'ABUMA.MA — Tienda Holística',
  description: 'Tienda holística online. Sahumerios, velas, cristales y más.',
}

export default function TiendaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      {/* Header tienda */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(7,6,10,0.92)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{
          maxWidth: '1100px', margin: '0 auto',
          padding: '0 20px',
          height: '64px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          {/* Logo */}
          <a href="/tienda" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
            <img src="/logo.png" alt="ABUMA.MA" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
            <div>
              <div style={{ fontFamily: 'var(--font-cormorant, serif)', fontSize: '20px', fontWeight: 600, color: 'var(--gold)', letterSpacing: '0.08em', lineHeight: 1 }}>
                ABUMA.MA
              </div>
              <div style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>TIENDA HOLÍSTICA</div>
            </div>
          </a>

          {/* Carrito */}
          <a href="/tienda/carrito" id="carrito-btn" style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '8px 16px', borderRadius: '8px',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)', textDecoration: 'none',
            fontSize: '14px', transition: 'all 0.15s',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
            </svg>
            <span id="carrito-count">Carrito</span>
          </a>
        </div>
      </header>

      {/* Contenido */}
      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 20px' }}>
        {children}
      </main>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--border)',
        padding: '32px 20px',
        textAlign: 'center',
        color: 'var(--text-muted)',
        fontSize: '13px',
      }}>
        <p style={{ color: 'var(--gold)', fontFamily: 'var(--font-cormorant, serif)', fontSize: '18px', marginBottom: '8px' }}>ABUMA.MA</p>
        <p>Tienda Holística · Argentina</p>
        <p style={{ marginTop: '8px' }}>contacto@abumama.ma</p>
      </footer>
    </div>
  )
}