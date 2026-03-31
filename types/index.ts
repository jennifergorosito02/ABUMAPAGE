export type Rol = 'admin' | 'empleado' | 'contador'
export type EstadoCaja = 'abierta' | 'cerrada'
export type TipoComprobante = 'ticket' | 'factura_b' | 'factura_a' | 'factura_c'
export type MetodoPago = 'efectivo' | 'transferencia' | 'tarjeta' | 'mixto'
export type TipoMovimiento = 'entrada' | 'salida' | 'ajuste' | 'venta'
export type EstadoFactura = 'pendiente' | 'emitida' | 'error'

export interface Profile {
  id: string
  nombre: string | null
  rol: Rol
  telefono: string | null
  activo: boolean
  created_at: string
}

export interface Proveedor {
  id: number
  nombre: string
  contacto: string | null
  telefono: string | null
  email: string | null
  direccion: string | null
  cuit: string | null
  notas: string | null
  activo: boolean
  created_at: string
}

export interface Producto {
  id: number
  sku_display: string | null
  nombre: string
  marca: string | null
  linea: string | null
  fragancia: string | null
  costo: number
  precio_venta: number
  stock: number
  stock_minimo: number
  proveedor_id: number | null
  imagen_url: string | null
  activo: boolean
  created_at: string
  updated_at: string
  proveedores?: { nombre: string } | null
}

export interface Empleado {
  id: number
  user_id: string | null
  nombre: string
  dni: string | null
  telefono: string | null
  email: string | null
  rol: string | null
  salario: number | null
  activo: boolean
  created_at: string
}

export interface SesionCaja {
  id: number
  empleado_id: number | null
  apertura: string
  cierre: string | null
  saldo_inicial: number
  saldo_final: number | null
  total_ventas: number
  total_efectivo: number
  total_transferencia: number
  total_tarjeta: number
  notas: string | null
  estado: EstadoCaja
  empleados?: { nombre: string } | null
}

export interface Venta {
  id: number
  numero_interno: string | null
  sesion_caja_id: number | null
  empleado_id: number | null
  cliente_nombre: string | null
  cliente_email: string | null
  cliente_cuit: string | null
  tipo_comprobante: TipoComprobante
  subtotal: number
  descuento: number
  total: number
  metodo_pago: MetodoPago
  estado: string
  notas: string | null
  fecha: string
}

export interface VentaItem {
  id: number
  venta_id: number
  producto_id: number
  cantidad: number
  precio_unitario: number
  subtotal: number
  productos?: Pick<Producto, 'nombre' | 'sku_display'> | null
}

export interface MovimientoStock {
  id: number
  producto_id: number
  tipo: TipoMovimiento
  cantidad: number
  stock_anterior: number
  stock_nuevo: number
  motivo: string | null
  referencia_id: number | null
  usuario_id: string | null
  created_at: string
  productos?: Pick<Producto, 'nombre'> | null
}

export interface Pago {
  id: number
  tipo: 'gasto' | 'pago_proveedor' | 'cobro' | 'retiro'
  concepto: string
  monto: number
  fecha: string
  proveedor_id: number | null
  metodo_pago: string | null
  comprobante_numero: string | null
  sesion_caja_id: number | null
  notas: string | null
  usuario_id: string | null
  created_at: string
}
