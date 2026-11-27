-- Prototipo aislado. NO es una migración aprobada para producción.
-- No concede acceso a roles de aplicación ni implementa autorización del operador.
create schema laso_edicion_privada;
revoke all on schema laso_edicion_privada from public;
create table laso_edicion_privada.sesiones (
 acceso_id uuid primary key,
 version_acceso integer not null check(version_acceso>0),
 revision bigint not null check(revision>0),
 sesion jsonb,
 check(sesion is null or jsonb_typeof(sesion)='object')
);
revoke all on laso_edicion_privada.sesiones from public;

-- Comparar y reemplazar en una única sentencia. NULL descarta el contexto,
-- conservando la revisión para impedir que una respuesta vieja lo resucite.
create function laso_edicion_privada.reemplazar(
 p_acceso uuid,p_version integer,p_revision bigint,p_sesion jsonb
) returns bigint language plpgsql security invoker set search_path='' as $$
declare nueva bigint;
begin
 if p_acceso is null or p_version is null or p_version<1 or p_revision is null or p_revision<0 or p_revision>=9223372036854775807 then
  raise exception 'identidad o revision invalida' using errcode='22023';
 end if;
 if p_sesion is not null and jsonb_typeof(p_sesion)<>'object' then
  raise exception 'sesion invalida' using errcode='22023';
 end if;
 if p_revision=0 then
  insert into laso_edicion_privada.sesiones values(p_acceso,p_version,1,p_sesion)
  on conflict(acceso_id) do nothing returning revision into nueva;
 else
  update laso_edicion_privada.sesiones set sesion=p_sesion,revision=revision+1
  where acceso_id=p_acceso and version_acceso=p_version and revision=p_revision
  returning revision into nueva;
 end if;
 return nueva; -- NULL: conflicto; releer, no repetir la escritura a ciegas.
end $$;
revoke all on function laso_edicion_privada.reemplazar(uuid,integer,bigint,jsonb) from public;
