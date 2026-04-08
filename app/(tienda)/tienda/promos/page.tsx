'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

export default function PromosPage() {
  const supabase = createClient()
  const [texto, setTexto] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('configuracion').select('texto_promos').eq('id', 1).single()
      .then(({ data }) => { setTexto(data?.texto_promos ?? null); setLoading(false) })
  }, [])

  return (
    <div style={{ minHeight: '80vh', maxWidth: '760px', margin: '0 auto', padding: 'clamp(40px, 8vw, 100px) 24px' }}>
      <Link href="/tienda" style={{ fontSize: '13px', color: 'rgba(200,169,110,0.6)', textDecoration: 'none', letterSpacing: '0.05em' }}>
        ← Volver a la tienda
      </Link>

      <div style={{ marginTop: '40px', marginBottom: '48px' }}>
        <div style={{ fontSize: '10px', letterSpacing: '0.3em', color: 'rgba(200,169,110,0.5)', textTransform: 'uppercase', marginBottom: '12px' }}>Ofertas especiales</div>
        <h1 style={{ fontFamily: 'var(--font-cormorant, serif)', fontSize: 'clamp(40px, 7vw, 72px)', fontWeight: 500, color: '#f0ebe3', lineHeight: 1.1, margin: 0 }}>
          Promos
        </h1>
        <div style={{ width: '48px', height: '1px', background: 'rgba(200,169,110,0.4)', marginTop: '24px' }} />
      </div>

      {loading ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '15px' }}>Cargando...</p>
      ) : texto ? (
        <div style={{ fontSize: '16px', lineHeight: 1.9, color: 'rgba(240,235,227,0.75)', whiteSpace: 'pre-wrap' }}>
          {texto}
        </div>
      ) : (
        <p style={{ color: 'rgba(240,235,227,0.3)', fontSize: '15px', fontStyle: 'italic' }}>
          No hay promos activas por el momento.
        </p>
      )}
    </div>
  )
}