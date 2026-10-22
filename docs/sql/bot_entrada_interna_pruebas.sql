-- Solo receptores INTERNOS, sin contacto comercial ni creación de órdenes.
-- Preparación pendiente de instalación tras revisión; NO activa WhatsApp.
begin;
create table public.bot_borradores (
 id uuid primary key default gen_random_uuid(),
 evento_id text not null unique check(length(evento_id) between 5 and 250),
 acceso_id uuid not null references public.bot_accesos(id),
 perfil_id uuid not null references public.perfiles(id),
 version_acceso integer not null check(version_acceso>=1),
 numero text not null check(numero ~ '^\+[1-9][0-9]{7,14}$'),
 tipo text not null check(tipo in ('texto','audio')),
 texto text,
 media_id text,
 estado text not null check(estado in ('pendiente_revision','audio_sin_transcribir')),
 recibido_en timestamptz not null default now(),
 constraint bot_borradores_coherentes check (
   (tipo='texto' and estado='pendiente_revision' and length(btrim(coalesce(texto,''))) between 1 and 2000 and media_id is null)
   or
   (tipo='audio' and estado='audio_sin_transcribir' and texto is null and length(coalesce(media_id,'')) between 5 and 250)
 )
);
create index bot_borradores_acceso_fecha on public.bot_borradores(acceso_id,recibido_en desc);
create index bot_borradores_fecha on public.bot_borradores(recibido_en desc);
alter table public.bot_borradores enable row level security;
revoke all on public.bot_borradores from public,anon,authenticated;
grant select on public.bot_borradores to authenticated;
grant select,insert on public.bot_borradores to service_role;
create policy bot_borradores_ver_admin on public.bot_borradores
 for select to authenticated using((select public.is_admin()));
-- Insert/update/delete no disponibles para clientes autenticados.
commit;
