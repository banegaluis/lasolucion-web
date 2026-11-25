CREATE OR REPLACE FUNCTION public.bot_autorizar(p_numero text, p_permiso text, p_version integer DEFAULT NULL::integer)
 RETURNS TABLE(acceso_id uuid, perfil_id uuid, version integer)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 select a.id,a.perfil_id,a.version from public.bot_accesos a join public.perfiles p on p.id=a.perfil_id
 where a.numero=p_numero and a.activo and p.activo and p.estado='activo' and p.rol in ('admin','colaborador','tecnico')
 and p_permiso=any(a.permisos) and (p_version is null or a.version=p_version);
$function$

