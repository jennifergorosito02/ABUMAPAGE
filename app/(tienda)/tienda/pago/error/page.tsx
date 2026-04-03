'use client'
export const dynamic = 'force-dynamic'

import Link from 'next/link'

export default function PagoErrorPage() {
  return (
    <div style={{ textAlign: 'center', padding: '80px 20px' }}>
      <div style={{
        width: '72px', height: '72px', borderRadius: '50%',
        background: 'rgba(224,82,82,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 24px',
      }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--danger)" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </div>
      <h1 style={{ fontFamily: 'var(--font-cormorant, serif)', fontSize: '36px', color: 'var(--gold)', marginBottom: '12px' }}>
        Hubo un problema
      </h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '32px', fontSize: '15px' }}>
        No se pudo procesar el pago. Podés intentarlo de nuevo.
      </p>
      <Link href="/tienda/carrito" style={{
        display: 'inline-block', padding: '12px 28px', borderRadius: '8px',
        background: 'var(--gold)', color: '#000', fontWeight: 600, textDecoration: 'none',
      }}>
        Volver al carrito
      </Link>
    </div>
  )
}