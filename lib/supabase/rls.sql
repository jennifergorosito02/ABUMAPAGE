-- =============================================================
-- ABUMA.MA — Políticas RLS por rol
-- Ejecutar en Supabase > SQL Editor
-- Roles: 'admin' | 'empleado' | 'contador'
-- Anon: tienda pública (sin login)
-- Service role: APIs del servidor (bypasea RLS automáticamente)
-- =============================================================

-- ─── FUNCIÓN AUXILIAR ────────────────────────────────────────
-- Evita consultar profiles en cada policy (más eficiente)
create or replace function get_mi_rol()
returns text language sql security definer stable as $$
  select rol from profiles where id = auth.uid()
$$;

-- =============================================================
-- CONFIGURACION
-- Anon puede leer (la tienda necesita logo, dirección, etc.)
-- Solo admin puede modificar
-- =============================================================
alter table configuracion enable row level security;
drop policy if exists "conf_anon_read"    on configuracion;
drop policy if exists "conf_admin_write"  on configuracion;

create policy "conf_anon_read" on configuracion
  for select to anon, authenticated using (true);

create policy "conf_admin_write" on configuracion
  for all to authenticated
  using (get_mi_rol() = 'admin')
  with check (get_mi_rol() = 'admin');

-- =============================================================
-- PRODUCTOS
-- Anon puede leer activos (tienda pública)
-- Autenticados ven todos (incluye inactivos para inventario)
-- Admin y empleado pueden modificar
-- Contador solo lectura
-- =============================================================
alter table productos enable row level security;
drop policy if exists "prod_anon_read"        on productos;
drop policy if exists "prod_auth_read"        on productos;
drop policy if exists "prod_staff_write"      on productos;

create policy "prod_anon_read" on productos
  for select to anon using (activo = true);

create policy "prod_auth_read" on productos
  for select to authenticated using (true);

create policy "prod_staff_write" on productos
  for all to authenticated
  using (get_mi_rol() in ('admin', 'empleado'))
  with check (get_mi_rol() in ('admin', 'empleado'));

-- =============================================================
-- PROFILES
-- Cada usuario ve y edita su propio perfil
-- Admin ve todos
-- =============================================================
alter table profiles enable row level security;
drop policy if exists "profiles_own"       on profiles;
drop policy if exists "profiles_admin_all" on profiles;

create policy "profiles_own" on profiles
  for all to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "profiles_admin_all" on profiles
  for all to authenticated
  using (get_mi_rol() = 'admin')
  with check (get_mi_rol() = 'admin');

-- =============================================================
-- EMPLEADOS
-- Admin y contador ven todos (incluyendo salario)
-- Empleado solo ve su propio registro
-- =============================================================
alter table empleados enable row level security;
drop policy if exists "emp_admin_all"  on empleados;
drop policy if exists "emp_own_read"   on empleados;

create policy "emp_admin_all" on empleados
  for all to authenticated
  using (get_mi_rol() in ('admin', 'contador'))
  with check (get_mi_rol() = 'admin');

create policy "emp_own_read" on empleados
  for select to authenticated
  using (user_id = auth.uid());

-- =============================================================
-- SESIONES DE CAJA
-- Empleado: solo sus propias sesiones
-- Admin y contador: todas las sesiones
-- =============================================================
alter table sesiones_caja enable row level security;
drop policy if exists "caja_admin_all"     on sesiones_caja;
drop policy if exists "caja_empleado_own"  on sesiones_caja;

create policy "caja_admin_all" on sesiones_caja
  for all to authenticated
  using (get_mi_rol() in ('admin', 'contador'))
  with check (get_mi_rol() in ('admin', 'empleado'));

create policy "caja_empleado_own" on sesiones_caja
  for all to authenticated
  using (
    get_mi_rol() = 'empleado'
    and empleado_id = (select id from empleados where user_id = auth.uid())
  )
  with check (
    get_mi_rol() = 'empleado'
    and empleado_id = (select id from empleados where user_id = auth.uid())
  );

-- =============================================================
-- VENTAS
-- Todos los autenticados leen (necesario para reportes y caja)
-- Admin y empleado pueden crear/modificar
-- Contador solo lectura
-- =============================================================
alter table ventas enable row level security;
drop policy if exists "ventas_auth_read"   on ventas;
drop policy if exists "ventas_staff_write" on ventas;

create policy "ventas_auth_read" on ventas
  for select to authenticated using (true);

create policy "ventas_staff_write" on ventas
  for all to authenticated
  using (get_mi_rol() in ('admin', 'empleado'))
  with check (get_mi_rol() in ('admin', 'empleado'));

