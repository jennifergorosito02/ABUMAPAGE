# ABUMA.MA — Registro del Proyecto
**Sistema de Gestión Integral — Tienda Holística**  
Fecha de inicio: Abril 2026  
Última actualización: 02/04/2026

---

## 1. DESCRIPCIÓN DEL PROYECTO

Sistema de gestión empresarial completo para **ABUMA.MA**, tienda holística ubicada en Argentina. Reemplaza un prototipo básico con localStorage por un sistema profesional con base de datos en la nube, multi-usuario y accesible desde cualquier dispositivo.

### Objetivo principal
Centralizar la gestión de inventario, ventas, caja, facturación, empleados y proveedores en una sola plataforma accesible desde cualquier dispositivo (PC, celular, tablet).

---

## 2. STACK TECNOLÓGICO

| Tecnología | Versión | Uso |
|---|---|---|
| Next.js | 16.2.1 | Framework principal (App Router, TypeScript) |
| React | 19.2.4 | UI |
| Supabase | — | Base de datos PostgreSQL + Auth + RLS |
| @supabase/ssr | 0.9.0 | Autenticación server-side |
| Tailwind CSS | v4 | Estilos base |
| Recharts | 3.8.1 | Gráficos del dashboard |
| Lucide React | 1.7.0 | Iconos |
| TypeScript | 5 | Tipado estático |
| Vercel | — | Deploy y hosting |

### Estructura del proyecto
```
abumama-inventory/
├── app/
│   ├── (auth)/login/        → Pantalla de login
│   ├── (dashboard)/
│   │   ├── dashboard/       → Dashboard principal
│   │   ├── inventario/      → Gestión de productos
│   │   ├── ventas/          → POS / Punto de venta
│   │   ├── caja/            → Caja y turnos
│   │   ├── empleados/       → Gestión de empleados
│   │   ├── proveedores/     → Gestión de proveedores
│   │   ├── deposito/        → Movimientos de stock
│   │   ├── reportes/        → Reportes y KPIs
│   │   ├── facturacion/     → Facturación AFIP
│   │   └── configuracion/   → Config del sistema
│   ├── globals.css          → Variables CSS / tema visual
│   └── layout.tsx           → Layout raíz con fuentes
├── components/
│   └── layout/
│       ├── Sidebar.tsx      → Menú lateral responsive
│       └── Header.tsx       → Cabecera con logout
├── lib/
│   └── supabase/
│       ├── client.ts        → Cliente browser
│       ├── server.ts        → Cliente server
│       └── schema.sql       → Schema completo + seed
├── types/index.ts           → Interfaces TypeScript
├── proxy.ts                 → Auth middleware (Next.js 16)
└── public/
    └── logo.png             → Logo ABUMA.MA
```

---

## 3. INFRAESTRUCTURA Y CREDENCIALES

### Supabase
- **Proyecto ID:** pktquznilsgfvtvlwodm
- **URL:** https://pktquznilsgfvtvlwodm.supabase.co
- **Plan:** Free tier
- **Región:** (default)
- Las credenciales (anon key, service role key) están en `.env.local` (archivo local, NO subido a GitHub)

### Vercel
- **URL producción:** https://abumama-inventory.vercel.app
- **Cuenta:** abumabuda-2688s-projects
- **Proyecto:** abumama-inventory
- Variables de entorno configuradas: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### GitHub
- **Repositorio:** https://github.com/abumama-inventory/abumama-inventory-
- **Rama principal:** main

### Cuenta de acceso al sistema
- **Email:** abumabuda@gmail.com
- **Contraseña:** (guardada por el usuario)

---

## 4. BASE DE DATOS

### Tablas creadas en Supabase

| Tabla | Descripción |
|---|---|
| `profiles` | Perfiles de usuario vinculados a auth.users |
| `proveedores` | Datos de proveedores |
| `productos` | Catálogo completo de productos (154 productos seedeados) |
| `empleados` | Empleados con roles |
| `sesiones_caja` | Turnos de caja con apertura/cierre y totales |
| `ventas` | Registro de ventas completadas |
| `venta_items` | Ítems individuales de cada venta |
| `facturas_afip` | Facturas electrónicas AFIP (para integración futura) |
| `movimientos_stock` | Historial de todos los movimientos de stock |
| `pagos` | Métodos de pago por venta |
| `configuracion` | Configuración de la empresa y AFIP |

