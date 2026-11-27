-- Propuesta no desplegada. Requiere revisión, confirmación vinculada y permisos mínimos antes de activar.
-- Basada en el snapshot de memoria del 26/11/2026; conserva su interfaz.
CREATE OR REPLACE FUNCTION public.laso_memoria(p_numero text, p_acceso uuid, p_perfil uuid, p_version integer, p_evento text, p_accion text, p_nombre text, p_clave text, p_items jsonb, p_indice integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare l public.laso_listas%rowtype; anterior jsonb; nuevo jsonb; respuesta jsonb; i jsonb; filas bigint;
begin
 if p_numero is distinct from '+5493512143961' or not exists(select 1 from public.bot_autorizar(p_numero,'agenda.registrar',p_version) a join public.perfiles p on p.id=a.perfil_id where a.acceso_id=p_acceso and a.perfil_id=p_perfil and p.rol='admin') then raise exception 'No autorizado'; end if;
 if not exists(select 1 from public.bot_borradores b where b.evento_id=p_evento and b.perfil_id=p_perfil and b.acceso_id=p_acceso and b.version_acceso=p_version and b.numero=p_numero) then raise exception 'Evento no autorizado'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_perfil::text,0));
 -- Revalidar tras una posible espera; no reutilizar la autorización anterior.
 if p_numero is distinct from '+5493512143961' or not exists(select 1 from public.bot_autorizar(p_numero,'agenda.registrar',p_version) a join public.perfiles p on p.id=a.perfil_id where a.acceso_id=p_acceso and a.perfil_id=p_perfil and p.rol='admin') then raise exception 'No autorizado'; end if;
 if not exists(select 1 from public.bot_borradores b where b.evento_id=p_evento and b.perfil_id=p_perfil and b.acceso_id=p_acceso and b.version_acceso=p_version and b.numero=p_numero) then raise exception 'Evento no autorizado'; end if;
 if p_accion='listar' then
  select coalesce(jsonb_agg(jsonb_build_object('nombre',x.nombre,'cantidad',jsonb_array_length(x.items))),'[]'::jsonb) into respuesta from (select nombre,items from public.laso_listas where perfil_id=p_perfil order by updated_at desc limit 40) x;
  return jsonb_build_object('listas',respuesta);
 end if;
 if p_clave is null or char_length(p_clave) not between 1 and 120 or p_nombre is null or char_length(p_nombre) not between 1 and 120 then raise exception 'Nombre invalido'; end if;
 select * into l from public.laso_listas where perfil_id=p_perfil and clave=p_clave for update;
 -- Revalidar tras una posible espera; no reutilizar la autorización anterior.
 if p_numero is distinct from '+5493512143961' or not exists(select 1 from public.bot_autorizar(p_numero,'agenda.registrar',p_version) a join public.perfiles p on p.id=a.perfil_id where a.acceso_id=p_acceso and a.perfil_id=p_perfil and p.rol='admin') then raise exception 'No autorizado'; end if;
 if not exists(select 1 from public.bot_borradores b where b.evento_id=p_evento and b.perfil_id=p_perfil and b.acceso_id=p_acceso and b.version_acceso=p_version and b.numero=p_numero) then raise exception 'Evento no autorizado'; end if;
 if p_accion='ver' then
  if l.id is null then return jsonb_build_object('error','no_existe'); end if;
  return jsonb_build_object('nombre',l.nombre,'items',l.items);
 end if;
 if exists(select 1 from public.laso_listas_historial where evento_id=p_evento) then return jsonb_build_object('error','evento_repetido'); end if;
 if p_accion not in ('crear','agregar','comprado','pendiente','quitar') then raise exception 'Accion invalida'; end if;
 if p_accion in ('crear','agregar') then
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items)>40 or (p_accion='agregar' and jsonb_array_length(p_items)=0) then raise exception 'Items invalidos'; end if;
  for i in select value from jsonb_array_elements(p_items) loop
   if jsonb_typeof(i)<>'string' or char_length(i#>>'{}') not between 1 and 240 then raise exception 'Item invalido'; end if;
  end loop;
  if p_accion='crear' and l.id is not null then return jsonb_build_object('error','ya_existe'); end if;
  if l.id is null then
   if p_accion<>'crear' then return jsonb_build_object('error','no_existe'); end if;
   insert into public.laso_listas(perfil_id,nombre,clave) values(p_perfil,p_nombre,p_clave) returning * into l;
 get diagnostics filas = row_count;
 if filas <> 1 then raise exception 'Escritura de memoria incompleta' using errcode='P0001'; end if;
  end if;
  anterior:=l.items;
  select l.items||coalesce(jsonb_agg(jsonb_build_object('texto',value#>>'{}','estado','pendiente') order by ord),'[]'::jsonb) into nuevo from jsonb_array_elements(p_items) with ordinality as x(value,ord);
 else
  if l.id is null then return jsonb_build_object('error','no_existe'); end if;
  if p_indice is null or p_indice<1 or p_indice>jsonb_array_length(l.items) then return jsonb_build_object('error','indice_invalido'); end if;
  anterior:=l.items;
  if (anterior->(p_indice-1)->>'estado')='quitado' then return jsonb_build_object('error','item_quitado'); end if;
  nuevo:=jsonb_set(anterior,array[(p_indice-1)::text,'estado'],to_jsonb(case when p_accion='quitar' then 'quitado' else p_accion end));
 end if;
 if jsonb_array_length(nuevo)>150 then return jsonb_build_object('error','limite'); end if;
 update public.laso_listas set items=nuevo,updated_at=now() where id=l.id;
 get diagnostics filas = row_count;
 if filas <> 1 then raise exception 'Escritura de memoria incompleta' using errcode='P0001'; end if;
 insert into public.laso_listas_historial(evento_id,perfil_id,lista_id,accion,antes,despues) values(p_evento,p_perfil,l.id,p_accion,anterior,nuevo);
 get diagnostics filas = row_count;
 if filas <> 1 then raise exception 'Escritura de memoria incompleta' using errcode='P0001'; end if;
 return jsonb_build_object('nombre',l.nombre,'items',nuevo);
end; $function$

