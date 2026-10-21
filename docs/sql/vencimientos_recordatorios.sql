-- Módulo de vencimientos / recordatorios: sin envíos automáticos.
-- Aditivo. Solo administradores activos operan desde el navegador.
begin;
create table public.vencimientos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.clientes(id),
  titulo text not null check (length(btrim(titulo)) between 3 and 160),
  detalle text not null default '',
  fecha_vencimiento date not null,
  periodicidad_meses integer check(periodicidad_meses is null or periodicidad_meses between 1 and 120),
  avisos_dias integer[] not null default array[30,7,0]::integer[]
    check(avisos_dias <@ array[0,7,30]::integer[]),
  activo boolean not null default true,
  whatsapp_autorizado boolean not null default false,
  whatsapp_autorizacion_fuente text,
  created_by uuid not null default auth.uid() references public.perfiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vencimientos_consentimiento check (
    (not whatsapp_autorizado) or
    (whatsapp_autorizacion_fuente is not null and length(btrim(whatsapp_autorizacion_fuente)) >= 5)
  )
);
create index vencimientos_fecha_activos on public.vencimientos(fecha_vencimiento) where activo;
create index vencimientos_cliente on public.vencimientos(cliente_id);
alter table public.vencimientos enable row level security;
revoke all on public.vencimientos from anon, authenticated;
grant select,insert,update on public.vencimientos to authenticated;
create policy vencimientos_admin_lectura on public.vencimientos for select to authenticated
  using ((select public.is_admin()));
create policy vencimientos_admin_alta on public.vencimientos for insert to authenticated
  with check ((select public.is_admin()) and created_by=(select auth.uid()));
create policy vencimientos_admin_edicion on public.vencimientos for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()) and created_by is not null);

create table public.vencimientos_renovaciones (
  id uuid primary key default gen_random_uuid(),
  vencimiento_id uuid not null references public.vencimientos(id),
  fecha_anterior date not null,
  fecha_nueva date not null,
  actualizado_por uuid references public.perfiles(id),
  registrado_en timestamptz not null default now()
);
alter table public.vencimientos_renovaciones enable row level security;
revoke all on public.vencimientos_renovaciones from anon,authenticated;
grant select on public.vencimientos_renovaciones to authenticated;
create policy vencimientos_renovaciones_admin on public.vencimientos_renovaciones
  for select to authenticated using ((select public.is_admin()));
create index vencimientos_renovaciones_historial
  on public.vencimientos_renovaciones(vencimiento_id,registrado_en desc);

-- Solo es posible declarar un contacto manual por vencimiento, ciclo y antelación.
-- Los envíos por API se escribirán con el resultado REAL del proveedor desde backend.
create table public.vencimientos_avisos (
  id uuid primary key default gen_random_uuid(),
  vencimiento_id uuid not null references public.vencimientos(id),
  fecha_vencimiento date not null,
  dias_antes integer not null check (dias_antes in (0,7,30)),
  canal text not null check(canal in ('manual_whatsapp','whatsapp_api')),
  resultado text not null check(resultado in ('contacto_declarado','reservado','enviado','fallido')),
  proveedor_id text,
  registrado_por uuid references public.perfiles(id) default auth.uid(),
  registrado_en timestamptz not null default now(),
  unique(vencimiento_id,fecha_vencimiento,dias_antes),
  constraint aviso_manual_solo_declarado check (
    (canal='manual_whatsapp' and resultado='contacto_declarado' and proveedor_id is null)
    or canal='whatsapp_api'
  )
);
create index vencimientos_avisos_historial on public.vencimientos_avisos(vencimiento_id,registrado_en desc);
alter table public.vencimientos_avisos enable row level security;
revoke all on public.vencimientos_avisos from anon,authenticated;
grant select,insert on public.vencimientos_avisos to authenticated;
create policy vencimientos_avisos_admin_ver on public.vencimientos_avisos
 for select to authenticated using ((select public.is_admin()));
create policy vencimientos_avisos_admin_registro_manual on public.vencimientos_avisos
 for insert to authenticated with check (
  (select public.is_admin()) and registrado_por=(select auth.uid())
  and canal='manual_whatsapp' and resultado='contacto_declarado'
  and proveedor_id is null
  and exists (
    select 1 from public.vencimientos v
    where v.id=vencimiento_id and v.fecha_vencimiento=vencimientos_avisos.fecha_vencimiento
      and v.activo and v.whatsapp_autorizado
      and dias_antes=any(v.avisos_dias)
  )
 );

-- Funciones de auditoría privadas: no conceder ejecución directa a clientes.
create schema if not exists vencimientos_privado;
revoke all on schema vencimientos_privado from public,anon,authenticated;
create function vencimientos_privado.al_editar()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.id is distinct from old.id or new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at then
   raise exception 'La autoría del vencimiento es inmutable.';
 end if;
 if new.fecha_vencimiento is distinct from old.fecha_vencimiento then
   insert into public.vencimientos_renovaciones(vencimiento_id,fecha_anterior,fecha_nueva,actualizado_por)
   values(new.id,old.fecha_vencimiento,new.fecha_vencimiento,auth.uid());
 end if;
 new.updated_at:=now();
 return new;
end $$;
revoke all on function vencimientos_privado.al_editar() from public,anon,authenticated;
create trigger vencimientos_al_editar before update on public.vencimientos
 for each row execute function vencimientos_privado.al_editar();

-- Para el bot futuro: solo service_role, sin exponer teléfonos por API pública.
-- Coincidencia exacta de fecha para no enviar campañas retroactivas al activar el bot.
create function public.vencimientos_avisos_del_dia(p_fecha date)
returns table(vencimiento_id uuid,cliente_id uuid,telefono text,
  titulo text,fecha_vencimiento date,dias_antes integer)
language sql stable security invoker set search_path='' as $$
 select v.id,c.id,c.telefono_principal,v.titulo,v.fecha_vencimiento,ad.dias
 from public.vencimientos v
 join public.clientes c on c.id=v.cliente_id
 cross join lateral unnest(v.avisos_dias) as ad(dias)
 where v.activo and v.whatsapp_autorizado
  and length(btrim(coalesce(v.whatsapp_autorizacion_fuente,'')))>=5
  and c.activo and length(btrim(c.telefono_principal))>=8
  and v.fecha_vencimiento - ad.dias=p_fecha
  and not exists(select 1 from public.vencimientos_avisos a
     where a.vencimiento_id=v.id and a.fecha_vencimiento=v.fecha_vencimiento
       and a.dias_antes=ad.dias);
$$;
revoke all on function public.vencimientos_avisos_del_dia(date) from public,anon,authenticated;
grant execute on function public.vencimientos_avisos_del_dia(date) to service_role;
grant select,insert,update on public.vencimientos_avisos to service_role;
commit;
