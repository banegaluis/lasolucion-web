-- Ensayo aislado; no migración productiva. Requiere edicion-sesion.sql.
create table laso_edicion_privada.cambios (
 acceso_id uuid not null,codigo text not null,evento_id text not null,
 orden_id uuid not null,antes jsonb not null,despues jsonb not null,
 creado timestamptz not null default clock_timestamp(),
 primary key(acceso_id,codigo),unique(evento_id)
);
revoke all on laso_edicion_privada.cambios from public;
create function laso_edicion_privada.confirmar(
 p_numero text,p_version integer,p_evento text,p_codigo text,p_revision bigint
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare a record;s record;o record;anterior jsonb;d date;inicio time;fin time;creada numeric;ahora_ms numeric;previo uuid;
begin
 if p_numero is distinct from '+5493512143961' or p_version is null or p_version<1 then return jsonb_build_object('estado','denegado'); end if;
 if p_codigo is null or p_codigo!~'^[0-9a-f]{32}$' or p_revision is null or p_revision<1 then return jsonb_build_object('estado','confirmacion_invalida'); end if;
 perform 1 from public.bot_accesos b join public.perfiles p on p.id=b.perfil_id where b.numero=p_numero for share of b,p;
 select * into a from public.bot_autorizar(p_numero,'agenda.editar',p_version);
 if a.acceso_id is null then return jsonb_build_object('estado','denegado'); end if;
 if not exists(select 1 from public.bot_borradores where evento_id=p_evento and acceso_id=a.acceso_id and perfil_id=a.perfil_id and version_acceso=a.version and numero=p_numero and tipo='texto' and lower(btrim(texto))='confirmar cambio '||p_codigo) then return jsonb_build_object('estado','confirmacion_invalida'); end if;
 perform pg_advisory_xact_lock(hashtext('laso_turno'),0);
 select orden_id into previo from laso_edicion_privada.cambios where acceso_id=a.acceso_id and codigo=p_codigo;
 if found then return jsonb_build_object('estado','editada','orden_id',previo,'repetido',true); end if;
 select * into s from laso_edicion_privada.sesiones where acceso_id=a.acceso_id and version_acceso=a.version for update;
 if not found or s.revision<>p_revision or s.sesion is null or s.sesion->>'codigo' is distinct from p_codigo or s.sesion->>'operador' is distinct from a.acceso_id::text then return jsonb_build_object('estado','propuesta_invalida'); end if;
 if jsonb_typeof(s.sesion->'creada') is distinct from 'number' then return jsonb_build_object('estado','propuesta_invalida'); end if;
 creada:=(s.sesion->>'creada')::numeric;ahora_ms:=extract(epoch from clock_timestamp())*1000;
 if creada>ahora_ms or creada<=ahora_ms-1800000 then return jsonb_build_object('estado','vencida'); end if;
 -- Formato cerrado antes de convertir; cualquier excepción de conversión no escribe.
 if coalesce(s.sesion#>>'{base,id}','')!~'^[0-9a-fA-F-]{36}$'
 or coalesce(s.sesion#>>'{propuesta,fecha}','')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
 or coalesce(s.sesion#>>'{propuesta,inicio}','')!~'^([01][0-9]|2[0-3]):[0-5][0-9]$'
 or coalesce(s.sesion#>>'{propuesta,fin}','')!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' then return jsonb_build_object('estado','propuesta_invalida'); end if;
 begin
  d:=(s.sesion#>>'{propuesta,fecha}')::date;inicio:=(s.sesion#>>'{propuesta,inicio}')::time;fin:=(s.sesion#>>'{propuesta,fin}')::time;
  select * into o from public.ordenes where id=(s.sesion#>>'{base,id}')::uuid for update;
 exception when invalid_text_representation or datetime_field_overflow then return jsonb_build_object('estado','propuesta_invalida'); end;
 if o.id is null then return jsonb_build_object('estado','orden_inexistente'); end if;
 anterior:=jsonb_build_object('id',o.id,'fecha',o.fecha_programada,'inicio',o.hora_inicio,'fin',o.hora_fin,'estado',o.estado,'cliente_id',o.cliente_id,'direccion_cliente_id',o.direccion_cliente_id,'titulo',o.titulo);
 if o.estado is distinct from 'pendiente' or anterior is distinct from s.sesion->'base' then return jsonb_build_object('estado','orden_cambiada'); end if;
 if fin<=inicio or d+inicio<=clock_timestamp() at time zone 'America/Argentina/Cordoba' then return jsonb_build_object('estado','horario_invalido'); end if;
 if o.hora_inicio is null or o.hora_fin is null or fin-inicio<>o.hora_fin-o.hora_inicio then return jsonb_build_object('estado','duracion_invalida'); end if;
 if exists(select 1 from public.ordenes x where x.id<>o.id and x.estado in ('pendiente','en_proceso') and x.fecha_programada=d and (x.hora_inicio is null or x.hora_fin is null or x.hora_fin<=x.hora_inicio or (x.hora_inicio<fin and x.hora_fin>inicio))) then return jsonb_build_object('estado','ocupado'); end if;
 update public.ordenes set fecha_programada=d,hora_inicio=inicio,hora_fin=fin where id=o.id;
 insert into laso_edicion_privada.cambios(acceso_id,codigo,evento_id,orden_id,antes,despues) values(a.acceso_id,p_codigo,p_evento,o.id,anterior,s.sesion->'propuesta');
 update laso_edicion_privada.sesiones set sesion=null,revision=revision+1 where acceso_id=a.acceso_id;
 return jsonb_build_object('estado','editada','orden_id',o.id);
end $$;
revoke all on function laso_edicion_privada.confirmar(text,integer,text,text,bigint) from public;
