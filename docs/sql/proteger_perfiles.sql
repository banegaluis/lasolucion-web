-- Solo un administrador activo puede cambiar los campos que conceden acceso.
create or replace function public.proteger_permisos_perfil()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then
    if current_user not in ('postgres', 'supabase_admin', 'service_role') then
      raise exception 'Se requiere una sesión autorizada.' using errcode = '42501';
    end if;
  elsif not coalesce(public.is_admin(), false) and (
    new.id is distinct from old.id or
    new.rol is distinct from old.rol or
    new.estado is distinct from old.estado or
    new.activo is distinct from old.activo
  ) then
    raise exception 'Solo un administrador puede modificar los permisos del perfil.' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists perfiles_proteger_permisos on public.perfiles;
create trigger perfiles_proteger_permisos before update on public.perfiles
for each row execute function public.proteger_permisos_perfil();

-- Un técnico deshabilitado tampoco conserva acceso por su ficha de técnico.
create or replace function public.current_tecnico_id()
returns uuid language sql stable security definer set search_path = 'public', 'auth' as $$
  select t.id from public.tecnicos t
  where t.perfil_id = auth.uid() and t.activo = true
    and public.current_user_role() = 'tecnico'
  limit 1;
$$;
