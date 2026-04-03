'use client'
export const dynamic = 'force-dynamic'
export default function FacturacionPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }} className="fade-in">
      <div className="card" style={{ padding: '48px', textAlign: 'center' }}>
        <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '8px' }}>Facturación AFIP</div>
        <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
          Próximamente. Requiere configurar certificado AFIP en Configuración.
        </div>
      </div>
    </div>
  )
}
