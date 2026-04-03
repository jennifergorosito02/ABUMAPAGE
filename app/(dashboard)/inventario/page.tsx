'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Producto, Proveedor } from '@/types'
import {
  Plus, Search, Package, TrendingDown, AlertTriangle, X,
  Pencil, Trash2, ChevronUp, ChevronDown, RefreshCw,
} from 'lucide-react'


function formatARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

function StockBadge({ stock, minimo }: { stock: number; minimo: number }) {
  if (stock === 0) return <span className="badge badge-red">Sin stock</span>
  if (stock <= minimo) return <span className="badge badge-yellow">Stock bajo</span>
  return <span className="badge badge-green">{stock}</span>
}

interface FormData {
  nombre: string; linea: string; marca: string; fragancia: string
  sku_display: string; costo: string; precio_venta: string
  stock: string; stock_minimo: string; proveedor_id: string
}

const EMPTY_FORM: FormData = {
  nombre: '', linea: '', marca: '', fragancia: '',
  sku_display: '', costo: '', precio_venta: '',
  stock: '0', stock_minimo: '3', proveedor_id: '',
}

export default function InventarioPage() {
  const supabase = createClient()

  const [productos, setProductos] = useState<Producto[]>([])
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [loading, setLoading] = useState(true)
  const [lineas, setLineas] = useState<string[]>([])
  const [nuevaLinea, setNuevaLinea] = useState('')
  const [agregandoLinea, setAgregandoLinea] = useState(false)
  const [search, setSearch] = useState('')
  const [filterLinea, setFilterLinea] = useState('')
  const [filterStock, setFilterStock] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<Producto | null>(null)
  const [form, setForm] = useState<FormData>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const fetchProductos = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('productos')
      .select('*, proveedores(nombre)')
      .eq('activo', true)
      .order('linea')
      .order('nombre')
    const prods = data ?? []
    setProductos(prods)
    const lineasUnicas = [...new Set(prods.map((p: any) => p.linea).filter(Boolean))].sort() as string[]
    setLineas(lineasUnicas)
    setLoading(false)
  }, [])

  const fetchProveedores = useCallback(async () => {
    const { data } = await supabase.from('proveedores').select('*').eq('activo', true).order('nombre')
    setProveedores(data ?? [])
  }, [])

  useEffect(() => {
    fetchProductos()
    fetchProveedores()
  }, [fetchProductos, fetchProveedores])

  // Filtrar
  const filtered = productos.filter(p => {
    const q = search.toLowerCase()
    const matchSearch = !q || p.nombre.toLowerCase().includes(q) ||
      (p.fragancia?.toLowerCase().includes(q) ?? false) ||
      (p.sku_display?.toLowerCase().includes(q) ?? false) ||
      (p.marca?.toLowerCase().includes(q) ?? false)
    const matchLinea = !filterLinea || p.linea === filterLinea
    const matchStock = !filterStock ||
      (filterStock === 'sin' && p.stock === 0) ||
      (filterStock === 'bajo' && p.stock > 0 && p.stock <= p.stock_minimo) ||
      (filterStock === 'ok' && p.stock > p.stock_minimo)
    return matchSearch && matchLinea && matchStock
  })

  // Stats
  const total = productos.length
  const sinStock = productos.filter(p => p.stock === 0).length
  const stockBajo = productos.filter(p => p.stock > 0 && p.stock <= p.stock_minimo).length
  const enStock = total - sinStock - stockBajo

  // Ajustar stock
  async function ajustarStock(p: Producto, delta: number) {
    const nuevo = Math.max(0, p.stock + delta)
    setProductos(prev => prev.map(x => x.id === p.id ? { ...x, stock: nuevo } : x))

    const { error } = await supabase
      .from('productos')
      .update({ stock: nuevo })
      .eq('id', p.id)

    if (!error) {
      // Registrar movimiento
      await supabase.from('movimientos_stock').insert({
        producto_id: p.id,
        tipo: 'ajuste',
        cantidad: Math.abs(delta),
        stock_anterior: p.stock,
        stock_nuevo: nuevo,
        motivo: delta > 0 ? 'Entrada manual' : 'Salida manual',
      })
    } else {
      // Revertir si falla
      setProductos(prev => prev.map(x => x.id === p.id ? { ...x, stock: p.stock } : x))
      showToast('Error al actualizar stock')
    }
  }

  // Abrir modal
  function abrirNuevo() {
    setEditando(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }

  function abrirEditar(p: Producto) {
    setEditando(p)
    setForm({
      nombre: p.nombre,
      linea: p.linea ?? '',
      marca: p.marca ?? '',
      fragancia: p.fragancia ?? '',
      sku_display: p.sku_display ?? '',
      costo: p.costo.toString(),
      precio_venta: p.precio_venta.toString(),
      stock: p.stock.toString(),
      stock_minimo: p.stock_minimo.toString(),
      proveedor_id: p.proveedor_id?.toString() ?? '',
    })
    setModalOpen(true)
  }

  function cerrarModal() {
    setModalOpen(false)
    setEditando(null)
    setForm(EMPTY_FORM)
  }

  // Guardar
  async function handleGuardar(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)

    const payload = {
      nombre: form.nombre.trim(),
      linea: form.linea || null,
      marca: form.marca || null,
      fragancia: form.fragancia || null,
      sku_display: form.sku_display || null,
      costo: parseFloat(form.costo) || 0,
      precio_venta: parseFloat(form.precio_venta) || 0,
      stock: parseInt(form.stock) || 0,
      stock_minimo: parseInt(form.stock_minimo) || 3,
      proveedor_id: form.proveedor_id ? parseInt(form.proveedor_id) : null,
    }

    let error
    if (editando) {
      ;({ error } = await supabase.from('productos').update(payload).eq('id', editando.id))
    } else {
      ;({ error } = await supabase.from('productos').insert(payload))
    }

    setSaving(false)
    if (error) { showToast('Error al guardar'); return }

    showToast(editando ? 'Producto actualizado' : 'Producto creado')
    cerrarModal()
    fetchProductos()
  }

  // Eliminar (soft)
  async function handleEliminar(id: number) {
    if (!confirm('¿Desactivar este producto?')) return
    setDeletingId(id)
    await supabase.from('productos').update({ activo: false }).eq('id', id)
    setProductos(prev => prev.filter(p => p.id !== id))
    setDeletingId(null)
    showToast('Producto desactivado')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }} className="fade-in">

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: '24px', right: '24px',
          background: 'var(--bg-card)', border: '1px solid var(--border-light)',
          borderRadius: '8px', padding: '12px 16px',
          fontSize: '14px', color: 'var(--text)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          zIndex: 200, animation: 'fadeIn 0.2s ease',
        }}>
          {toast}
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
        {[
          { label: 'Total productos', value: total, icon: Package, color: 'var(--gold)' },
          { label: 'En stock', value: enStock, icon: Package, color: 'var(--success)' },
          { label: 'Stock bajo', value: stockBajo, icon: AlertTriangle, color: 'var(--warning)' },
          { label: 'Sin stock', value: sinStock, icon: TrendingDown, color: 'var(--danger)' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px' }}>
            <div style={{
              width: '38px', height: '38px', borderRadius: '8px',
              background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Icon size={18} style={{ color }} />
            </div>
            <div>
              <div style={{ fontSize: '22px', fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>{value}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 200px', minWidth: '200px' }}>
          <Search size={15} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, SKU, fragancia..."
            style={{ paddingLeft: '34px' }}
          />
        </div>

        <select value={filterLinea} onChange={e => setFilterLinea(e.target.value)} style={{ flex: '0 1 200px' }}>
          <option value="">Todas las líneas</option>
          {lineas.map(l => <option key={l} value={l}>{l}</option>)}
        </select>

        <select value={filterStock} onChange={e => setFilterStock(e.target.value)} style={{ flex: '0 1 150px' }}>
          <option value="">Todos los stocks</option>
          <option value="ok">En stock</option>
          <option value="bajo">Stock bajo</option>
          <option value="sin">Sin stock</option>
        </select>

        <button onClick={fetchProductos} className="btn btn-ghost btn-sm" title="Actualizar">
          <RefreshCw size={14} />
        </button>

        <button onClick={abrirNuevo} className="btn btn-primary btn-sm">
          <Plus size={15} /> Nuevo
        </button>
      </div>

      {/* Tabla */}
      <div className="card" style={{ padding: 0 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            {loading ? 'Cargando...' : `${filtered.length} producto${filtered.length !== 1 ? 's' : ''}`}
          </span>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Producto</th>
                <th>Línea</th>
                <th>Costo</th>
                <th>Precio</th>
                <th>Margen</th>
                <th style={{ textAlign: 'center' }}>Stock</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                    Cargando productos...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                    No se encontraron productos
                  </td>
                </tr>
              ) : filtered.map(p => {
                const margen = p.costo > 0 ? Math.round(((p.precio_venta - p.costo) / p.costo) * 100) : 0
                return (
                  <tr key={p.id}>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {p.sku_display ?? '—'}
                    </td>
                    <td>
                      <div style={{ fontWeight: 500, maxWidth: '260px' }}>{p.nombre}</div>
                      {p.marca && <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{p.marca}</div>}
                    </td>
                    <td>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{p.linea ?? '—'}</span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatARS(p.costo)}</td>
                    <td style={{ whiteSpace: 'nowrap', color: 'var(--gold)', fontWeight: 500 }}>{formatARS(p.precio_venta)}</td>
                    <td>
                      <span style={{ fontSize: '12px', color: margen > 50 ? 'var(--success)' : 'var(--text-muted)' }}>
                        {margen}%
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                        <button
                          onClick={() => ajustarStock(p, -1)}
                          disabled={p.stock === 0}
                          style={{
                            width: '24px', height: '24px', background: 'var(--border)', border: 'none',
                            borderRadius: '4px', cursor: p.stock === 0 ? 'not-allowed' : 'pointer',
                            color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            opacity: p.stock === 0 ? 0.4 : 1,
                          }}
                        >
                          <ChevronDown size={13} />
                        </button>
                        <StockBadge stock={p.stock} minimo={p.stock_minimo} />
                        <button
                          onClick={() => ajustarStock(p, 1)}
                          style={{
                            width: '24px', height: '24px', background: 'var(--border)', border: 'none',
                            borderRadius: '4px', cursor: 'pointer',
                            color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          <ChevronUp size={13} />
                        </button>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                        <button className="btn-icon" onClick={() => abrirEditar(p)} title="Editar" style={{ borderRadius: '5px' }}>
                          <Pencil size={14} />
                        </button>
                        <button
                          className="btn-icon"
                          onClick={() => handleEliminar(p.id)}
                          disabled={deletingId === p.id}
                          title="Desactivar"
                          style={{ borderRadius: '5px', color: 'var(--danger)' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="overlay" onClick={e => { if (e.target === e.currentTarget) cerrarModal() }}>
          <div className="modal fade-in">
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <h2 style={{ fontSize: '16px', fontWeight: 600 }}>
                {editando ? 'Editar producto' : 'Nuevo producto'}
              </h2>
              <button className="btn-icon" onClick={cerrarModal} style={{ borderRadius: '6px' }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleGuardar}>
              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '5px' }}>
                    Nombre *
                  </label>
                  <input value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} required placeholder="Nombre del producto" />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '5px' }}>Línea</label>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <select value={form.linea} onChange={e => setForm(f => ({ ...f, linea: e.target.value }))} style={{ flex: 1 }}>
                        <option value="">Sin línea</option>
                        {lineas.map(l => <option key={l} value={l}>{l}</option>)}
                      </select>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAgregandoLinea(true)} title="Nueva línea" style={{ padding: '8px 10px', flexShrink: 0 }}>+</button>
                    </div>
                    {agregandoLinea && (
                      <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                        <input
                          autoFocus
                          value={nuevaLinea}
                          onChange={e => setNuevaLinea(e.target.value)}
                          placeholder="Nombre de la nueva línea"
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault()
                              if (nuevaLinea.trim()) {
                                const nl = nuevaLinea.trim()
                                setLineas(prev => [...new Set([...prev, nl])].sort())
                                setForm(f => ({ ...f, linea: nl }))
                                setNuevaLinea('')
                                setAgregandoLinea(false)
                              }
                            }
                            if (e.key === 'Escape') { setAgregandoLinea(false); setNuevaLinea('') }
                          }}
                        />
                        <button type="button" className="btn btn-primary btn-sm" style={{ flexShrink: 0 }} onClick={() => {
                          if (nuevaLinea.trim()) {
                            const nl = nuevaLinea.trim()
                            setLineas(prev => [...new Set([...prev, nl])].sort())
                            setForm(f => ({ ...f, linea: nl }))
                            setNuevaLinea('')
                            setAgregandoLinea(false)
                          }
                        }}>OK</button>
                        <button type="button" className="btn btn-ghost btn-sm" style={{ flexShrink: 0 }} onClick={() => { setAgregandoLinea(false); setNuevaLinea('') }}>✕</button>
                      </div>
                    )}
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '5px' }}>Marca</label>
                    <input value={form.marca} onChange={e => setForm(f => ({ ...f, marca: e.target.value }))} placeholder="Ej: Aromanza" />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '5px' }}>Fragancia</label>
                    <input value={form.fragancia} onChange={e => setForm(f => ({ ...f, fragancia: e.target.value }))} placeholder="Fragancia o variante" />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '5px' }}>SKU</label>
                    <input value={form.sku_display} onChange={e => setForm(f => ({ ...f, sku_display: e.target.value }))} placeholder="Código" />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '5px' }}>Precio costo *</label>
                    <input type="number" min="0" step="1" value={form.costo} onChange={e => setForm(f => ({ ...f, costo: e.target.value }))} required />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '5px' }}>Precio venta *</label>
                    <input type="number" min="0" step="1" value={form.precio_venta} onChange={e => setForm(f => ({ ...f, precio_venta: e.target.value }))} required />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '5px' }}>Stock actual</label>
                    <input type="number" min="0" value={form.stock} onChange={e => setForm(f => ({ ...f, stock: e.target.value }))} />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '5px' }}>Stock mínimo</label>
                    <input type="number" min="0" value={form.stock_minimo} onChange={e => setForm(f => ({ ...f, stock_minimo: e.target.value }))} />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '5px' }}>Proveedor</label>
                  <select value={form.proveedor_id} onChange={e => setForm(f => ({ ...f, proveedor_id: e.target.value }))}>
                    <option value="">Sin proveedor</option>
                    {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>

                {/* Preview margen */}
                {form.costo && form.precio_venta && parseFloat(form.costo) > 0 && (
                  <div style={{ background: 'var(--bg-input)', borderRadius: '6px', padding: '10px 12px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    Margen:{' '}
                    <strong style={{ color: 'var(--gold)' }}>
                      {Math.round(((parseFloat(form.precio_venta) - parseFloat(form.costo)) / parseFloat(form.costo)) * 100)}%
                    </strong>
                    {' · '}Ganancia: <strong style={{ color: 'var(--success)' }}>
                      {formatARS(parseFloat(form.precio_venta) - parseFloat(form.costo))}
                    </strong>
                  </div>
                )}
              </div>

              <div style={{
                padding: '16px 24px', borderTop: '1px solid var(--border)',
                display: 'flex', gap: '10px', justifyContent: 'flex-end',
              }}>
                <button type="button" className="btn btn-ghost" onClick={cerrarModal}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={saving} style={{ opacity: saving ? 0.7 : 1 }}>
                  {saving ? 'Guardando...' : editando ? 'Guardar cambios' : 'Crear producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
