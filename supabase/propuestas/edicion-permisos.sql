-- Prototipo aislado, ejecutar DESPUÉS de los tres archivos de edición,
-- dentro de la MISMA transacción. No es una migración productiva.
-- Revocar PUBLIC no elimina concesiones directas generadas por privilegios por defecto.
do $$
declare rol text;
begin
 foreach rol in array array['public','anon','authenticated'] loop
  if rol='public' or exists(select 1 from pg_roles where rolname=rol) then
   execute format('revoke all on schema laso_edicion_privada from %I',rol);
   execute format('revoke all on all tables in schema laso_edicion_privada from %I',rol);
   execute format('revoke all on all functions in schema laso_edicion_privada from %I',rol);
   execute format('revoke all on all sequences in schema laso_edicion_privada from %I',rol);
  end if;
 end loop;
end $$;
-- No concede acceso a service_role ni cambia privilegios globales por defecto.
-- Repetir el cierre si se incorporan objetos nuevos; auditar membresías por separado.
