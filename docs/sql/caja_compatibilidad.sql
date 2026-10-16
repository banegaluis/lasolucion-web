begin;
-- Compatibilidad con la estructura de Caja preexistente (vacía al activar).
alter table public.caja_movimientos add column if not exists categoria text not null default 'Otros';
alter table public.caja_movimientos add column if not exists cuenta text check (cuenta in ('efectivo','banco','billetera'));
alter table public.caja_movimientos add column if not exists cuenta_destino text check (cuenta_destino in ('efectivo','banco','billetera'));
alter table public.caja_movimientos drop constraint caja_movimientos_tipo_check;
alter table public.caja_movimientos add constraint caja_movimientos_tipo_check check (tipo in ('cobro','gasto','deuda','por_cobrar','retiro','aporte','transferencia'));
alter table public.caja_movimientos add constraint caja_cuenta_destino_check check (cuenta is null or ((tipo='transferencia' and cuenta_destino is not null and cuenta_destino<>cuenta) or (tipo<>'transferencia' and cuenta_destino is null)));
alter table public.caja_movimientos add constraint caja_por_cobrar_cliente_check check (tipo<>'por_cobrar' or cliente_id is not null);
create or replace function public.validar_movimiento_caja() returns trigger language plpgsql security invoker set search_path = '' as $$
declare deuda public.caja_movimientos; abonado numeric; cliente_orden uuid;
begin
 if new.cuenta is not null then
  new.medio := case when new.cuenta = 'efectivo' then 'efectivo' else 'transferencia' end;
  if new.tipo = 'transferencia' then new.origen := new.cuenta; new.destino := new.cuenta_destino; end if;
 end if;
 new.ambito := coalesce(new.ambito, 'empresa');
 if new.orden_id is not null then
  select cliente_id into cliente_orden from public.ordenes where id = new.orden_id;
  if cliente_orden is null or new.cliente_id is distinct from cliente_orden then raise exception 'La orden no corresponde al cliente.'; end if;
 end if;
 if new.deuda_id is not null then
  -- Serializa cobros del mismo saldo, incluso desde dos dispositivos.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.deuda_id::text,0));
  select * into deuda from public.caja_movimientos where id = new.deuda_id;
  if deuda.id is null or deuda.tipo not in ('por_cobrar','deuda') or new.cliente_id is distinct from deuda.cliente_id or new.orden_id is distinct from deuda.orden_id then
   raise exception 'Seleccioná el cliente y la orden del saldo pendiente.';
  end if;
  select coalesce(sum(monto),0) into abonado from public.caja_movimientos where deuda_id = new.deuda_id;
  if abonado + new.monto > deuda.monto then raise exception 'El cobro supera el saldo pendiente.'; end if;
 end if;
 return new;
end; $$;
commit;
