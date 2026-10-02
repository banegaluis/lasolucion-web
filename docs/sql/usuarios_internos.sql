-- Usuarios internos: solo el servidor administra las cuentas; clientes sin acceso.
create or replace function public.proteger_permisos_perfil()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role') then return new; end if;
  if new.id is distinct from old.id or new.rol is distinct from old.rol
     or new.estado is distinct from old.estado or new.activo is distinct from old.activo then
    raise exception 'Los permisos se administran desde Usuarios.' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists perfiles_proteger_permisos on public.perfiles;
create trigger perfiles_proteger_permisos before update on public.perfiles
for each row execute function public.proteger_permisos_perfil();

-- No aceptar perfiles nuevos ni vínculos de identidad desde un navegador.
drop policy if exists perfiles_insert_admin on public.perfiles;
drop policy if exists tecnicos_insert_admin_colaborador on public.tecnicos;
drop policy if exists tecnicos_update_admin_colaborador on public.tecnicos;

create or replace function public.current_tecnico_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select t.id from public.tecnicos t where t.perfil_id = auth.uid() and t.activo = true
    and public.current_user_role() = 'tecnico' limit 1;
$$;
-- Los clientes no pueden consultar datos del CRM aunque tengan un token anterior.
create or replace function public.current_cliente_id()
returns uuid language sql stable security invoker set search_path = '' as $$ select null::uuid; $$;

create or replace function public.administrar_perfil_interno(
  p_actor uuid, p_id uuid, p_nombre text, p_apellido text, p_telefono text,
  p_rol text, p_estado text, p_crear boolean
) returns void language plpgsql security invoker set search_path = '' as $$
declare existente public.perfiles%rowtype;
begin
  perform pg_catalog.pg_advisory_xact_lock(736291004);
  if not exists(select 1 from public.perfiles where id=p_actor and rol='admin' and activo and estado='activo') then
    raise exception 'Solo un administrador activo puede gestionar usuarios.';
  end if;
  if p_rol not in ('admin','colaborador','tecnico') or p_estado not in ('activo','inactivo','bloqueado','pendiente') then
    raise exception 'Rol o estado inválido.';
  end if;
  select * into existente from public.perfiles where id=p_id;
  if p_crear and found then return; end if;
  if not p_crear and not found then raise exception 'Perfil inexistente.'; end if;
  if not p_crear and p_id=p_actor and (p_rol<>'admin' or p_estado<>'activo') then
    raise exception 'No podés deshabilitar tu propia administración.';
  end if;
  if p_crear then
    insert into public.perfiles(id,nombre,apellido,telefono,rol,estado,activo)
    values(p_id,p_nombre,p_apellido,p_telefono,p_rol,p_estado,p_estado='activo');
  else
    update public.perfiles set nombre=p_nombre,apellido=p_apellido,telefono=p_telefono,
      rol=p_rol,estado=p_estado,activo=(p_estado='activo') where id=p_id;
  end if;
  if p_rol='tecnico' and not exists(select 1 from public.tecnicos where perfil_id=p_id) then
    insert into public.tecnicos(id,perfil_id,activo) values(p_id,p_id,p_estado='activo');
  end if;
  update public.tecnicos set activo=(p_rol='tecnico' and p_estado='activo') where perfil_id=p_id;
end;
$$;
revoke all on function public.administrar_perfil_interno(uuid,uuid,text,text,text,text,text,boolean) from public,anon,authenticated;
grant execute on function public.administrar_perfil_interno(uuid,uuid,text,text,text,text,text,boolean) to service_role;
