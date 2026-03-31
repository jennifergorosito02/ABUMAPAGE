-- =============================================================
-- ABUMA.MA — Schema completo + seed (154 productos)
-- Ejecutar en Supabase > SQL Editor
-- =============================================================

-- ─── TABLAS ──────────────────────────────────────────────────

-- Perfil de usuario (extiende auth.users)
create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  nombre text,
  rol text not null default 'admin' check (rol in ('admin', 'empleado', 'contador')),
  telefono text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- Proveedores
create table if not exists proveedores (
  id serial primary key,
  nombre text not null,
  contacto text,
  telefono text,
  email text,
  direccion text,
  cuit text,
  notas text,
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- Productos
create table if not exists productos (
  id serial primary key,
  sku_display text,
  nombre text not null,
  marca text,
  linea text,
  fragancia text,
  costo numeric(12,2) not null default 0,
  precio_venta numeric(12,2) not null default 0,
  stock integer not null default 0,
  stock_minimo integer not null default 3,
  proveedor_id integer references proveedores(id),
  imagen_url text,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Empleados
create table if not exists empleados (
  id serial primary key,
  user_id uuid references profiles(id),
  nombre text not null,
  dni text,
  telefono text,
  email text,
  rol text,
  salario numeric(12,2),
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

-- Sesiones de caja
create table if not exists sesiones_caja (
  id serial primary key,
  empleado_id integer references empleados(id),
  apertura timestamptz not null default now(),
  cierre timestamptz,
  saldo_inicial numeric(12,2) not null default 0,
  saldo_final numeric(12,2),
  total_ventas numeric(12,2) not null default 0,
  total_efectivo numeric(12,2) not null default 0,
  total_transferencia numeric(12,2) not null default 0,
  total_tarjeta numeric(12,2) not null default 0,
  notas text,
  estado text not null default 'abierta' check (estado in ('abierta', 'cerrada'))
);

-- Ventas
create table if not exists ventas (
  id serial primary key,
  numero_interno text unique,
  sesion_caja_id integer references sesiones_caja(id),
  empleado_id integer references empleados(id),
  cliente_nombre text,
  cliente_email text,
  cliente_cuit text,
  tipo_comprobante text not null default 'ticket'
    check (tipo_comprobante in ('ticket', 'factura_b', 'factura_a', 'factura_c')),
  subtotal numeric(12,2) not null,
  descuento numeric(12,2) not null default 0,
  total numeric(12,2) not null,
  metodo_pago text not null
    check (metodo_pago in ('efectivo', 'transferencia', 'tarjeta', 'mixto')),
  estado text not null default 'completada'
    check (estado in ('completada', 'anulada', 'pendiente')),
  notas text,
  fecha timestamptz not null default now()
);

-- Items de venta
create table if not exists venta_items (
  id serial primary key,
  venta_id integer not null references ventas(id) on delete cascade,
  producto_id integer not null references productos(id),
  cantidad integer not null,
  precio_unitario numeric(12,2) not null,
  subtotal numeric(12,2) not null
);

-- Facturas AFIP
create table if not exists facturas_afip (
  id serial primary key,
  venta_id integer unique references ventas(id),
  tipo_comprobante integer,
  punto_venta integer,
  numero_comprobante bigint,
  cae text,
  vencimiento_cae date,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'emitida', 'error')),
  error_mensaje text,
  created_at timestamptz not null default now()
);

-- Movimientos de stock
create table if not exists movimientos_stock (
  id serial primary key,
  producto_id integer not null references productos(id),
  tipo text not null check (tipo in ('entrada', 'salida', 'ajuste', 'venta')),
  cantidad integer not null,
  stock_anterior integer not null,
  stock_nuevo integer not null,
  motivo text,
  referencia_id integer,
  usuario_id uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- Pagos / Gastos
create table if not exists pagos (
  id serial primary key,
  tipo text not null check (tipo in ('gasto', 'pago_proveedor', 'cobro', 'retiro')),
  concepto text not null,
  monto numeric(12,2) not null,
  fecha date not null default current_date,
  proveedor_id integer references proveedores(id),
  metodo_pago text,
  comprobante_numero text,
  sesion_caja_id integer references sesiones_caja(id),
  notas text,
  usuario_id uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- Configuración de empresa (fila única)
create table if not exists configuracion (
  id integer primary key default 1 check (id = 1),
  razon_social text,
  cuit text,
  domicilio text,
  telefono text,
  email text,
  logo_url text,
  afip_punto_venta integer default 1,
  afip_ambiente text default 'homologacion'
    check (afip_ambiente in ('homologacion', 'produccion')),
  moneda text default 'ARS',
  updated_at timestamptz not null default now()
);

-- ─── FUNCIONES Y TRIGGERS ────────────────────────────────────

create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists productos_updated_at on productos;
create trigger productos_updated_at
  before update on productos
  for each row execute function update_updated_at();

-- Auto-crear perfil al registrar usuario
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, nombre, rol)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'rol', 'admin')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ─── ROW LEVEL SECURITY ──────────────────────────────────────

alter table profiles enable row level security;
alter table proveedores enable row level security;
alter table productos enable row level security;
alter table empleados enable row level security;
alter table sesiones_caja enable row level security;
alter table ventas enable row level security;
alter table venta_items enable row level security;
alter table facturas_afip enable row level security;
alter table movimientos_stock enable row level security;
alter table pagos enable row level security;
alter table configuracion enable row level security;

-- Políticas: acceso total para usuarios autenticados (refinar con roles en Fase 2)
do $$ declare
  t text;
begin
  foreach t in array array[
    'profiles','proveedores','productos','empleados','sesiones_caja',
    'ventas','venta_items','facturas_afip','movimientos_stock','pagos','configuracion'
  ]
  loop
    execute format('drop policy if exists authenticated_all on %I', t);
    execute format(
      'create policy authenticated_all on %I for all to authenticated using (true) with check (true)', t
    );
  end loop;
end $$;

-- ─── DATOS INICIALES ─────────────────────────────────────────

insert into configuracion (id, razon_social, moneda)
values (1, 'ABUMA.MA', 'ARS')
on conflict (id) do nothing;

insert into proveedores (nombre, notas)
values ('La Catedral', 'Proveedor principal de sahumerios')
on conflict do nothing;

-- ─── SEED: 154 PRODUCTOS ─────────────────────────────────────
-- Proveedor ID 1 = La Catedral (para sahumerios Aromanza)

insert into productos (sku_display, nombre, marca, linea, fragancia, costo, precio_venta, stock_minimo, proveedor_id) values
  ('1',  'Aromanza (7 Poderes)',                    'Aromanza', 'Sahumerio Tibetano', '7 Poderes',                    1798, 3800, 5, 1),
  ('2',  'Aromanza (Amazonas Salvaje)',             'Aromanza', 'Sahumerio Tibetano', 'Amazonas Salvaje',             1798, 3800, 5, 1),
  ('3',  'Aromanza (Atrae Dinero)',                 'Aromanza', 'Sahumerio Tibetano', 'Atrae Dinero',                 1798, 3800, 5, 1),
  ('4',  'Aromanza (Benjuí Delicioso)',             'Aromanza', 'Sahumerio Tibetano', 'Benjuí Delicioso',             1798, 3800, 5, 1),
  ('5',  'Aromanza (Berry Kiss)',                   'Aromanza', 'Sahumerio Tibetano', 'Berry Kiss',                   1798, 3800, 5, 1),
  ('6',  'Aromanza (Canela Mística)',               'Aromanza', 'Sahumerio Tibetano', 'Canela Mística',               1798, 3800, 5, 1),
  ('7',  'Aromanza (Capuchino Italiano)',           'Aromanza', 'Sahumerio Tibetano', 'Capuchino Italiano',           1798, 3800, 5, 1),
  ('8',  'Aromanza (Chandan)',                      'Aromanza', 'Sahumerio Tibetano', 'Chandan',                      1798, 3800, 5, 1),
  ('9',  'Aromanza (Choco Dubai)',                  'Aromanza', 'Sahumerio Tibetano', 'Choco Dubai',                  1798, 3800, 5, 1),
  ('10', 'Aromanza (Coco Beach)',                   'Aromanza', 'Sahumerio Tibetano', 'Coco Beach',                   1798, 3800, 5, 1),
  ('11', 'Aromanza (Coco Vai)',                     'Aromanza', 'Sahumerio Tibetano', 'Coco Vai',                     1798, 3800, 5, 1),
  ('12', 'Aromanza (Coconut)',                      'Aromanza', 'Sahumerio Tibetano', 'Coconut',                      1798, 3800, 5, 1),
  ('13', 'Aromanza (Copal Andino)',                 'Aromanza', 'Sahumerio Tibetano', 'Copal Andino',                 1798, 3800, 5, 1),
  ('14', 'Aromanza (Diamante Negro)',               'Aromanza', 'Sahumerio Tibetano', 'Diamante Negro',               1798, 3800, 5, 1),
  ('15', 'Aromanza (Dulces Frutillas)',             'Aromanza', 'Sahumerio Tibetano', 'Dulces Frutillas',             1798, 3800, 5, 1),
  ('16', 'Aromanza (Ébano Marfil)',                 'Aromanza', 'Sahumerio Tibetano', 'Ébano Marfil',                 1798, 3800, 5, 1),
  ('17', 'Aromanza (Encanto de Chocolate)',         'Aromanza', 'Sahumerio Tibetano', 'Encanto de Chocolate',         1798, 3800, 5, 1),
  ('18', 'Aromanza (Energía Limpia)',               'Aromanza', 'Sahumerio Tibetano', 'Energía Limpia',               1798, 3800, 5, 1),
  ('19', 'Aromanza (Esencia de la India)',          'Aromanza', 'Sahumerio Tibetano', 'Esencia de la India',          1798, 3800, 5, 1),
  ('20', 'Aromanza (Flores de Manzanilla)',         'Aromanza', 'Sahumerio Tibetano', 'Flores de Manzanilla',         1798, 3800, 5, 1),
  ('21', 'Aromanza (Fragancia Oriental)',           'Aromanza', 'Sahumerio Tibetano', 'Fragancia Oriental',           1798, 3800, 5, 1),
  ('22', 'Aromanza (Frescura del Bosque)',          'Aromanza', 'Sahumerio Tibetano', 'Frescura del Bosque',          1798, 3800, 5, 1),
  ('23', 'Aromanza (Frutos Rojos)',                 'Aromanza', 'Sahumerio Tibetano', 'Frutos Rojos',                 1798, 3800, 5, 1),
  ('24', 'Aromanza (Gardenias y Flores Blancas)',   'Aromanza', 'Sahumerio Tibetano', 'Gardenias y Flores Blancas',   1798, 3800, 5, 1),
  ('25', 'Aromanza (Green Bambú)',                  'Aromanza', 'Sahumerio Tibetano', 'Green Bambú',                  1798, 3800, 5, 1),
  ('26', 'Aromanza (Guía Espiritual)',              'Aromanza', 'Sahumerio Tibetano', 'Guía Espiritual',              1798, 3800, 5, 1),
  ('27', 'Aromanza (Incienso Consagrado)',          'Aromanza', 'Sahumerio Tibetano', 'Incienso Consagrado',          1798, 3800, 5, 1),
  ('28', 'Aromanza (Jazmín)',                       'Aromanza', 'Sahumerio Tibetano', 'Jazmín',                       1798, 3800, 5, 1),
  ('29', 'Aromanza (Krishna)',                      'Aromanza', 'Sahumerio Tibetano', 'Krishna',                      1798, 3800, 5, 1),
  ('30', 'Aromanza (La Vida es Bella)',             'Aromanza', 'Sahumerio Tibetano', 'La Vida es Bella',             1798, 3800, 5, 1),
  ('31', 'Aromanza (Lavanda del Valle)',            'Aromanza', 'Sahumerio Tibetano', 'Lavanda del Valle',            1798, 3800, 5, 1),
  ('32', 'Aromanza (Limón Miel Orgánica)',          'Aromanza', 'Sahumerio Tibetano', 'Limón Miel Orgánica',          1798, 3800, 5, 1),
  ('33', 'Aromanza (Magia Asiática)',               'Aromanza', 'Sahumerio Tibetano', 'Magia Asiática',               1798, 3800, 5, 1),
  ('34', 'Aromanza (Manzana Canela)',               'Aromanza', 'Sahumerio Tibetano', 'Manzana Canela',               1798, 3800, 5, 1),
  ('35', 'Aromanza (Mirra Consagrada)',             'Aromanza', 'Sahumerio Tibetano', 'Mirra Consagrada',             1798, 3800, 5, 1),
  ('36', 'Aromanza (Mix Fragancias)',               'Aromanza', 'Sahumerio Tibetano', 'Mix Fragancias',               1798, 3800, 5, 1),
  ('37', 'Aromanza (Naranja Pimienta)',             'Aromanza', 'Sahumerio Tibetano', 'Naranja Pimienta',             1798, 3800, 5, 1),
  ('38', 'Aromanza (Néctar de los Dioses)',         'Aromanza', 'Sahumerio Tibetano', 'Néctar de los Dioses',         1798, 3800, 5, 1),
  ('39', 'Aromanza (Noche de Ensueños)',            'Aromanza', 'Sahumerio Tibetano', 'Noche de Ensueños',            1798, 3800, 5, 1),
  ('40', 'Aromanza (Opium Exotic)',                 'Aromanza', 'Sahumerio Tibetano', 'Opium Exotic',                 1798, 3800, 5, 1),
  ('41', 'Aromanza (Pastelería Francesa)',          'Aromanza', 'Sahumerio Tibetano', 'Pastelería Francesa',          1798, 3800, 5, 1),
  ('42', 'Aromanza (Pimpollos de Jazmín)',          'Aromanza', 'Sahumerio Tibetano', 'Pimpollos de Jazmín',          1798, 3800, 5, 1),
  ('43', 'Aromanza (Placeres del Paraíso)',         'Aromanza', 'Sahumerio Tibetano', 'Placeres del Paraíso',         1798, 3800, 5, 1),
  ('44', 'Aromanza (Premium Lemon)',                'Aromanza', 'Sahumerio Tibetano', 'Premium Lemon',                1798, 3800, 5, 1),
  ('45', 'Aromanza (Protección Energética)',        'Aromanza', 'Sahumerio Tibetano', 'Protección Energética',        1798, 3800, 5, 1),
  ('46', 'Aromanza (Ratnamala)',                    'Aromanza', 'Sahumerio Tibetano', 'Ratnamala',                    1798, 3800, 5, 1),
  ('47', 'Aromanza (Real Champa)',                  'Aromanza', 'Sahumerio Tibetano', 'Real Champa',                  1798, 3800, 5, 1),
  ('48', 'Aromanza (Real Rose)',                    'Aromanza', 'Sahumerio Tibetano', 'Real Rose',                    1798, 3800, 5, 1),
  ('49', 'Aromanza (Reina de la Noche)',            'Aromanza', 'Sahumerio Tibetano', 'Reina de la Noche',            1798, 3800, 5, 1),
  ('50', 'Aromanza (Rosa Real)',                    'Aromanza', 'Sahumerio Tibetano', 'Rosa Real',                    1798, 3800, 5, 1),
  ('51', 'Aromanza (Sai Flora)',                    'Aromanza', 'Sahumerio Tibetano', 'Sai Flora',                    1798, 3800, 5, 1),
  ('52', 'Aromanza (Sándalo Hindú)',                'Aromanza', 'Sahumerio Tibetano', 'Sándalo Hindú',                1798, 3800, 5, 1),
  ('53', 'Aromanza (Salvia Blanca)',                'Aromanza', 'Sahumerio Tibetano', 'Salvia Blanca',                1798, 3800, 5, 1),
  ('54', 'Aromanza (Super Palo Santo)',             'Aromanza', 'Sahumerio Tibetano', 'Super Palo Santo',             1798, 3800, 5, 1),
  ('55', 'Aromanza (Titanium)',                     'Aromanza', 'Sahumerio Tibetano', 'Titanium',                     1798, 3800, 5, 1),
  ('56', 'Aromanza (Vainilla Coco)',                'Aromanza', 'Sahumerio Tibetano', 'Vainilla Coco',                1798, 3800, 5, 1),
  ('57', 'Aromanza (Vainilla Encantada)',           'Aromanza', 'Sahumerio Tibetano', 'Vainilla Encantada',           1798, 3800, 5, 1),
  ('58', 'Aromanza (Violetas de Persia)',           'Aromanza', 'Sahumerio Tibetano', 'Violetas de Persia',           1798, 3800, 5, 1),
  ('59', 'Aromanza (Viva la Vida)',                 'Aromanza', 'Sahumerio Tibetano', 'Viva la Vida',                 1798, 3800, 5, 1),
  ('60', 'Aromanza (Vrindavan)',                    'Aromanza', 'Sahumerio Tibetano', 'Vrindavan',                    1798, 3800, 5, 1),
  ('61', 'Aromanza (Wanama Coco)',                  'Aromanza', 'Sahumerio Tibetano', 'Wanama Coco',                  1798, 3800, 5, 1),
  ('62', 'Aromanza (Yagra de la Abundancia)',       'Aromanza', 'Sahumerio Tibetano', 'Yagra de la Abundancia',       1798, 3800, 5, 1),
  -- Vela Larga Lisa
  ('6',  'Vela Larga Lisa Amarilla',  null, 'Vela Larga Lisa', null, 183, 500, 3, null),
  ('7',  'Vela Larga Lisa Azul',      null, 'Vela Larga Lisa', null, 183, 500, 3, null),
  ('8',  'Vela Larga Lisa Blanca',    null, 'Vela Larga Lisa', null, 183, 500, 3, null),
  ('9',  'Vela Larga Roja',           null, 'Vela Larga Lisa', null, 183, 500, 3, null),
  ('10', 'Vela Larga Lisa Celeste',   null, 'Vela Larga Lisa', null, 183, 500, 3, null),
  ('11', 'Vela Larga Lisa Dorada',    null, 'Vela Larga Lisa', null, 183, 500, 3, null),
  ('12', 'Vela Larga Lisa Rosa',      null, 'Vela Larga Lisa', null, 183, 500, 3, null),
  ('13', 'Vela Larga Lisa Violeta',   null, 'Vela Larga Lisa', null, 183, 500, 3, null),
  ('14', 'Vela Larga Lisa Naranja',   null, 'Vela Larga Lisa', null, 183, 500, 3, null),
  ('15', 'Vela Larga Lisa Negra',     null, 'Vela Larga Lisa', null, 183, 500, 3, null),
  ('16', 'Vela Larga Lisa Plateada',  null, 'Vela Larga Lisa', null, 183, 500, 3, null),
  ('19', 'Vela Larga Lisa Verde',     null, 'Vela Larga Lisa', null, 183, 500, 3, null),
  ('20', 'Vela Larga Lisa Violeta 2', null, 'Vela Larga Lisa', null, 183, 500, 3, null),
  (null, 'Vela Larga 7 Colores',      null, 'Vela Larga Lisa', null,   0,   0, 3, null),
  -- Vela Larga Combinada
  ('76',  'Blanco - Negro (San La Muerte)',          null, 'Vela Larga Combinada', null, 227, 550, 3, null),
  ('77',  'Verde - Blanco - Rojo (San Jorge)',       null, 'Vela Larga Combinada', null, 227, 550, 3, null),
  ('78',  'Verde - Rojo (Expedito)',                 null, 'Vela Larga Combinada', null, 227, 550, 3, null),
  ('79',  'Rojo - Blanco - Negro (Cipriano)',        null, 'Vela Larga Combinada', null, 227, 550, 3, null),
  ('80',  'Negro - Rojo (Exu)',                      null, 'Vela Larga Combinada', null, 227, 550, 3, null),
  ('81',  'Rojo - Negro (Pomba Gira)',               null, 'Vela Larga Combinada', null, 227, 550, 3, null),
  ('82',  'Negro - Blanco (Preto)',                  null, 'Vela Larga Combinada', null, 227, 550, 3, null),
  ('83',  'Rojo - Blanco (Barbara)',                 null, 'Vela Larga Combinada', null, 227, 550, 3, null),
  ('84',  'Blanco - Rojo (Marcos Xango)',            null, 'Vela Larga Combinada', null, 227, 550, 3, null),
  ('85',  'Blanco - Amarillo (San Cayetano)',        null, 'Vela Larga Combinada', null, 227, 550, 3, null),
  ('86',  'Rojo - Verde (Catalina)',                 null, 'Vela Larga Combinada', null, 227, 550, 3, null),
  ('87',  'Blanco - Celeste (Iemanja-Lourdes)',      null, 'Vela Larga Combinada', null, 227, 550, 3, null),
  ('88',  'Blanco - Verde (San Pantaleon)',          null, 'Vela Larga Combinada', null, 227, 550, 3, null),
  ('89',  'Amarillo - Verde (Oxaña)',                null, 'Vela Larga Combinada', null, 227, 550, 3, null),
  ('90',  'Rosa - Celeste (Cosme y Damian)',         null, 'Vela Larga Combinada', null, 227, 550, 3, null),
  ('91',  'Verde - Negro (Ogum)',                    null, 'Vela Larga Combinada', null, 227, 550, 3, null),
  ('92',  'Verde - Blanco - Negro (Santa Rita)',     null, 'Vela Larga Combinada', null, 227, 550, 3, null),
  ('93',  'Verde - Amarillo - Rojo (Caboclo)',       null, 'Vela Larga Combinada', null, 227, 550, 3, null),
  ('94',  'Rosa - Blanco - Cel. (S. Nicolás)',       null, 'Vela Larga Combinada', null, 227, 550, 3, null),
  ('95',  'Amarillo - Marrón (Onofre)',              null, 'Vela Larga Combinada', null, 227, 550, 3, null),
  ('96',  'Rosa - Negro (Xapana)',                   null, 'Vela Larga Combinada', null, 227, 550, 3, null),
  ('97',  'Rojo - Blanco - Azul (Desatanudos)',      null, 'Vela Larga Combinada', null, 227, 550, 3, null),
  ('98',  'Rojo - Verde - Negro (Ogum Mege)',        null, 'Vela Larga Combinada', null, 227, 550, 3, null),
  ('99',  'Urkupiña - Rojo - Amarillo - Verde',      null, 'Vela Larga Combinada', null, 227, 550, 3, null),
  ('100', 'Amarillo - Blanco - Rojo (Mística)',      null, 'Vela Larga Combinada', null, 227, 550, 3, null),
  -- Vela Corta
  ('101', 'Vela Corta Blanca',   null, 'Vela Corta', null, 116, 400, 5, null),
  ('102', 'Vela Corta Negra',    null, 'Vela Corta', null, 116, 400, 5, null),
  ('103', 'Vela Corta Amarilla', null, 'Vela Corta', null, 116, 400, 5, null),
  ('104', 'Vela Corta Roja',     null, 'Vela Corta', null, 116, 400, 5, null),
  ('105', 'Vela Corta Azul',     null, 'Vela Corta', null, 116, 400, 5, null),
  ('106', 'Vela Corta Naranja',  null, 'Vela Corta', null, 116, 400, 5, null),
  ('107', 'Vela Corta Verde',    null, 'Vela Corta', null, 116, 400, 5, null),
  ('108', 'Vela Corta Rosa',     null, 'Vela Corta', null, 116, 400, 5, null),
  ('109', 'Vela Corta Celeste',  null, 'Vela Corta', null, 116, 400, 5, null),
  ('110', 'Vela Corta Violeta',  null, 'Vela Corta', null, 116, 400, 5, null),
  ('111', 'Vela Corta Marrón',   null, 'Vela Corta', null, 116, 400, 5, null),
  -- Velón 7 Días — color sólido
  (null, 'Velón 7 Días Blanco',   null, 'Velón 7 Días', null, 2145, 4500, 3, null),
  (null, 'Velón 7 Días Rojo',     null, 'Velón 7 Días', null, 2145, 4500, 3, null),
  (null, 'Velón 7 Días Celeste',  null, 'Velón 7 Días', null, 2145, 4500, 3, null),
  (null, 'Velón 7 Días Negro',    null, 'Velón 7 Días', null, 2145, 4500, 3, null),
  (null, 'Velón 7 Días Verde',    null, 'Velón 7 Días', null, 2145, 4500, 3, null),
  (null, 'Velón 7 Días Violeta',  null, 'Velón 7 Días', null, 2145, 4500, 3, null),
  (null, 'Velón 7 Días Azul',     null, 'Velón 7 Días', null, 2145, 4500, 3, null),
  (null, 'Velón 7 Días Rosa',     null, 'Velón 7 Días', null, 2145, 4500, 3, null),
  (null, 'Velón 7 Días Naranja',  null, 'Velón 7 Días', null, 2145, 4500, 3, null),
  (null, 'Velón 7 Días Marrón',   null, 'Velón 7 Días', null, 2145, 4500, 3, null),
  (null, 'Velón 7 Días Lila',     null, 'Velón 7 Días', null, 2145, 4500, 3, null),
  (null, 'Velón 7 Días Miel',     null, 'Velón 7 Días', null, 2145, 4500, 3, null),
  (null, 'Velón 7 Días Fucsia',   null, 'Velón 7 Días', null, 2145, 4500, 3, null),
  (null, 'Velón 7 Días Amarillo', null, 'Velón 7 Días', null, 2145, 4500, 3, null),
  -- Velón 7 Días — combinado
  (null, 'Velón 7 Días Blanco - Negro',           null, 'Velón 7 Días', null, 2210, 4500, 3, null),
  (null, 'Velón 7 Días Verde - Blanco - Rojo',    null, 'Velón 7 Días', null, 2210, 4500, 3, null),
  (null, 'Velón 7 Días Rojo - Negro',             null, 'Velón 7 Días', null, 2210, 4500, 3, null),
  (null, 'Velón 7 Días Negro - Rojo',             null, 'Velón 7 Días', null, 2210, 4500, 3, null),
  (null, 'Velón 7 Días Verde - Roja',             null, 'Velón 7 Días', null, 2210, 4500, 3, null),
  (null, 'Velón 7 Días Rojo - Blanco',            null, 'Velón 7 Días', null, 2210, 4500, 3, null),
  (null, 'Velón 7 Días Blanco - Rojo',            null, 'Velón 7 Días', null, 2210, 4500, 3, null),
  (null, 'Velón 7 Días Rojo - Blanco - Negro',    null, 'Velón 7 Días', null, 2210, 4500, 3, null),
  (null, 'Velón 7 Días Negro - Blanco',           null, 'Velón 7 Días', null, 2210, 4500, 3, null),
  (null, 'Velón 7 Días Verde - Negro',            null, 'Velón 7 Días', null, 2210, 4500, 3, null),
  (null, 'Velón 7 Días Rojo - Verde',             null, 'Velón 7 Días', null, 2210, 4500, 3, null),
  (null, 'Velón 7 Días Verde - Amarillo - Rojo',  null, 'Velón 7 Días', null, 2210, 4500, 3, null),
  (null, 'Velón 7 Días Blanco - Celeste',         null, 'Velón 7 Días', null, 2210, 4500, 3, null),
  (null, 'Velón 7 Días Amarillo - Verde',         null, 'Velón 7 Días', null, 2210, 4500, 3, null),
  (null, 'Velón 7 Días Rosa - Celeste',           null, 'Velón 7 Días', null, 2210, 4500, 3, null),
  (null, 'Velón 7 Días Rojo - Verde - Negro',     null, 'Velón 7 Días', null, 2210, 4500, 3, null),
  (null, 'Velón 7 Días Rosa - Blanco - Cel.',     null, 'Velón 7 Días', null, 2210, 4500, 3, null),
  (null, 'Velón 7 Días Verde - Blanco - Negro',   null, 'Velón 7 Días', null, 2210, 4500, 3, null),
  (null, 'Velón 7 Días Amarillo - Marrón',        null, 'Velón 7 Días', null, 2210, 4500, 3, null),
  (null, 'Velón 7 Días Blanco - Amarillo',        null, 'Velón 7 Días', null, 2210, 4500, 3, null),
  (null, 'Velón 7 Días Rosa - Negro',             null, 'Velón 7 Días', null, 2210, 4500, 3, null),
  (null, 'Velón 7 Días Blanco - Verde',           null, 'Velón 7 Días', null, 2210, 4500, 3, null),
  (null, 'Velón 7 Días Rojo - Amarillo - Verde',  null, 'Velón 7 Días', null, 2210, 4500, 3, null),
  (null, 'Velón 7 Días Amarillo - Blanco - Rojo', null, 'Velón 7 Días', null, 2210, 4500, 3, null),
  (null, 'Velón 7 Días Rojo - Blanco - Azul',     null, 'Velón 7 Días', null, 2210, 4500, 3, null),
  -- Velón 7 Días especiales
  (null, 'Velón 7 Días Dorado',    null, 'Velón 7 Días', null, 4268, 8500, 2, null),
  (null, 'Velón 7 Días Plateado',  null, 'Velón 7 Días', null, 4268, 8500, 2, null),
  (null, 'Velón 7 Días 7 Colores', null, 'Velón 7 Días', null, 3518, 7000, 2, null);

-- Verificación
select count(*) as total_productos from productos;
-- Debe retornar 154
