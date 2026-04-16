'use client'
export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { initMercadoPago, CardPayment } from '@mercadopago/sdk-react'
import { QRCodeSVG } from 'qrcode.react'

if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_MP_PUBLIC_KEY) {
  initMercadoPago(process.env.NEXT_PUBLIC_MP_PUBLIC_KEY)
}

interface ItemCarrito {
  id: number
  nombre: string
  precio_venta: number
  cantidad: number
  stock: number
  imagen_url: string | null
  familia: string | null
}

interface Cliente {
  nombre: string
  email: string
  telefono: string
}

function formatARS(n: number) {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n)
}

function getCarrito(): Record<number, number> {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem('carrito') ?? '{}') } catch { return {} }
}
function saveCarrito(c: Record<number, number>) {
  localStorage.setItem('carrito', JSON.stringify(c))
  window.dispatchEvent(new Event('carritoUpdate'))
}

export default function CarritoPage() {
  const supabase = createClient()
  const [items, setItems] = useState<ItemCarrito[]>([])
  const [loading, setLoading] = useState(true)
  const [procesando, setProcesando] = useState(false)
  const [errorPago, setErrorPago] = useState('')
  const [metodoPago, setMetodoPago] = useState<'debito' | 'credito' | 'qr'>('debito')
  const [recargo, setRecargo] = useState(20)
  const [cliente, setCliente] = useState<Cliente>({ nombre: '', email: '', telefono: '' })
  const [tipoEnvio, setTipoEnvio] = useState<'retiro' | 'domicilio'>('retiro')
  const [direccionEnvio, setDireccionEnvio] = useState('')
  const [costoEnvio, setCostoEnvio] = useState(12000)
  const [direccionRetiro, setDireccionRetiro] = useState('')
  const [qrUrl, setQrUrl] = useState('')

  // Al elegir domicilio → forzar QR/MP
  useEffect(() => {
    if (tipoEnvio === 'domicilio') setMetodoPago('qr')
  }, [tipoEnvio])

  // Resetear QR al cambiar método
  useEffect(() => {
    setQrUrl('')
    setErrorPago('')
  }, [metodoPago])

  async function fetchItems() {
    const carrito = getCarrito()
    const ids = Object.keys(carrito).map(Number)
    if (ids.length === 0) { setItems([]); setLoading(false); return }

    const { data } = await supabase
      .from('productos')
      .select('id, nombre, precio_venta, stock, imagen_url, familia')
      .in('id', ids)
      .eq('activo', true)

    setItems((data ?? []).map((p: any) => ({
      ...p,
      cantidad: carrito[p.id] ?? 1,
    })))
    setLoading(false)
  }

  useEffect(() => {
    async function init() {
      await fetchItems()
      const result = await supabase.from('configuracion').select('recargo_tarjeta, costo_envio, direccion_retiro').eq('id', 1).single()
      if (result.data) {
        if (result.data.recargo_tarjeta != null) setRecargo(Number(result.data.recargo_tarjeta))
        if (result.data.costo_envio != null) setCostoEnvio(Number(result.data.costo_envio))
        if (result.data.direccion_retiro) setDireccionRetiro(result.data.direccion_retiro)
      }
    }
    init()
  }, [])

  // Submit del Brick (débito o crédito)
  const onSubmitBrick = async (formData: any) => {
    if (!cliente.nombre.trim()) { setErrorPago('Ingresá tu nombre para continuar'); return }
    setProcesando(true)
    setErrorPago('')
    try {
      const res = await fetch('/api/process-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          items,
          metodo_pago: metodoPago,
          recargo: metodoPago === 'credito' ? recargo : 0,
          cliente,
          tipo_envio: tipoEnvio,
          direccion_envio: null,
          costo_envio: 0,
        }),
      })
      const data = await res.json()
      if (data.error) { setErrorPago(data.error); setProcesando(false); return }
      if (data.status === 'approved') {
        localStorage.removeItem('carrito')
        localStorage.removeItem('pedidoEnCurso')
        window.dispatchEvent(new Event('carritoUpdate'))
        window.location.href = '/tienda/pago/exitoso'
      } else if (data.status === 'rejected') {
        setErrorPago('Pago rechazado. Verificá los datos o intentá con otra tarjeta.')
        setProcesando(false)
      } else {
        localStorage.removeItem('carrito')
        localStorage.removeItem('pedidoEnCurso')
        window.dispatchEvent(new Event('carritoUpdate'))
        window.location.href = '/tienda/pago/pendiente'
      }
    } catch {
      setErrorPago('Error al procesar el pago. Intentá de nuevo.')
      setProcesando(false)
    }
  }

  // Generar QR o redirigir a MP (para QR y domicilio)
  async function handleGenerarQR() {
    if (!cliente.nombre.trim()) { setErrorPago('Ingresá tu nombre para continuar'); return }
    if (tipoEnvio === 'domicilio' && !direccionEnvio.trim()) { setErrorPago('Ingresá tu dirección de envío'); return }

    try {
      const enCurso = JSON.parse(localStorage.getItem('pedidoEnCurso') ?? 'null')
      if (enCurso?.initPoint && Date.now() - enCurso.timestamp < 30 * 60 * 1000) {
        if (tipoEnvio === 'domicilio') { window.location.href = enCurso.initPoint; return }
        setQrUrl(enCurso.initPoint); return
      }
    } catch { /* ignorar */ }

    setProcesando(true)
    setErrorPago('')
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          metodo_pago: 'qr',
          recargo: 0,
          back_url: window.location.origin,
          cliente,
          tipo_envio: tipoEnvio,
          direccion_envio: tipoEnvio === 'domicilio' ? direccionEnvio : null,
          costo_envio: tipoEnvio === 'domicilio' ? costoEnvio : 0,
        }),
      })
      const data = await res.json()
      if (data.error) { setErrorPago(data.error); setProcesando(false); return }
      localStorage.setItem('pedidoEnCurso', JSON.stringify({ initPoint: data.init_point, timestamp: Date.now() }))
      if (tipoEnvio === 'domicilio') {
        window.location.href = data.init_point
      } else {
        setQrUrl(data.init_point)
        setProcesando(false)
      }
    } catch {
      setErrorPago('Error al generar el pago')
      setProcesando(false)
    }
  }

  function updateCantidad(id: number, delta: number) {
    const c = getCarrito()
    const item = items.find(i => i.id === id)
    if (!item) return
    const nueva = Math.max(1, Math.min(item.stock, (c[id] ?? 1) + delta))
    c[id] = nueva
    saveCarrito(c)
    setItems(prev => prev.map(i => i.id === id ? { ...i, cantidad: nueva } : i))
  }

  function eliminar(id: number) {
    const c = getCarrito()
    delete c[id]
    saveCarrito(c)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const subtotal = items.reduce((s, i) => s + i.precio_venta * i.cantidad, 0)
  const montoRecargo = metodoPago === 'credito' ? Math.round(subtotal * recargo / 100) : 0
  const gastoEnvio = tipoEnvio === 'domicilio' ? costoEnvio : 0
  const total = subtotal + montoRecargo + gastoEnvio

  function precioConRecargo(precio: number) {
    return metodoPago === 'credito' ? Math.round(precio * (1 + recargo / 100)) : precio
  }

  const mpKeyConfigured = !!process.env.NEXT_PUBLIC_MP_PUBLIC_KEY

  if (loading) return <div style={{ textAlign: 'center', padding: '80px', color: 'var(--text-muted)' }}>Cargando...</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

      <h1 style={{ fontFamily: 'var(--font-cormorant, serif)', fontSize: '36px', fontWeight: 500, color: 'var(--gold)' }}>
        Tu Carrito
      </h1>

      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <p style={{ color: 'var(--text-muted)', marginBottom: '20px', fontSize: '16px' }}>Tu carrito está vacío</p>
          <Link href="/tienda" style={{
            display: 'inline-block', padding: '12px 28px', borderRadius: '8px',
            background: 'var(--gold)', color: '#000', fontWeight: 600, textDecoration: 'none',
          }}>
            Ver productos
          </Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '24px' }} className="carrito-grid">

          {/* Lista de items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {items.map(item => (
              <div key={item.id} className="card" style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div style={{ width: '64px', height: '64px', flexShrink: 0, borderRadius: '8px', overflow: 'hidden', background: 'var(--bg-card-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {item.imagen_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={item.imagen_url} alt={item.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--gold-dim)" strokeWidth="1.5"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                  }
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text)' }}>{item.nombre}</div>
                  <div style={{ color: 'var(--gold)', fontWeight: 700, marginTop: '4px' }}>
                    {formatARS(precioConRecargo(item.precio_venta))}
                  </div>
                  {metodoPago === 'credito' && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Sin recargo: {formatARS(item.precio_venta)}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--border)', borderRadius: '7px', overflow: 'hidden' }}>
                  <button onClick={() => updateCantidad(item.id, -1)} style={{ padding: '6px 12px', background: 'transparent', color: 'var(--text)', border: 'none', cursor: 'pointer' }}>−</button>
                  <span style={{ padding: '6px 10px', fontSize: '14px', fontWeight: 600 }}>{item.cantidad}</span>
                  <button onClick={() => updateCantidad(item.id, 1)} style={{ padding: '6px 12px', background: 'transparent', color: 'var(--text)', border: 'none', cursor: 'pointer' }}>+</button>
                </div>

                <div style={{ minWidth: '90px', textAlign: 'right', fontWeight: 700, fontSize: '15px' }}>
                  {formatARS(precioConRecargo(item.precio_venta) * item.cantidad)}
                </div>

                <button onClick={() => eliminar(item.id)} style={{
                  background: 'transparent', border: 'none', color: 'var(--text-muted)',
                  cursor: 'pointer', padding: '4px', fontSize: '18px', lineHeight: 1,
                }}>×</button>
              </div>
            ))}

            <Link href="/tienda" style={{ color: 'var(--gold)', fontSize: '14px', textDecoration: 'none', marginTop: '8px' }}>
              ← Seguir comprando
            </Link>
          </div>

          {/* Panel derecho */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Resumen */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h2 style={{ fontFamily: 'var(--font-cormorant, serif)', fontSize: '22px', fontWeight: 500 }}>Resumen</h2>

              {/* Método de envío */}
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>¿Cómo recibís tu pedido?</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button onClick={() => setTipoEnvio('retiro')} style={{
                    padding: '10px 8px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                    border: `1px solid ${tipoEnvio === 'retiro' ? 'var(--gold)' : 'var(--border)'}`,
                    background: tipoEnvio === 'retiro' ? 'rgba(200,169,110,0.12)' : 'transparent',
                    color: tipoEnvio === 'retiro' ? 'var(--gold)' : 'var(--text-secondary)',
                    cursor: 'pointer', textAlign: 'center',
                  }}>
                    🏪 Retiro en local<br />
                    <span style={{ fontSize: '10px', fontWeight: 400, opacity: 0.7 }}>Gratis</span>
                  </button>
                  <button onClick={() => setTipoEnvio('domicilio')} style={{
                    padding: '10px 8px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                    border: `1px solid ${tipoEnvio === 'domicilio' ? 'var(--gold)' : 'var(--border)'}`,
                    background: tipoEnvio === 'domicilio' ? 'rgba(200,169,110,0.12)' : 'transparent',
                    color: tipoEnvio === 'domicilio' ? 'var(--gold)' : 'var(--text-secondary)',
                    cursor: 'pointer', textAlign: 'center',
                  }}>
                    📦 Envío OCA<br />
                    <span style={{ fontSize: '10px', fontWeight: 400, opacity: 0.7 }}>{formatARS(costoEnvio)}</span>
                  </button>
                </div>

                {tipoEnvio === 'retiro' && direccionRetiro && (
                  <div style={{ marginTop: '8px', padding: '10px 12px', borderRadius: '7px', background: 'rgba(200,169,110,0.06)', border: '1px solid rgba(200,169,110,0.15)', fontSize: '12px', color: 'var(--text-muted)' }}>
                    📍 {direccionRetiro}
                  </div>
                )}

                {tipoEnvio === 'domicilio' && (
                  <div style={{ marginTop: '8px' }}>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '5px' }}>
                      Dirección de entrega *
                    </label>
                    <input
                      type="text"
                      placeholder="Calle, número, piso, ciudad, provincia"
                      value={direccionEnvio}
                      onChange={e => setDireccionEnvio(e.target.value)}
                      style={{
                        width: '100%', padding: '9px 12px', borderRadius: '7px', boxSizing: 'border-box',
                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(200,169,110,0.2)',
                        color: '#f0ebe3', fontSize: '14px', outline: 'none',
                      }}
                    />
                  </div>
                )}
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid var(--border)' }} />

              {/* Método de pago */}
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>¿Cómo vas a pagar?</div>

                {tipoEnvio === 'domicilio' ? (
                  <div style={{
                    padding: '10px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                    border: '1px solid #7c6fcd', background: 'rgba(124,111,205,0.12)',
                    color: '#a89fdf', textAlign: 'center',
                  }}>
                    💳 Pago online con Mercado Pago<br />
                    <span style={{ fontWeight: 400, opacity: 0.8, fontSize: '11px' }}>Crédito, débito o saldo MP</span>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
                    {[
                      { key: 'debito', label: '💳 Débito', sub: 'Precio lista' },
                      { key: 'credito', label: '💳 Crédito', sub: `+${recargo}% recargo` },
                      { key: 'qr', label: '📱 QR MP', sub: 'Precio lista' },
                    ].map(({ key, label, sub }) => (
                      <button key={key} onClick={() => setMetodoPago(key as any)} style={{
                        padding: '8px 4px', borderRadius: '8px', fontSize: '11px', fontWeight: 600,
                        border: `1px solid ${metodoPago === key ? (key === 'credito' ? '#7c6fcd' : 'var(--gold)') : 'var(--border)'}`,
                        background: metodoPago === key ? (key === 'credito' ? 'rgba(124,111,205,0.12)' : 'rgba(200,169,110,0.12)') : 'transparent',
                        color: metodoPago === key ? (key === 'credito' ? '#a89fdf' : 'var(--gold)') : 'var(--text-secondary)',
                        cursor: 'pointer', textAlign: 'center', lineHeight: 1.4,
                      }}>
                        {label}<br />
                        <span style={{ fontWeight: 400, fontSize: '10px', opacity: 0.75 }}>{sub}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <hr style={{ border: 'none', borderTop: '1px solid var(--border)' }} />

              {/* Totales */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)' }}>
                  <span>Subtotal</span>
                  <span>{formatARS(subtotal)}</span>
                </div>
                {montoRecargo > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'rgba(168,159,223,0.8)' }}>
                    <span>Recargo crédito ({recargo}%)</span>
                    <span>+ {formatARS(montoRecargo)}</span>
                  </div>
                )}
                {gastoEnvio > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)' }}>
                    <span>Envío OCA</span>
                    <span>{formatARS(gastoEnvio)}</span>
                  </div>
                )}
                <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '4px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '18px', fontWeight: 700 }}>
                  <span>Total</span>
                  <span style={{ color: 'var(--gold)' }}>{formatARS(total)}</span>
                </div>
              </div>
            </div>

            {/* Datos del cliente */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h2 style={{ fontFamily: 'var(--font-cormorant, serif)', fontSize: '20px', fontWeight: 500 }}>Tus datos</h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { key: 'nombre', label: 'Nombre *', type: 'text', placeholder: 'Tu nombre completo' },
                  { key: 'telefono', label: 'WhatsApp', type: 'tel', placeholder: 'Ej: 3413001234' },
                  { key: 'email', label: 'Email', type: 'email', placeholder: 'tu@email.com' },
                ].map(({ key, label, type, placeholder }) => (
                  <div key={key}>
                    <label style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: '5px' }}>
                      {label}
                    </label>
                    <input
                      type={type}
                      placeholder={placeholder}
                      value={cliente[key as keyof Cliente]}
                      onChange={e => setCliente(c => ({ ...c, [key]: e.target.value }))}
                      style={{
                        width: '100%', padding: '9px 12px', borderRadius: '7px', boxSizing: 'border-box',
                        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(200,169,110,0.2)',
                        color: '#f0ebe3', fontSize: '14px', outline: 'none',
                      }}
                    />
                  </div>
                ))}
              </div>

              {errorPago && (
                <div style={{ fontSize: '13px', color: 'var(--danger)', background: 'rgba(220,50,50,0.1)', padding: '10px', borderRadius: '6px' }}>
                  {errorPago}
                </div>
              )}

              {/* Sección de pago según método */}
              {(metodoPago === 'debito' || metodoPago === 'credito') && (
                <div style={{ marginTop: '4px' }}>
                  {!mpKeyConfigured ? (
                    <div style={{ padding: '12px', borderRadius: '8px', background: 'rgba(220,50,50,0.1)', fontSize: '13px', color: 'var(--danger)' }}>
                      Configuración incompleta: falta la llave pública de Mercado Pago.
                    </div>
                  ) : total > 0 ? (
                    <CardPayment
                      key={metodoPago}
                      initialization={{ amount: total }}
                      onSubmit={onSubmitBrick}
                      onError={(error) => console.error('Brick error:', error)}
                    />
                  ) : null}
                  {procesando && (
                    <div style={{ textAlign: 'center', padding: '12px', color: 'var(--text-muted)', fontSize: '13px' }}>
                      Procesando pago...
                    </div>
                  )}
                </div>
              )}

              {metodoPago === 'qr' && !tipoEnvio.startsWith('dom') && (
                <div style={{ marginTop: '4px' }}>
                  {!qrUrl ? (
                    <button
                      onClick={handleGenerarQR}
                      disabled={procesando}
                      style={{
                        width: '100%', padding: '14px', borderRadius: '8px', fontSize: '15px', fontWeight: 600,
                        background: 'var(--gold)', color: '#000', border: 'none',
                        cursor: procesando ? 'wait' : 'pointer', opacity: procesando ? 0.7 : 1,
                      }}
                    >
                      {procesando ? 'Generando QR...' : '📱 Generar QR de pago'}
                    </button>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '16px', borderRadius: '10px', background: '#fff' }}>
                      <QRCodeSVG value={qrUrl} size={180} />
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: '#000', marginBottom: '4px' }}>
                          Escaneá con la cámara de tu celular
                        </div>
                        <div style={{ fontSize: '11px', color: '#666' }}>
                          Podés pagar con cualquier banco o billetera virtual
                        </div>
                      </div>
                      <button
                        onClick={() => { setQrUrl(''); localStorage.removeItem('pedidoEnCurso') }}
                        style={{ fontSize: '11px', color: '#999', background: 'transparent', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                      >
                        Generar nuevo QR
                      </button>
                    </div>
                  )}
                </div>
              )}

              {tipoEnvio === 'domicilio' && (
                <button
                  onClick={handleGenerarQR}
                  disabled={procesando}
                  style={{
                    width: '100%', padding: '14px', borderRadius: '8px', fontSize: '15px', fontWeight: 600,
                    background: 'var(--gold)', color: '#000', border: 'none',
                    cursor: procesando ? 'wait' : 'pointer', opacity: procesando ? 0.7 : 1, marginTop: '4px',
                  }}
                >
                  {procesando ? 'Procesando...' : 'Pagar con Mercado Pago'}
                </button>
              )}

              <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', margin: 0 }}>
                Pago seguro con Mercado Pago
              </p>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .carrito-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}