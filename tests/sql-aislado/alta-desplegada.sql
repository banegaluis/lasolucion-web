CREATE OR REPLACE FUNCTION public.laso_confirmar_alta(p_codigo text, p_numero text, p_version integer, p_evento text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare b public.laso_altas_pendientes%rowtype; a record; d jsonb; nuevo_cliente uuid; nueva_dir uuid; nueva_orden uuid; nro bigint; fecha date; inicio time; fin time; telefono text; domicilio text;
begin
 if p_numero is distinct from '+5493512143961' then return jsonb_build_object('estado','denegado'); end if;
 select * into a from public.bot_autorizar(p_numero,'agenda.registrar',p_version);
 if a.acceso_id is null then return jsonb_build_object('estado','denegado'); end if;
 if not exists(select 1 from public.bot_borradores where evento_id=p_evento and acceso_id=a.acceso_id and perfil_id=a.perfil_id and version_acceso=a.version and numero=p_numero and tipo='texto' and lower(btrim(texto))='confirmar alta '||p_codigo) then return jsonb_build_object('estado','confirmacion_invalida'); end if;
 perform pg_advisory_xact_lock(hashtext('laso_turno'),0);
 select * into b from public.laso_altas_pendientes where codigo=p_codigo and acceso_id=a.acceso_id and perfil_id=a.perfil_id and version_acceso=a.version for update;
 if not found then return jsonb_build_object('estado','inexistente'); end if;
 if b.orden_id is not null then select numero_orden into nro from public.ordenes where id=b.orden_id; return jsonb_build_object('estado','registrado','numero',nro); end if;
 if b.creado<now()-interval '30 minutes' or exists(select 1 from public.laso_altas_pendientes x where x.acceso_id=b.acceso_id and x.creado>b.creado) then return jsonb_build_object('estado','vencido'); end if;
 d:=b.datos;
 if d->>'listo' is distinct from 'true' or coalesce(length(trim(d->>'nombre')),0)<2 or coalesce(length(trim(d->>'apellido')),0)<2 or coalesce(length(trim(d->>'calle')),0)<2 or coalesce(d->>'numero','') !~ '^[0-9]{1,8}$' or coalesce(length(trim(d->>'ciudad')),0)<2 or coalesce(length(trim(d->>'provincia')),0)<2 or coalesce(length(trim(d->>'trabajo')),0) not between 3 and 180 then return jsonb_build_object('estado','incompleto'); end if;
 telefono:=regexp_replace(coalesce(d->>'telefono',''),'[^0-9]','','g');
 if telefono !~ '^[0-9]{10,15}$' then return jsonb_build_object('estado','incompleto'); end if;
 fecha:=(d->>'fecha')::date; inicio:=(d->>'inicio')::time; fin:=(d->>'fin')::time;
 if fecha is null or inicio is null or fin is null or fin<=inicio or fecha+inicio<=(now() at time zone 'America/Argentina/Cordoba') then return jsonb_build_object('estado','horario_invalido'); end if;
 if exists(select 1 from public.clientes c where right(regexp_replace(c.telefono_principal,'[^0-9]','','g'),10)=right(telefono,10) or lower(trim(c.nombre_completo))=lower(trim((d->>'nombre')||' '||(d->>'apellido')))) then return jsonb_build_object('estado','cliente_existente'); end if;
 if exists(select 1 from public.ordenes where estado in ('pendiente','en_proceso') and fecha_programada=fecha and (hora_inicio is null or (hora_inicio<fin and (hora_fin is null or hora_fin>inicio)))) then return jsonb_build_object('estado','ocupado'); end if;
 insert into public.clientes(nombre,apellido,telefono_principal,created_by) values(d->>'nombre',d->>'apellido',telefono,a.perfil_id) returning id into nuevo_cliente;
 insert into public.direcciones_clientes(cliente_id,alias,calle,numero,ciudad,provincia,es_principal) values(nuevo_cliente,'Principal',d->>'calle',d->>'numero',d->>'ciudad',d->>'provincia',true) returning id,direccion_completa into nueva_dir,domicilio;
 insert into public.ordenes(cliente_id,direccion_cliente_id,titulo,fecha_programada,hora_inicio,hora_fin,estado,created_by,direccion_snapshot) values(nuevo_cliente,nueva_dir,d->>'trabajo',fecha,inicio,fin,'pendiente',a.perfil_id,jsonb_build_object('direccion_completa',domicilio)) returning id,numero_orden into nueva_orden,nro;
 update public.laso_altas_pendientes set cliente_id=nuevo_cliente,orden_id=nueva_orden where id=b.id;
 return jsonb_build_object('estado','registrado','numero',nro);
end $function$