### Función RPC creada
```sql
-- Actualiza totales de caja al registrar una venta
create or replace function incrementar_caja(p_sesion_id int, p_total numeric, p_campo text)
returns void language plpgsql as $$
begin
  if p_campo = 'total_ventas' then
    update sesiones_caja set total_ventas = total_ventas + p_total where id = p_sesion_id;
  elsif p_campo = 'total_efectivo' then
    update sesiones_caja set total_ventas = total_ventas + p_total, total_efectivo = total_efectivo + p_total where id = p_sesion_id;
  elsif p_campo = 'total_digital' then
    update sesiones_caja set total_ventas = total_ventas + p_total, total_digital = total_digital + p_total where id = p_sesion_id;
  end if;
end;
$$;
```

### Row Level Security (RLS)
Habilitado en todas las tablas. Políticas permisivas para usuarios autenticados.

### Seed de productos
154 productos cargados desde el catálogo original de ABUMA.MA con campos:
- nombre, línea, marca, fragancia, SKU
- precio_costo, precio_venta, margen
- stock, stock_mínimo
- proveedor_id, activo

---

## 5. MÓDULOS DEL SISTEMA

### 5.1 Login (`/login`)
- Autenticación con email y contraseña via Supabase Auth
- Redirección automática si ya está logueado
- Diseño con logo ABUMA.MA

### 5.2 Dashboard (`/dashboard`)
- KPIs del día: ventas, transacciones, ticket promedio, estado de caja
- Gráfico de área con ventas de los últimos 7 días (Recharts)
- Panel de últimas 5 ventas del día
- Alerta automática de productos con stock bajo
- Responsive: en mobile se apila verticalmente

### 5.3 Inventario (`/inventario`)
- Listado completo de productos con búsqueda en tiempo real
- Filtros por línea y estado de stock
- Botones ± para ajuste rápido de stock
- Modal de alta/edición con:
  - Nombre, línea (con opción de agregar nueva línea con botón +), marca, fragancia
  - SKU, precio costo, precio venta
  - Stock actual, stock mínimo
  - Proveedor
  - Vista previa de margen y ganancia en tiempo real
- Eliminación lógica (campo `activo`)
- Registro automático de movimientos de stock

### 5.4 Ventas / POS (`/ventas`)
- Búsqueda de productos con grid visual
- Carrito de compras con cantidades editables
- Descuento porcentual global
- Métodos de pago: efectivo, transferencia, tarjeta, mixto
- Toggle para generar factura AFIP (infraestructura lista, integración real pendiente)
- Confirmación de venta: descuenta stock, registra en ventas/venta_items/pagos, actualiza caja
- Número de ticket autogenerado

### 5.5 Caja (`/caja`)
- Apertura de turno con saldo inicial
- Registro de movimientos: gastos y retiros con descripción
- Cierre de turno con resumen de totales
- Historial de turnos anteriores con detalle
- Totales por método de pago (efectivo, digital)

### 5.6 Empleados (`/empleados`)
- CRUD completo: nombre, email, teléfono, rol, activo/inactivo
- Roles: administrador, vendedor, repositor

### 5.7 Proveedores (`/proveedores`)
- CRUD completo: razón social, contacto, email, teléfono, dirección, CUIT

### 5.8 Depósito (`/deposito`)
- Historial completo de movimientos de stock
- Filtros por tipo (entrada/salida/ajuste) y fecha
- Muestra motivo y referencia de cada movimiento

### 5.9 Reportes (`/reportes`)
- Selector de período: 7, 30 o 90 días
- KPIs: total de ventas, cantidad de ventas, ticket promedio
- Tabla de top 15 productos más vendidos por ingresos

### 5.10 Facturación (`/facturacion`)
- Módulo preparado para integración AFIP
- Infraestructura de base de datos lista (tabla `facturas_afip`)
- Integración real pendiente (requiere certificado AFIP)

### 5.11 Configuración (`/configuracion`)
- Datos de la empresa (razón social, CUIT, dirección, teléfono, email)
- Configuración AFIP: ambiente (homologación/producción), punto de venta

---

## 6. DISEÑO Y ESTILO

### Tema visual
- **Nombre:** Ámbar Profundo con tinte violeta
- **Estilo:** Oscuro, sofisticado, holístico/místico
- **Fuentes:** Jost (cuerpo) + Cormorant Garamond (títulos/logo)

