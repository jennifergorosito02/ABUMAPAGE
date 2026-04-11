'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  LayoutDashboard, Package, ShoppingCart, Wallet,
  FileText, Users, Truck, Warehouse, BarChart3, Settings, X,
} from 'lucide-react'

type Rol = 'admin' | 'empleado' | 'contador'

const NAV: { href: string; label: string; icon: React.ElementType; roles: Rol[] }[] = [
  { href: '/dashboard',     label: 'Dashboard',    icon: LayoutDashboard, roles: ['admin', 'empleado', 'contador'] },
  { href: '/inventario',    label: 'Inventario',   icon: Package,         roles: ['admin', 'empleado'] },
  { href: '/ventas',        label: 'Ventas',        icon: ShoppingCart,    roles: ['admin', 'empleado'] },
  { href: '/caja',          label: 'Caja',          icon: Wallet,          roles: ['admin', 'empleado'] },
  { href: '/facturacion',   label: 'Facturación',   icon: FileText,        roles: ['admin', 'contador'] },
  { href: '/empleados',     label: 'Empleados',     icon: Users,           roles: ['admin'] },
  { href: '/proveedores',   label: 'Proveedores',   icon: Truck,           roles: ['admin'] },
  { href: '/deposito',      label: 'Depósito',      icon: Warehouse,       roles: ['admin', 'empleado'] },
  { href: '/reportes',      label: 'Reportes',      icon: BarChart3,       roles: ['admin', 'contador'] },
  { href: '/configuracion', label: 'Configuración', icon: Settings,        roles: ['admin'] },
]

interface Props {
  open: boolean
  onClose: () => void
}

export default function Sidebar({ open, onClose }: Props) {
  const pathname = usePathname()
  const [rol, setRol] = useState<Rol>('empleado')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(result => {
      const user = result.data.user
      if (!user) return
      supabase.from('profiles').select('rol').eq('id', user.id).single()
        .then(profileResult => { if (profileResult.data?.rol) setRol(profileResult.data.rol as Rol) })
    })
  }, [])

  const navFiltrado = NAV.filter(item => item.roles.includes(rol))

  return (
    <>
      {/* Overlay móvil */}
      {open && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40, display: 'none' }}
          className="md-overlay"
          onClick={onClose}
        />
      )}

      <aside
        style={{
          position: 'fixed', top: 0, left: 0, bottom: 0,
          width: 'var(--sidebar-w)', background: '#0b0912',
          borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', zIndex: 50,
          transition: 'transform 0.25s cubic-bezier(.4,0,.2,1)',
        }}
        className={`sidebar ${open ? 'sidebar-open' : ''}`}
      >
        {/* Logo */}
        <div style={{
          padding: '20px 20px 16px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="ABUMA.MA" width={36} height={36} style={{ objectFit: 'contain' }} />
            <div>
              <div style={{ fontFamily: 'var(--font-cormorant, serif)', fontSize: '18px', fontWeight: 600, color: 'var(--gold)', letterSpacing: '0.05em' }}>
                ABUMA.MA
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {rol === 'admin' ? 'Administrador' : rol === 'contador' ? 'Contador' : 'Empleado'}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="btn-icon close-btn" style={{ borderRadius: '6px' }} aria-label="Cerrar menú">
            <X size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
          {navFiltrado.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href)
            return (
              <Link key={href} href={href} onClick={onClose} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '9px 12px', borderRadius: '7px', marginBottom: '2px',
                color: active ? 'var(--gold)' : 'var(--text-secondary)',
                background: active ? 'rgba(201,162,39,0.08)' : 'transparent',
                borderLeft: active ? '2px solid var(--gold)' : '2px solid transparent',
                fontSize: '14px', fontWeight: active ? 500 : 400, transition: 'all 0.15s',
              }}>
                <Icon size={17} strokeWidth={active ? 2 : 1.5} />
                {label}
              </Link>
            )
          })}
        </nav>

      </aside>

      <style>{`
        @media (max-width: 768px) {
          .sidebar { transform: translateX(-100%); }
          .sidebar.sidebar-open { transform: translateX(0); }
          .md-overlay { display: block !important; }
          .close-btn { display: flex !important; }
        }
        @media (min-width: 769px) {
          .sidebar { transform: translateX(0) !important; }
          .close-btn { display: none !important; }
        }
      `}</style>
    </>
  )
}