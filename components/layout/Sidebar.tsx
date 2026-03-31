'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Wallet,
  FileText,
  Users,
  Truck,
  Warehouse,
  BarChart3,
  Settings,
  X,
  Flame,
} from 'lucide-react'

const NAV = [
  { href: '/dashboard',    label: 'Dashboard',     icon: LayoutDashboard },
  { href: '/inventario',   label: 'Inventario',    icon: Package },
  { href: '/ventas',       label: 'Ventas',         icon: ShoppingCart },
  { href: '/caja',         label: 'Caja',           icon: Wallet },
  { href: '/facturacion',  label: 'Facturación',    icon: FileText },
  { href: '/empleados',    label: 'Empleados',      icon: Users },
  { href: '/proveedores',  label: 'Proveedores',    icon: Truck },
  { href: '/deposito',     label: 'Depósito',       icon: Warehouse },
  { href: '/reportes',     label: 'Reportes',       icon: BarChart3 },
  { href: '/configuracion',label: 'Configuración',  icon: Settings },
]

interface Props {
  open: boolean
  onClose: () => void
}

export default function Sidebar({ open, onClose }: Props) {
  const pathname = usePathname()

  return (
    <>
      {/* Overlay móvil */}
      {open && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
            zIndex: 40, display: 'none',
          }}
          className="md-overlay"
          onClick={onClose}
        />
      )}

      <aside
        style={{
          position: 'fixed',
          top: 0, left: 0, bottom: 0,
          width: 'var(--sidebar-w)',
          background: '#0c0c0c',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 50,
          transition: 'transform 0.25s cubic-bezier(.4,0,.2,1)',
        }}
        className={`sidebar ${open ? 'sidebar-open' : ''}`}
      >
        {/* Logo */}
        <div style={{
          padding: '20px 20px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{
              fontFamily: 'var(--font-cormorant, serif)',
              fontSize: '20px',
              fontWeight: 600,
              color: 'var(--gold)',
              letterSpacing: '0.05em',
            }}>
              ABUMA.MA
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
              Gestión · Tienda Holística
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn-icon close-btn"
            style={{ borderRadius: '6px' }}
            aria-label="Cerrar menú"
          >
            <X size={16} />
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '9px 12px',
                  borderRadius: '7px',
                  marginBottom: '2px',
                  color: active ? 'var(--gold)' : 'var(--text-secondary)',
                  background: active ? 'rgba(201,162,39,0.08)' : 'transparent',
                  borderLeft: active ? '2px solid var(--gold)' : '2px solid transparent',
                  fontSize: '14px',
                  fontWeight: active ? 500 : 400,
                  transition: 'all 0.15s',
                }}
              >
                <Icon size={17} strokeWidth={active ? 2 : 1.5} />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          <Flame size={14} style={{ color: 'var(--gold-dim)' }} />
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Tienda Holística
          </span>
        </div>
      </aside>

      <style>{`
        @media (max-width: 768px) {
          .sidebar {
            transform: translateX(-100%);
          }
          .sidebar.sidebar-open {
            transform: translateX(0);
          }
          .md-overlay {
            display: block !important;
          }
          .close-btn {
            display: flex !important;
          }
        }
        @media (min-width: 769px) {
          .sidebar {
            transform: translateX(0) !important;
          }
          .close-btn {
            display: none !important;
          }
        }
      `}</style>
    </>
  )
}