### Paleta de colores
```css
--gold: #c8a96e          /* Dorado ámbar cálido — acento principal */
--gold-light: #dfc28f    /* Dorado claro para hover */
--gold-dim: #7a6440      /* Dorado tenue */
--bg: #07060a            /* Fondo principal — negro violáceo */
--bg-card: #100e17       /* Fondo de cards — violeta muy oscuro */
--bg-card-hover: #171424 /* Hover de cards */
--bg-input: #0d0b14      /* Fondo de inputs */
--border: #1e1b2e        /* Bordes — violeta oscuro */
--border-light: #2a2640  /* Bordes claros */
--text: #e8e0d0          /* Texto principal — blanco cálido */
--text-muted: #5c5870    /* Texto tenue */
--text-secondary: #9490a8/* Texto secundario */
--sidebar-w: 240px
```

### Logo
- Archivo: `public/logo.png`
- Aparece en: pantalla de login (120x120px) y sidebar (36x36px)
- Diseño: círculo dorado con símbolo A + ojo + lunas + texto "ABUMA.MA TIENDA HOLÍSTICA"

### Responsive
- Sidebar: colapsable en mobile con overlay
- Dashboard: grid de 2 columnas → 1 columna en mobile
- Tablas: scroll horizontal en mobile
- POS: adaptable a pantallas chicas

---

## 7. AUTENTICACIÓN Y SEGURIDAD

- Autenticación: Supabase Auth (email + contraseña)
- Middleware: `proxy.ts` protege todas las rutas excepto `/login`
- RLS: todas las tablas tienen políticas de seguridad a nivel fila
- Variables de entorno: nunca expuestas en el código, guardadas en `.env.local` y en Vercel
- Confirmación de email: **desactivada** en Supabase (Authentication → Providers → Email)

---

## 8. DEPLOY Y MANTENIMIENTO

### Cómo iniciar el servidor local
```bash
cd C:\Users\jenni\abumama-inventory
npm run dev
# Acceder en http://localhost:3000
```
> Mantener la terminal abierta mientras se usa el sistema localmente.

### Cómo deployar cambios a producción
```bash
cd C:\Users\jenni\abumama-inventory
vercel --prod
```

### Cómo actualizar variables de entorno en Vercel
```bash
vercel env rm NOMBRE_VARIABLE production --yes
vercel env add NOMBRE_VARIABLE
```
O desde el panel: https://vercel.com/abumabuda-2688s-projects/abumama-inventory/settings/environment-variables

---

## 9. PENDIENTE / PRÓXIMAS FASES

### Fase 3 — Integraciones (próximo paso)
- **Mercado Libre:** sincronización de stock via API MELI + webhooks
  - Cuando se vende en ML → descuenta stock en el sistema
  - Cuando se vende en el sistema → actualiza stock en ML
  - Requiere: cuenta de desarrollador en developers.mercadolibre.com.ar
- **Tienda online:** integración con plataforma a definir (Tiendanube, Shopify, etc.)
  - Misma lógica de sincronización bidireccional

### Fase 4 — AFIP
- Integración real con WSFE (Web Service Facturación Electrónica)
- Requiere:
  - CUIT activo como contribuyente
  - Certificado digital de AFIP
  - Biblioteca `afip.js` o `@afipsdk/node`
  - Alta en servicios de AFIP (WSAA + WSFE)
  - Punto de venta habilitado en AFIP

### Mejoras menores pendientes
- Gráfico de barras en módulo de Reportes
- Filtros de fecha personalizados en Depósito

---

## 10. NOTAS TÉCNICAS IMPORTANTES

- **Next.js 16:** usa `proxy.ts` en lugar de `middleware.ts` para el middleware
- **Turbopack:** activado en dev y build para mayor velocidad
- **`export const dynamic = 'force-dynamic'`:** necesario en todas las páginas del dashboard para evitar errores de prerendering en Vercel (las páginas usan Supabase en runtime)
- **WSL:** el proyecto corre correctamente desde Windows (CMD/PowerShell), no usar WSL sobre `/mnt/c/` por problemas de performance
- **Supabase Free tier:** los proyectos se pausan tras 7 días de inactividad — reactivar desde el dashboard si no carga

---

*Documento generado el 02/04/2026*  
*Sistema desarrollado con Claude Code (Anthropic)*