-- =============================================================
-- VENTA_ITEMS
-- Mismas reglas que ventas
-- =============================================================
alter table venta_items enable row level security;
drop policy if exists "vitems_auth_read"   on venta_items;
drop policy if exists "vitems_staff_write" on venta_items;

create policy "vitems_auth_read" on venta_items
  for select to authenticated using (true);

create policy "vitems_staff_write" on venta_items
  for all to authenticated
  using (get_mi_rol() in ('admin', 'empleado'))
  with check (get_mi_rol() in ('admin', 'empleado'));

-- =============================================================
-- PAGOS / GASTOS
-- Todos los autenticados leen
-- Admin y empleado pueden registrar
-- Solo admin puede eliminar
-- =============================================================
alter table pagos enable row level security;
drop policy if exists "pagos_auth_read"   on pagos;
drop policy if exists "pagos_staff_write" on pagos;
drop policy if exists "pagos_admin_del"   on pagos;

create policy "pagos_auth_read" on pagos
  for select to authenticated using (true);

create policy "pagos_staff_write" on pagos
  for insert to authenticated
  with check (get_mi_rol() in ('admin', 'empleado'));

create policy "pagos_admin_del" on pagos
  for delete to authenticated
  using (get_mi_rol() = 'admin');

create policy "pagos_admin_update" on pagos
  for update to authenticated
  using (get_mi_rol() = 'admin')
  with check (get_mi_rol() = 'admin');

-- =============================================================
-- PEDIDOS (tienda online)
-- Solo autenticados — los APIs usan service_role (bypasea RLS)
-- =============================================================
alter table pedidos enable row level security;
drop policy if exists "pedidos_auth_all" on pedidos;

create policy "pedidos_auth_all" on pedidos
  for all to authenticated using (true) with check (true);

-- =============================================================
-- PEDIDO_ITEMS
-- =============================================================
alter table pedido_items enable row level security;
drop policy if exists "pitems_auth_all" on pedido_items;

create policy "pitems_auth_all" on pedido_items
  for all to authenticated using (true) with check (true);

-- =============================================================
-- MOVIMIENTOS DE STOCK
-- Todos los autenticados leen (historial visible para todos)
-- Admin y empleado pueden registrar
-- =============================================================
alter table movimientos_stock enable row level security;
drop policy if exists "mstock_auth_read"   on movimientos_stock;
drop policy if exists "mstock_staff_write" on movimientos_stock;

create policy "mstock_auth_read" on movimientos_stock
  for select to authenticated using (true);

create policy "mstock_staff_write" on movimientos_stock
  for insert to authenticated
  with check (get_mi_rol() in ('admin', 'empleado'));

-- =============================================================
-- PROVEEDORES
-- Todos los autenticados leen
-- Solo admin puede modificar
-- =============================================================
alter table proveedores enable row level security;
drop policy if exists "prov_auth_read"   on proveedores;
drop policy if exists "prov_admin_write" on proveedores;

create policy "prov_auth_read" on proveedores
  for select to authenticated using (true);

create policy "prov_admin_write" on proveedores
  for all to authenticated
  using (get_mi_rol() = 'admin')
  with check (get_mi_rol() = 'admin');

-- =============================================================
-- FACTURAS AFIP
-- Todos los autenticados leen
-- Solo admin puede crear/modificar
-- =============================================================
alter table facturas_afip enable row level security;
drop policy if exists "afip_auth_read"   on facturas_afip;
drop policy if exists "afip_admin_write" on facturas_afip;

create policy "afip_auth_read" on facturas_afip
  for select to authenticated using (true);

create policy "afip_admin_write" on facturas_afip
  for all to authenticated
  using (get_mi_rol() = 'admin')
  with check (get_mi_rol() = 'admin');

-- =============================================================
-- CONTEOS DE STOCK
-- Todos los autenticados pueden crear y leer
-- =============================================================
alter table conteos_stock enable row level security;
drop policy if exists "conteos_auth_all" on conteos_stock;

create policy "conteos_auth_all" on conteos_stock
  for all to authenticated using (true) with check (true);

-- =============================================================
-- CONTEO_ITEMS
-- =============================================================
alter table conteo_items enable row level security;
drop policy if exists "conteoitems_auth_all" on conteo_items;

create policy "conteoitems_auth_all" on conteo_items
  for all to authenticated using (true) with check (true);

-- =============================================================
-- FIN — Verificar con:
-- select tablename, policyname, cmd, roles
-- from pg_policies
-- where schemaname = 'public'
-- order by tablename, cmd;
-- =============================================================