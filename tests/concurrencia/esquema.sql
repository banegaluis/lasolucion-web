
   create table clientes(id uuid primary key default gen_random_uuid(),activo boolean default true);
   create table direcciones_clientes(id uuid primary key default gen_random_uuid(),cliente_id uuid references clientes,activo boolean default true,direccion_completa text);
   create table ordenes(id uuid primary key default gen_random_uuid(),numero_orden bigint generated always as identity,cliente_id uuid references clientes,direccion_cliente_id uuid references direcciones_clientes,titulo text,fecha_programada date,hora_inicio time,hora_fin time,estado text,created_by uuid,direccion_snapshot jsonb);
   create table bot_borradores(evento_id text,acceso_id uuid,perfil_id uuid,version_acceso int,numero text,tipo text,texto text);
   create table laso_turnos_confirmacion(id uuid primary key default gen_random_uuid(),codigo text,acceso_id uuid,perfil_id uuid,version_acceso int,creado timestamptz default now(),cliente_id uuid,direccion_id uuid,titulo text,fecha date,inicio time,fin time,orden_id uuid,forzar_fallo boolean default false,check(not forzar_fallo or orden_id is null));
create table perfiles(id uuid primary key,activo boolean,estado text,rol text);
create table bot_accesos(id uuid primary key,perfil_id uuid,numero text,activo boolean,permisos text[],version integer);
