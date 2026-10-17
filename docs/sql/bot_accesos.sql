begin;
create table public.bot_accesos (
 id uuid primary key default gen_random_uuid(),
 numero text not null unique check(numero ~ '^\+[1-9][0-9]{7,14}$'),
 perfil_id uuid not null references public.perfiles(id),
 activo boolean not null default false,
 permisos text[] not null default '{}' check(permisos <@ array['gastos.registrar','cobros.registrar','deudas.registrar','movimientos.ver_propios','deudas.consultar','caja.consultar','agenda.consultar','agenda.registrar']::text[]),
 version integer not null default 1,
 created_by uuid not null default auth.uid() references public.perfiles(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.bot_accesos enable row level security;
revoke all on public.bot_accesos from anon,authenticated;
grant select,insert,update on public.bot_accesos to authenticated;
create policy bot_admin_select on public.bot_accesos for select to authenticated using ((select public.is_admin()));
create policy bot_admin_insert on public.bot_accesos for insert to authenticated with check ((select public.is_admin()) and created_by=(select auth.uid()));
create policy bot_admin_update on public.bot_accesos for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create table public.bot_accesos_historial (
 id bigint generated always as identity primary key,
 acceso_id uuid not null references public.bot_accesos(id),
 fecha timestamptz not null default now(),
 administrador_id uuid not null references public.perfiles(id),
 administrador_nombre text not null,
 persona_nombre text not null,
 persona_rol text not null,
 antes jsonb,
 despues jsonb not null
);
alter table public.bot_accesos_historial enable row level security;
revoke all on public.bot_accesos_historial from anon,authenticated;
grant select on public.bot_accesos_historial to authenticated;
create policy bot_historial_admin on public.bot_accesos_historial for select to authenticated using ((select public.is_admin()));
create index bot_historial_acceso_fecha on public.bot_accesos_historial(acceso_id,fecha desc);
create index bot_accesos_perfil on public.bot_accesos(perfil_id);
create schema if not exists bot_privado;
revoke all on schema bot_privado from public,anon,authenticated;
create function bot_privado.validar_acceso() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if not coalesce(public.is_admin(),false) then raise exception 'Solo un administrador activo puede administrar el bot.' using errcode='42501'; end if;
 if not exists(select 1 from public.perfiles where id=new.perfil_id and rol in ('admin','colaborador','tecnico') and activo and estado='activo') then
  -- Revocar debe seguir siendo posible aunque la persona ya esté desactivada.
  if tg_op='INSERT' or new.activo or new.perfil_id is distinct from old.perfil_id then raise exception 'Seleccioná una persona interna activa.'; end if;
 end if;
 if tg_op='UPDATE' then
  if new.id<>old.id or new.created_by<>old.created_by or new.created_at<>old.created_at then raise exception 'No se puede modificar la autoría original.'; end if;
  new.version:=old.version+1;
 else new.version:=1; end if;
 new.updated_at:=now();
 return new;
end $$;
create trigger bot_acceso_validar before insert or update on public.bot_accesos for each row execute function bot_privado.validar_acceso();
create function bot_privado.auditar_acceso() returns trigger language plpgsql security definer set search_path='' as $$
declare actor text; persona text; rol_persona text;
begin
 if auth.uid() is null or not coalesce(public.is_admin(),false) then raise exception 'Administrador requerido.' using errcode='42501'; end if;
 select concat_ws(' ',nombre,apellido) into actor from public.perfiles where id=auth.uid();
 select concat_ws(' ',nombre,apellido),rol into persona,rol_persona from public.perfiles where id=new.perfil_id;
 insert into public.bot_accesos_historial(acceso_id,administrador_id,administrador_nombre,persona_nombre,persona_rol,antes,despues)
 values(new.id,auth.uid(),coalesce(actor,''),coalesce(persona,''),rol_persona,case when tg_op='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));
 return new;
end $$;
revoke all on function bot_privado.auditar_acceso() from public,anon,authenticated;
revoke all on function bot_privado.validar_acceso() from public,anon,authenticated;
create trigger bot_acceso_auditar after insert or update on public.bot_accesos for each row execute function bot_privado.auditar_acceso();
-- Contrato para el futuro backend: verificar en cada acción y otra vez al confirmar.
-- Solo el backend puede consultar este control; nunca entregar service_role al navegador.
create function public.bot_autorizar(p_numero text,p_permiso text,p_version integer default null)
returns table(acceso_id uuid,perfil_id uuid,version integer)
language sql stable security invoker set search_path='' as $$
 select a.id,a.perfil_id,a.version from public.bot_accesos a join public.perfiles p on p.id=a.perfil_id
 where a.numero=p_numero and a.activo and p.activo and p.estado='activo' and p.rol in ('admin','colaborador','tecnico')
 and p_permiso=any(a.permisos) and (p_version is null or a.version=p_version);
$$;
revoke all on function public.bot_autorizar(text,text,integer) from public,anon,authenticated;
grant execute on function public.bot_autorizar(text,text,integer) to service_role;
grant select on public.bot_accesos to service_role;
create table public.bot_actividad (
 id uuid primary key default gen_random_uuid(),
 evento_id text not null unique,
 acceso_id uuid not null references public.bot_accesos(id),
 perfil_id uuid not null references public.perfiles(id),
 numero text not null,
 persona_nombre text not null,
 persona_rol text not null,
 accion text not null,
 resultado text not null check(resultado in ('confirmado','rechazado','consultado','cancelado','error')),
 movimiento_id uuid references public.caja_movimientos(id),
 fecha timestamptz not null default now()
);
alter table public.bot_actividad enable row level security;
revoke all on public.bot_actividad from anon,authenticated;
grant select on public.bot_actividad to authenticated;
grant select,insert on public.bot_actividad to service_role;
create policy bot_actividad_admin on public.bot_actividad for select to authenticated using ((select public.is_admin()));
create index bot_actividad_acceso_fecha on public.bot_actividad(acceso_id,fecha desc);
commit;
