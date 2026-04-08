'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function ContactoPage() {
  const supabase = createClient()
  const [contacto, setContacto] = useState<{ wsp: string | null; instagram: string | null; direccion_tienda: string | null }>({ wsp: null, instagram: null, direccion_tienda: null })

  useEffect(() => {
    supabase.from('configuracion').select('wsp, instagram, direccion_tienda').eq('id', 1).single()
      .then(({ data }) => { if (data) setContacto(data) })
  }, [])

  return (
    <div style={{ minHeight: '100vh', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px' }}>

      {/* Fondo místico */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, background: 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(60,30,80,0.45) 0%, rgba(5,4,7,0) 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, background: 'radial-gradient(ellipse 50% 40% at 20% 80%, rgba(200,169,110,0.06) 0%, transparent 60%)', pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, opacity: 0.018, backgroundImage: 'linear-gradient(rgba(200,169,110,1) 1px, transparent 1px), linear-gradient(90deg, rgba(200,169,110,1) 1px, transparent 1px)', backgroundSize: '60px 60px', pointerEvents: 'none' }} />

      {/* Contenido */}
      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '520px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '40px' }}>

        {/* Logo + Título juntos */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', marginTop: '60px' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-symbol.png" alt="ABUMA.MA" style={{ width: 'clamp(180px, 30vw, 260px)', height: 'clamp(180px, 30vw, 260px)', objectFit: 'contain', opacity: 0.95 }} />
          <div style={{ fontSize: '10px', letterSpacing: '0.35em', color: 'rgba(200,169,110,0.5)', textTransform: 'uppercase' }}>Estamos para vos</div>
          <h1 style={{ fontFamily: 'var(--font-cormorant, serif)', fontSize: 'clamp(42px, 8vw, 68px)', fontWeight: 500, color: '#f0ebe3', lineHeight: 1.1, margin: 0 }}>
            Contacto
          </h1>
        </div>

        {/* Items de contacto */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* WhatsApp */}
          {contacto.wsp && (
            <a
              href={`https://wa.me/${contacto.wsp}`}
              target="_blank" rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: '20px',
                padding: '20px 24px', borderRadius: '16px', textDecoration: 'none',
                background: 'rgba(37,211,102,0.06)',
                border: '1px solid rgba(37,211,102,0.2)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(37,211,102,0.12)'; (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(37,211,102,0.4)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(37,211,102,0.06)'; (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(37,211,102,0.2)' }}
            >
              {/* Ícono WhatsApp */}
              <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(37,211,102,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="#25d366">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'rgba(37,211,102,0.7)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '3px' }}>WhatsApp</div>
                <div style={{ fontSize: '15px', color: '#f0ebe3', fontWeight: 500 }}>Chateá con nosotras</div>
              </div>
              <div style={{ marginLeft: 'auto', color: 'rgba(37,211,102,0.5)', fontSize: '20px' }}>→</div>
            </a>
          )}

          {/* Instagram */}
          {contacto.instagram && (
            <a
              href={`https://instagram.com/${contacto.instagram}`}
              target="_blank" rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: '20px',
                padding: '20px 24px', borderRadius: '16px', textDecoration: 'none',
                background: 'rgba(193,53,132,0.06)',
                border: '1px solid rgba(193,53,132,0.2)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(193,53,132,0.12)'; (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(193,53,132,0.4)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(193,53,132,0.06)'; (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(193,53,132,0.2)' }}
            >
              {/* Ícono Instagram */}
              <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(193,53,132,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="url(#ig-grad)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <defs>
                    <linearGradient id="ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#f09433"/>
                      <stop offset="25%" stopColor="#e6683c"/>
                      <stop offset="50%" stopColor="#dc2743"/>
                      <stop offset="75%" stopColor="#cc2366"/>
                      <stop offset="100%" stopColor="#bc1888"/>
                    </linearGradient>
                  </defs>
                  <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
                  <circle cx="12" cy="12" r="4"/>
                  <circle cx="17.5" cy="6.5" r="0.5" fill="#dc2743" stroke="none"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'rgba(193,53,132,0.8)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '3px' }}>Instagram</div>
                <div style={{ fontSize: '15px', color: '#f0ebe3', fontWeight: 500 }}>@{contacto.instagram}</div>
              </div>
              <div style={{ marginLeft: 'auto', color: 'rgba(193,53,132,0.5)', fontSize: '20px' }}>→</div>
            </a>
          )}

          {/* Dirección — abre Google Maps */}
          {contacto.direccion_tienda && (
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(contacto.direccion_tienda)}`}
              target="_blank" rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: '20px',
                padding: '20px 24px', borderRadius: '16px', textDecoration: 'none',
                background: 'rgba(200,169,110,0.04)',
                border: '1px solid rgba(200,169,110,0.15)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(200,169,110,0.09)'; (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(200,169,110,0.35)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(200,169,110,0.04)'; (e.currentTarget as HTMLAnchorElement).style.borderColor = 'rgba(200,169,110,0.15)' }}
            >
              <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(200,169,110,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c8a96e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'rgba(200,169,110,0.6)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '3px' }}>Ubicación</div>
                <div style={{ fontSize: '15px', color: '#f0ebe3', fontWeight: 500 }}>{contacto.direccion_tienda}</div>
              </div>
              <div style={{ marginLeft: 'auto', color: 'rgba(200,169,110,0.4)', fontSize: '20px' }}>→</div>
            </a>
          )}
        </div>

        <Link href="/tienda" style={{ fontSize: '13px', color: 'rgba(200,169,110,0.5)', textDecoration: 'none', letterSpacing: '0.05em', transition: 'color 0.2s' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#c8a96e')}
          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(200,169,110,0.5)')}
        >
          ← Volver a la tienda
        </Link>
      </div>
    </div>
  )
}