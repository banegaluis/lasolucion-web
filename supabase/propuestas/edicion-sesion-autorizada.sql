-- Prototipo aislado, cargar después de edicion-sesion.sql. No desplegado.
-- No concede permisos ni habilita agenda.editar a ningún acceso real.
create table laso_edicion_privada.eventos (
 evento_id text primary key,
 solicitud jsonb not null,
 resultado jsonb
);
revoke all on laso_edicion_privada.eventos from public;
create function laso_edicion_privada.guardar_autorizada(
 p_numero text,p_version integer,p_evento text,p_revision bigint,p_sesion jsonb
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare a record; nueva bigint; solicitud jsonb; previo record; respuesta jsonb;
begin
 if p_numero is distinct from '+5493512143961' or p_version is null or p_version<1 then
  return jsonb_build_object('estado','denegado');
 end if;
 -- Retener identidad/perfil hasta fin de transacción antes de autorizar.
 perform 1 from public.bot_accesos b join public.perfiles p on p.id=b.perfil_id
 where b.numero=p_numero for share of b,p;
 select * into a from public.bot_autorizar(p_numero,'agenda.editar',p_version);
 if a.acceso_id is null then return jsonb_build_object('estado','denegado'); end if;
 if not exists(select 1 from public.bot_borradores where evento_id=p_evento
  and acceso_id=a.acceso_id and perfil_id=a.perfil_id and version_acceso=a.version
  and numero=p_numero and tipo='texto') then
  return jsonb_build_object('estado','evento_invalido');
 end if;
 if p_sesion is not null and (jsonb_typeof(p_sesion) is distinct from 'object'
  or p_sesion->>'operador' is distinct from a.acceso_id::text) then
  return jsonb_build_object('estado','sesion_invalida');
 end if;
 solicitud:=jsonb_build_object('acceso',a.acceso_id,'version',a.version,'revision',p_revision,'sesion',p_sesion);
 insert into laso_edicion_privada.eventos(evento_id,solicitud) values(p_evento,solicitud)
 on conflict(evento_id) do nothing;
 select e.solicitud,e.resultado into previo from laso_edicion_privada.eventos e where e.evento_id=p_evento for update;
 if previo.solicitud is distinct from solicitud then return jsonb_build_object('estado','evento_reutilizado'); end if;
 if previo.resultado is not null then return previo.resultado||jsonb_build_object('repetido',true); end if;
 nueva:=laso_edicion_privada.reemplazar(a.acceso_id,a.version,p_revision,p_sesion);
 respuesta:=case when nueva is null then jsonb_build_object('estado','conflicto') else jsonb_build_object('estado','guardada','revision',nueva) end;
 update laso_edicion_privada.eventos set resultado=respuesta where evento_id=p_evento;
 return respuesta;
end $$;
revoke all on function laso_edicion_privada.guardar_autorizada(text,integer,text,bigint,jsonb) from public;
