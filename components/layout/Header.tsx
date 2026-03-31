'use client'

import { useRouter, usePathname } from 'next/navigation'
import { Menu, LogOut, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const TITLES: Record<string, string> = {
  '/inventario':    'Inventario',
  '/ventas':        'Punto de Venta',
  '/caja':          'Caja',
  '/facturacion':   'Facturación',
  '/empleados':     'Empleados',
  '/proveedores':   'Proveedores',
  '/deposito':      'Depósito',
  '/reportes':      'Reportes',
  '/configuracion': 'Configuración',
}

interface Props {
  onMenuClick: () => void
}

export default function Header({ onMenuClick }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const title = Object.entries(TITLES).find(([k]) => pathname.startsWith(k))?.[1] ?? 'ABUMA.MA'

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header style={{
      height: '56px',
      borderBottom: '1px solid var(--border)',
      background: 'rgba(8,8,8,0.95)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 20px',
      gap: '16px',
      position: 'sticky',
      top: 0,
      zIndex: 30,
    }}>
      {/* Hamburger (mobile) */}
      <button
        onClick={onMenuClick}
        className="btn-icon hamburger"
        style={{ borderRadius: '6px' }}
        aria-label="Abrir menú"
      >
        <Menu size={20} />
      </button>

      {/* Título */}
      <h1 style={{
        fontSize: '16px',
        fontWeight: 600,
        color: 'var(--text)',
        flex: 1,
      }}>
        {title}
      </h1>

      {/* User + logout */}
      <button
        onClick={handleLogout}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          background: 'transparent',
          border: '1px solid var(--border)',
          borderRadius: '6px',
          color: 'var(--text-muted)',
          fontSize: '13px',
          cursor: 'pointer',
          transition: 'all 0.15s',
        }}
        title="Cerrar sesión"
      >
        <LogOut size={14} />
        <span className="logout-label">Salir</span>
      </button>

      <style>{`
        @media (max-width: 768px) {
          .hamburger { display: flex !important; }
          .logout-label { display: none; }
        }
        @media (min-width: 769px) {
          .hamburger { display: none !important; }
        }
      `}</style>
    </header>
  )
}