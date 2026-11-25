CREATE OR REPLACE FUNCTION public.laso_confirmar_turno(p_codigo text, p_numero text, p_version integer, p_evento text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare b public.laso_turnos_confirmacion%rowtype; a record; o record; direccion text;
begin
 if p_numero is distinct from '+5493512143961' then return jsonb_build_object('estado','denegado'); end if;
 select * into a from public.bot_autorizar(p_numero,'agenda.registrar',p_version);
 if a.acceso_id is null then return jsonb_build_object('estado','denegado'); end if;
 if not exists(select 1 from public.bot_borradores where evento_id=p_evento and acceso_id=a.acceso_id and perfil_id=a.perfil_id and version_acceso=a.version and numero=p_numero and tipo='texto' and lower(btrim(texto))='confirmar '||p_codigo) then return jsonb_build_object('estado','confirmacion_invalida'); end if;
 select * into b from public.laso_turnos_confirmacion where codigo=p_codigo and acceso_id=a.acceso_id and perfil_id=a.perfil_id and version_acceso=a.version for update;
 if not found then return jsonb_build_object('estado','inexistente'); end if;
 if b.orden_id is not null then select numero_orden into o from public.ordenes where id=b.orden_id; return jsonb_build_object('estado','registrado','numero',o.numero_orden); end if;
 if b.creado<now()-interval '30 minutes' or b.fecha+b.inicio <= (now() at time zone 'America/Argentina/Cordoba') then return jsonb_build_object('estado','vencido'); end if;
 select d.direccion_completa into direccion from public.direcciones_clientes d join public.clientes c on c.id=d.cliente_id where d.id=b.direccion_id and d.cliente_id=b.cliente_id and d.activo and c.activo;
 if not found or direccion is null then return jsonb_build_object('estado','cliente_invalido'); end if;
 perform pg_advisory_xact_lock(hashtext('laso_turno'),0);
 if exists(select 1 from public.ordenes where estado in ('pendiente','en_proceso') and fecha_programada=b.fecha and (hora_inicio is null or (hora_inicio<b.fin and (hora_fin is null or hora_fin>b.inicio)))) then return jsonb_build_object('estado','ocupado'); end if;
 insert into public.ordenes(cliente_id,direccion_cliente_id,titulo,fecha_programada,hora_inicio,hora_fin,estado,created_by,direccion_snapshot)
 values(b.cliente_id,b.direccion_id,b.titulo,b.fecha,b.inicio,b.fin,'pendiente',b.perfil_id,jsonb_build_object('direccion_completa',direccion)) returning id,numero_orden into o;
 update public.laso_turnos_confirmacion set orden_id=o.id where id=b.id;
 return jsonb_build_object('estado','registrado','numero',o.numero_orden);
end $function$

