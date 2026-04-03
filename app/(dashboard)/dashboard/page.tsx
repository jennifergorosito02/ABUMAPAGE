'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'
import {
  DollarSign, ShoppingCart, Package, TrendingUp,
  Wallet, ArrowUpRight, ArrowDownRight, Clock,
} from 'lucide-react'

function formatARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

function formatHora(iso: string) {
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

function formatFecha(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' })
}

interface VentaDia { fecha: string; total: number; cantidad: number }
interface UltimaVenta { id: number; total: number; fecha: string; metodo: string }
interface StockBajo { nombre: string; stock: number; stock_minimo: number }

export default function DashboardPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)

  // KPIs hoy
  const [ventasHoy, setVentasHoy] = useState({ total: 0, cantidad: 0 })
  const [ventasAyer, setVentasAyer] = useState({ total: 0, cantidad: 0 })
  const [cajaAbierta, setCajaAbierta] = useState<{ id: number; saldo_inicial: number; total_ventas: number } | null>(null)

  // Gráfico 7 días
  const [ventasSemana, setVentasSemana] = useState<VentaDia[]>([])

  // Últimas ventas
  const [ultimasVentas, setUltimasVentas] = useState<UltimaVenta[]>([])

  // Stock bajo
  const [stockBajo, setStockBajo] = useState<StockBajo[]>([])

  useEffect(() => {
    async function fetchDashboard() {
      setLoading(true)
      const ahora = new Date()
      const hoyInicio = new Date(ahora); hoyInicio.setHours(0, 0, 0, 0)
      const ayerInicio = new Date(hoyInicio); ayerInicio.setDate(ayerInicio.getDate() - 1)
      const hace7dias = new Date(hoyInicio); hace7dias.setDate(hace7dias.getDate() - 6)

      // Ventas hoy
      const { data: hoy } = await supabase
        .from('ventas')
        .select('total')
        .eq('estado', 'completada')
        .gte('fecha', hoyInicio.toISOString())

      setVentasHoy({
        total: hoy?.reduce((s, v) => s + v.total, 0) ?? 0,
        cantidad: hoy?.length ?? 0,
      })

      // Ventas ayer
      const { data: ayer } = await supabase
        .from('ventas')
        .select('total')
        .eq('estado', 'completada')
        .gte('fecha', ayerInicio.toISOString())
        .lt('fecha', hoyInicio.toISOString())

      setVentasAyer({
        total: ayer?.reduce((s, v) => s + v.total, 0) ?? 0,
        cantidad: ayer?.length ?? 0,
      })

      // Últimas 5 ventas
      const { data: ultimas } = await supabase
        .from('ventas')
        .select('id, total, fecha, pagos(metodo)')
        .eq('estado', 'completada')
        .order('fecha', { ascending: false })
        .limit(5)

      setUltimasVentas(
        (ultimas ?? []).map((v: any) => ({
          id: v.id,
          total: v.total,
          fecha: v.fecha,
          metodo: v.pagos?.[0]?.metodo ?? '—',
        }))
      )

      // Ventas últimos 7 días
      const { data: semana } = await supabase
        .from('ventas')
        .select('fecha, total')
        .eq('estado', 'completada')
        .gte('fecha', hace7dias.toISOString())
        .order('fecha', { ascending: true })

      // Agrupar por día
      const diasMap: Record<string, { total: number; cantidad: number }> = {}
      for (let i = 6; i >= 0; i--) {
        const d = new Date(hoyInicio); d.setDate(d.getDate() - i)
        const key = d.toISOString().split('T')[0]
        diasMap[key] = { total: 0, cantidad: 0 }
      }
      for (const v of semana ?? []) {
        const key = v.fecha.split('T')[0]
        if (diasMap[key]) {
          diasMap[key].total += v.total
          diasMap[key].cantidad += 1
        }
      }
      setVentasSemana(
        Object.entries(diasMap).map(([fecha, d]) => ({
          fecha: formatFecha(fecha + 'T12:00:00'),
          total: d.total,
          cantidad: d.cantidad,
        }))
      )

      // Caja abierta
      const { data: caja } = await supabase
        .from('sesiones_caja')
        .select('id, saldo_inicial, total_ventas')
        .is('fecha_cierre', null)
        .order('fecha_apertura', { ascending: false })
        .limit(1)
        .single()

      setCajaAbierta(caja ?? null)

      // Stock bajo
      const { data: stock } = await supabase
        .from('productos')
        .select('nombre, stock, stock_minimo')
        .gt('stock_minimo', 0)
        .filter('stock', 'lte', 'stock_minimo')
        .order('stock', { ascending: true })
        .limit(5)

      setStockBajo(stock ?? [])

      setLoading(false)
    }
    fetchDashboard()
  }, [])

  const variacionTotal = ventasAyer.total > 0
    ? ((ventasHoy.total - ventasAyer.total) / ventasAyer.total) * 100
    : null

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload?.length) {
      return (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-light)',
          borderRadius: '8px', padding: '10px 14px', fontSize: '13px',
        }}>
          <div style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>{label}</div>
          <div style={{ color: 'var(--gold)', fontWeight: 600 }}>{formatARS(payload[0].value)}</div>
          {payload[1] && <div style={{ color: 'var(--text-secondary)' }}>{payload[1].value} ventas</div>}
        </div>
      )
    }
    return null
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }} className="fade-in">

      {/* KPIs fila */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>

        {/* Ventas hoy */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ventas hoy</div>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(201,162,39,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DollarSign size={16} style={{ color: 'var(--gold)' }} />
            </div>
          </div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>
            {loading ? '—' : formatARS(ventasHoy.total)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {variacionTotal !== null ? (
              <>
                {variacionTotal >= 0
                  ? <ArrowUpRight size={14} style={{ color: 'var(--success)' }} />
                  : <ArrowDownRight size={14} style={{ color: 'var(--danger)' }} />}
                <span style={{ fontSize: '12px', color: variacionTotal >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {Math.abs(variacionTotal).toFixed(1)}% vs ayer
                </span>
              </>
            ) : (
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Sin ventas ayer</span>
            )}
          </div>
        </div>

        {/* Cantidad ventas */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Transacciones</div>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(56,161,105,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShoppingCart size={16} style={{ color: 'var(--success)' }} />
            </div>
          </div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>
            {loading ? '—' : ventasHoy.cantidad}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Ayer: {ventasAyer.cantidad} ventas
          </div>
        </div>

        {/* Ticket promedio */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Ticket promedio</div>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(214,158,46,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={16} style={{ color: 'var(--warning)' }} />
            </div>
          </div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>
            {loading ? '—' : formatARS(ventasHoy.cantidad > 0 ? ventasHoy.total / ventasHoy.cantidad : 0)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Por transacción hoy
          </div>
        </div>

        {/* Caja */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Caja</div>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(201,162,39,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Wallet size={16} style={{ color: 'var(--gold)' }} />
            </div>
          </div>
          <div style={{ fontSize: '26px', fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>
            {loading ? '—' : cajaAbierta
              ? formatARS((cajaAbierta.saldo_inicial ?? 0) + (cajaAbierta.total_ventas ?? 0))
              : '—'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{
              display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%',
              background: cajaAbierta ? 'var(--success)' : 'var(--text-muted)',
            }} />
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {cajaAbierta ? 'Turno abierto' : 'Sin turno activo'}
            </span>
          </div>
        </div>
      </div>

      {/* Gráfico + Últimas ventas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 300px', gap: '16px' }} className="dashboard-grid">

        {/* Gráfico ventas semana */}
        <div className="card" style={{ padding: '0' }}>
          <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={15} style={{ color: 'var(--gold)' }} />
            <span style={{ fontWeight: 600 }}>Ventas últimos 7 días</span>
          </div>
          <div style={{ padding: '16px', height: '220px' }}>
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>Cargando...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={ventasSemana} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#c9a227" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#c9a227" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis dataKey="fecha" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} tickFormatter={v => v === 0 ? '0' : `$${(v/1000).toFixed(0)}k`} width={45} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="total" stroke="#c9a227" strokeWidth={2} fill="url(#goldGrad)" dot={{ fill: '#c9a227', strokeWidth: 0, r: 3 }} activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Últimas ventas */}
        <div className="card" style={{ padding: '0' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={15} style={{ color: 'var(--gold)' }} />
            <span style={{ fontWeight: 600 }}>Últimas ventas</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>Cargando...</div>
            ) : ultimasVentas.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>Sin ventas hoy</div>
            ) : ultimasVentas.map((v, i) => (
              <div key={v.id} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '10px 16px',
                borderBottom: i < ultimasVentas.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px' }}>{formatARS(v.total)}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{formatHora(v.fecha)} · {v.metodo}</div>
                </div>
                <span className="badge badge-gold">#{v.id}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Stock bajo */}
      {!loading && stockBajo.length > 0 && (
        <div className="card" style={{ padding: '0' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Package size={15} style={{ color: 'var(--danger)' }} />
            <span style={{ fontWeight: 600 }}>Productos con stock bajo</span>
            <span className="badge badge-red">{stockBajo.length}</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Producto</th>
                  <th style={{ textAlign: 'center' }}>Stock actual</th>
                  <th style={{ textAlign: 'center' }}>Stock mínimo</th>
                </tr>
              </thead>
              <tbody>
                {stockBajo.map(p => (
                  <tr key={p.nombre}>
                    <td style={{ fontWeight: 500 }}>{p.nombre}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="badge badge-red">{p.stock}</span>
                    </td>
                    <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{p.stock_minimo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .dashboard-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}