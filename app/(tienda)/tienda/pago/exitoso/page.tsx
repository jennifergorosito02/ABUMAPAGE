'use client'
export const dynamic = 'force-dynamic'

import { useEffect } from 'react'
import Link from 'next/link'

export default function PagoExitosoPage() {
  useEffect(() => {
    localStorage.removeItem('carrito')
    window.dispatchEvent(new Event('carritoUpdate'))
  }, [])

  return (
    <div style={{ textAlign: 'center', padding: '80px 20px' }}>
      <div style={{
        width: '72px', height: '72px', borderRadius: '50%',
        background: 'rgba(58,170,110,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 24px',
      }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
      <h1 style={{ fontFamily: 'var(--font-cormorant, serif)', fontSize: '36px', color: 'var(--gold)', marginBottom: '12px' }}>
        ¡Pago exitoso!
      </h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '32px', fontSize: '15px' }}>
        Recibimos tu pedido. Te contactaremos pronto para coordinar la entrega.
      </p>
      <Link href="/tienda" style={{
        display: 'inline-block', padding: '12px 28px', borderRadius: '8px',
        background: 'var(--gold)', color: '#000', fontWeight: 600, textDecoration: 'none',
      }}>
        Seguir comprando
      </Link>
    </div>
  )
}