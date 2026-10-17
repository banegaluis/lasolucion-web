-- Libro de caja independiente: no importa ni duplica automáticamente pagos/gastos históricos.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '20s';
lock table public.caja_movimientos in access exclusive mode;
do $$ begin if exists(select 1 from public.caja_movimientos) then raise exception 'Caja contiene movimientos: se cancela el reemplazo.'; end if; end $$;
drop table public.caja_movimientos;
create table if not exists public.caja_movimientos (
 id uuid primary key,
 created_by uuid not null default auth.uid() references public.perfiles(id),
 created_at timestamptz not null default now(),
 fecha date not null,
 tipo text not null check (tipo in ('cobro','gasto','por_cobrar','retiro','aporte','transferencia')),
 monto numeric(14,2) not null check (monto > 0),
 descripcion text not null check (length(trim(descripcion)) between 1 and 2000),
 categoria text not null default 'Otros',
 cuenta text not null check (cuenta in ('efectivo','banco','billetera')),
 cuenta_destino text check (cuenta_destino in ('efectivo','banco','billetera')),
 cliente_id uuid references public.clientes(id),
 orden_id uuid references public.ordenes(id),
 deuda_id uuid references public.caja_movimientos(id),
 check ((tipo = 'transferencia' and cuenta_destino is not null and cuenta_destino <> cuenta) or (tipo <> 'transferencia' and cuenta_destino is null)),
 check (deuda_id is null or tipo = 'cobro'),
 check (tipo <> 'por_cobrar' or cliente_id is not null)
);
alter table public.caja_movimientos enable row level security;
revoke all on public.caja_movimientos from anon, authenticated;
grant select, insert on public.caja_movimientos to authenticated;
drop policy if exists caja_admin_lectura on public.caja_movimientos;
create policy caja_admin_lectura on public.caja_movimientos for select to authenticated using ((select public.is_admin()));
drop policy if exists caja_admin_alta on public.caja_movimientos;
create policy caja_admin_alta on public.caja_movimientos for insert to authenticated with check ((select public.is_admin()) and created_by = (select auth.uid()));
create index if not exists caja_fecha_idx on public.caja_movimientos(fecha);
create index if not exists caja_deuda_idx on public.caja_movimientos(deuda_id);
create or replace function public.validar_movimiento_caja() returns trigger language plpgsql security invoker set search_path = '' as $$
declare deuda public.caja_movimientos; abonado numeric; cliente_orden uuid;
begin
 if new.orden_id is not null then
  select cliente_id into cliente_orden from public.ordenes where id = new.orden_id;
  if cliente_orden is null or new.cliente_id is distinct from cliente_orden then raise exception 'La orden no corresponde al cliente.'; end if;
 end if;
 if new.deuda_id is not null then
  -- Serializa cobros del mismo saldo, incluso desde dos dispositivos.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(new.deuda_id::text,0));
  select * into deuda from public.caja_movimientos where id = new.deuda_id;
  if deuda.id is null or deuda.tipo <> 'por_cobrar' or new.cliente_id is distinct from deuda.cliente_id or new.orden_id is distinct from deuda.orden_id then
   raise exception 'Seleccioná el cliente y la orden del saldo pendiente.';
  end if;
  select coalesce(sum(monto),0) into abonado from public.caja_movimientos where deuda_id = new.deuda_id;
  if abonado + new.monto > deuda.monto then raise exception 'El cobro supera el saldo pendiente.'; end if;
 end if;
 return new;
end; $$;
revoke all on function public.validar_movimiento_caja() from public, anon, authenticated;
drop trigger if exists caja_validar on public.caja_movimientos;
create trigger caja_validar before insert on public.caja_movimientos for each row execute function public.validar_movimiento_caja();
commit;
