'use client'
export const dynamic = 'force-dynamic'

import Link from 'next/link'

export default function PagoPendientePage() {
  return (
    <div style={{ textAlign: 'center', padding: '80px 20px' }}>
      <div style={{
        width: '72px', height: '72px', borderRadius: '50%',
        background: 'rgba(200,150,58,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 24px',
      }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--warning)" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
      </div>
      <h1 style={{ fontFamily: 'var(--font-cormorant, serif)', fontSize: '36px', color: 'var(--gold)', marginBottom: '12px' }}>
        Pago pendiente
      </h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '32px', fontSize: '15px' }}>
        Tu pago está siendo procesado. Te avisaremos cuando se confirme.
      </p>
      <Link href="/tienda" style={{
        display: 'inline-block', padding: '12px 28px', borderRadius: '8px',
        background: 'var(--gold)', color: '#000', fontWeight: 600, textDecoration: 'none',
      }}>
        Volver a la tienda
      </Link>
    </div>
  )
}