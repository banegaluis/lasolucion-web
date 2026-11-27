-- Políticas leídas el 26/11/2026; fixture local, no migración.
alter table public.laso_listas enable row level security;
create policy laso_listas_propias on public.laso_listas for select to authenticated using (((perfil_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM perfiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.rol = 'admin'::text) AND p.activo AND (p.estado = 'activo'::text))))));
alter table public.laso_listas_historial enable row level security;
create policy laso_historial_propio on public.laso_listas_historial for select to authenticated using (((perfil_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM perfiles p
  WHERE ((p.id = ( SELECT auth.uid() AS uid)) AND (p.rol = 'admin'::text) AND p.activo AND (p.estado = 'activo'::text))))));
