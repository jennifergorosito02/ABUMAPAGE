'use client'
export const dynamic = 'force-dynamic'

import { useEffect, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

function formatARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

function ContenidoTransferencia() {
  const params = useSearchParams()
  const alias = params.get('alias') ?? ''
  const total = Number(params.get('total') ?? 0)
  const nombre = params.get('nombre') ?? ''

  useEffect(() => {
    localStorage.removeItem('carrito')
    localStorage.removeItem('pedidoEnCurso')
    window.dispatchEvent(new Event('carritoUpdate'))
  }, [])

  return (
    <div style={{ textAlign: 'center', padding: '80px 20px', maxWidth: '480px', margin: '0 auto' }}>
      <div style={{
        width: '72px', height: '72px', borderRadius: '50%',
        background: 'rgba(200,169,110,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 24px',
      }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
        </svg>
      </div>

      <h1 style={{ fontFamily: 'var(--font-cormorant, serif)', fontSize: '36px', color: 'var(--gold)', marginBottom: '8px' }}>
        ¡Pedido registrado!
      </h1>
      {nombre && (
        <p style={{ color: 'var(--text-muted)', fontSize: '15px', marginBottom: '32px' }}>
          Gracias {nombre}, ya recibimos tu pedido.
        </p>
      )}

      {alias && (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid rgba(200,169,110,0.3)',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px',
          textAlign: 'left',
        }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px', fontWeight: 600 }}>
            Datos para transferir
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Alias / CVU</div>
              <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--gold)', fontFamily: 'monospace', letterSpacing: '0.04em' }}>
                {alias}
              </div>
            </div>
            {total > 0 && (
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Monto a transferir</div>
                <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)' }}>
                  {formatARS(total)}
                </div>
              </div>
            )}
          </div>

          <div style={{
            marginTop: '16px', padding: '10px 12px', borderRadius: '7px',
            background: 'rgba(200,169,110,0.06)', border: '1px solid rgba(200,169,110,0.1)',
            fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5,
          }}>
            Una vez que confirmemos el pago te contactamos para coordinar el retiro.
          </div>
        </div>
      )}

      {!alias && (
        <p style={{ color: 'var(--text-muted)', marginBottom: '32px', fontSize: '15px' }}>
          Te contactaremos pronto para darte los datos de pago y coordinar el retiro.
        </p>
      )}

      <Link href="/tienda" style={{
        display: 'inline-block', padding: '12px 28px', borderRadius: '8px',
        background: 'var(--gold)', color: '#000', fontWeight: 600, textDecoration: 'none',
      }}>
        Volver a la tienda
      </Link>
    </div>
  )
}

export default function PagoTransferenciaPage() {
  return (
    <Suspense fallback={<div style={{ textAlign: 'center', padding: '80px', color: 'var(--text-muted)' }}>Cargando...</div>}>
      <ContenidoTransferencia />
    </Suspense>
  )
}