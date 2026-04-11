'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { BarChart3, TrendingUp, Package, DollarSign } from 'lucide-react'
import { useRequireRole } from '@/hooks/useRequireRole'

function formatARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

interface ProductoTop { nombre: string; total_vendido: number; ingresos: number }

export default function ReportesPage() {
  useRequireRole(['admin', 'contador'])
  const supabase = createClient()
  const [periodo, setPeriodo] = useState('30')
  const [ventas, setVentas] = useState<{ total: number; cantidad: number; promedio: number }>({ total: 0, cantidad: 0, promedio: 0 })
  const [topProductos, setTopProductos] = useState<ProductoTop[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchReportes() {
      setLoading(true)
      const desde = new Date()
      desde.setDate(desde.getDate() - parseInt(periodo))

      const { data: ventasData } = await supabase
        .from('ventas')
        .select('total, id')
        .eq('estado', 'completada')
        .gte('fecha', desde.toISOString())

      const total = ventasData?.reduce((s: number, v: { total: number }) => s + v.total, 0) ?? 0
      const cantidad = ventasData?.length ?? 0
      setVentas({ total, cantidad, promedio: cantidad > 0 ? total / cantidad : 0 })

      // Top productos
      const { data: itemsData } = await supabase
        .from('venta_items')
        .select('cantidad, subtotal, productos(nombre)')
        .gte('created_at' as any, desde.toISOString())

      const productosMap: Record<string, ProductoTop> = {}
      for (const item of itemsData ?? []) {
        const nombre = (item.productos as any)?.nombre ?? 'Desconocido'
        if (!productosMap[nombre]) productosMap[nombre] = { nombre, total_vendido: 0, ingresos: 0 }
        productosMap[nombre].total_vendido += item.cantidad
        productosMap[nombre].ingresos += item.subtotal
      }
      setTopProductos(Object.values(productosMap).sort((a, b) => b.ingresos - a.ingresos).slice(0, 15))
      setLoading(false)
    }
    fetchReportes()
  }, [periodo])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }} className="fade-in">
      {/* Selector período */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Período:</span>
        {[
          { value: '7', label: '7 días' },
          { value: '30', label: '30 días' },
          { value: '90', label: '90 días' },
        ].map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setPeriodo(value)}
            style={{
              padding: '5px 12px', borderRadius: '6px', fontSize: '13px',
              background: periodo === value ? 'var(--gold)' : 'var(--bg-card)',
              color: periodo === value ? '#000' : 'var(--text-secondary)',
              border: `1px solid ${periodo === value ? 'var(--gold)' : 'var(--border)'}`,
              cursor: 'pointer', fontWeight: periodo === value ? 600 : 400,
            }}
          >{label}</button>
        ))}
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
        {[
          { label: 'Total ventas', value: formatARS(ventas.total), icon: DollarSign, color: 'var(--gold)' },
          { label: 'Cantidad de ventas', value: ventas.cantidad.toString(), icon: BarChart3, color: 'var(--success)' },
          { label: 'Ticket promedio', value: formatARS(ventas.promedio), icon: TrendingUp, color: 'var(--warning)' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card" style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '18px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Icon size={20} style={{ color }} />
            </div>
            <div>
              <div style={{ fontSize: '22px', fontWeight: 700, lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Top productos */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Package size={15} style={{ color: 'var(--gold)' }} />
          <span style={{ fontWeight: 600 }}>Productos más vendidos</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Producto</th>
                <th style={{ textAlign: 'center' }}>Unidades</th>
                <th style={{ textAlign: 'right' }}>Ingresos</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Cargando...</td></tr>
              ) : topProductos.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>Sin ventas en el período</td></tr>
              ) : topProductos.map((p, i) => (
                <tr key={p.nombre}>
                  <td style={{ color: 'var(--text-muted)', fontSize: '13px', width: '40px' }}>#{i + 1}</td>
                  <td style={{ fontWeight: 500 }}>{p.nombre}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className="badge badge-gold">{p.total_vendido}</span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--gold)' }}>{formatARS(p.ingresos)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
