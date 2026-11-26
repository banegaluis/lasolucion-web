# Memoria privada: auditoría y pruebas — 26/11/2026

## Estado verificado

- `whatsapp-interno`: v23 ACTIVE. Su paquete no incluye el parser ni un módulo de memoria. No declarar activación de listas por WhatsApp.
- Existen `public.laso_listas`, `public.laso_listas_historial` y `public.laso_memoria`.
- Ambas tablas tienen RLS habilitado. `authenticated` tiene SELECT; las políticas exigen perfil propio, admin, activo y estado activo. No se observaron permisos anon en las ACL de estas tablas.
- RPC SECURITY INVOKER, search_path vacío, EXECUTE únicamente para postgres/service_role. Comprueba número personal fijo, bot_autorizar con agenda.registrar, administrador y evento asociado a acceso/perfil/versión.
- Lista única por perfil/clave; historial con evento_id como clave primaria. Bloqueo advisory por perfil y bloqueo de lista. No se validó concurrencia multiconexión.
- service_role mantiene privilegios amplios (incluido TRUNCATE en ambas tablas). No se modificaron grants. Evaluar reducción al preparar integración.

## Ensayo aislado

`tests/sql-aislado/memoria-desplegada.sql` conserva la definición leída de producción, exclusivamente como fixture. `memoria.test.mjs` la ejecuta en PGlite con tablas locales que reproducen columnas y restricciones relevantes, y conecta el parser del PR con la RPC.

Cuatro escenarios comprueban crear/agregar/ver sin duplicar evento, rollback completo de creación al fallar historial y recuperación posterior, rechazo de número ajeno/evento ausente/perfil revocado, y quitar un ítem conservando índice e historial. Suite completa: **329 pruebas pasadas**, incluidas regresiones de agenda y clientes. Comando: `node --test tests/*.test.cjs tests/*.test.mjs tests/sql-aislado/*.test.mjs`.

Limitación: el fixture no reproduce RLS ni toda la configuración de producción; la evaluación de políticas de esta entrega es por lectura de catálogos, no por pruebas de sesiones productivas. No se consultó contenido de listas reales ni se escribieron datos productivos.

## Integración pendiente y bloqueo

La RPC recibe acciones ya interpretadas; no comprueba por sí sola un código de confirmación exacto ni vincula semánticamente el texto del evento con la modificación solicitada. Antes de conectar escrituras, implementar borrador/confirmación vinculada a payload, operador y versión. Revalidar autorización después de esperas, y comprobar número de filas afectadas en lista e historial. Probar cancelación, cambios concurrentes, rollback y denegación RLS con roles locales.

El parser existente está en `functions/whatsapp-interno`, mientras que el código que sigue al receptor activo está en `functions/laso-privado`: no desplegar el receptor histórico encima del activo. Preparar adaptador para texto/transcripción sin permitir que una transcripción ejecute directamente una escritura. La vista CRM debe ser inicialmente de lectura y respetar dashboard original y políticas de propiedad.

El usuario informa un bloqueo anterior por controles de seguridad. En esta entrega no se reintentó ni se buscó una vía alternativa para eludirlo. Falta identificar el rechazo exacto y tramitar la aprobación por el flujo autorizado de despliegue; no se conoce un paso concreto de interfaz ni se afirma que ya esté aprobado. Esta auditoría no reemplaza esa aprobación. Tampoco se envían mensajes para probar activación.

## Pruebas de políticas con roles locales — 26/11/2026

Se incorporó snapshot actualizado de las dos políticas SELECT (`memoria-politicas.sql`) y se ejecutaron con SET ROLE en PGlite. El administrador propietario ve lista e historial; otro administrador, identidad vacía, perfil inactivo, técnico y estado inactivo no ven filas. authenticated/anon no pueden INSERT/UPDATE ni ejecutar la RPC (42501). Son dos escenarios nuevos con varias identidades; suite completa: **331 pruebas pasadas**, incluidas agenda y clientes.

El entorno local simula auth.uid mediante una configuración de sesión y permite leer perfiles para aislar la política de listas. No reproduce JWT, PostgREST ni las políticas productivas de perfiles. Por eso acredita estas condiciones de propiedad/rol, no una prueba integral de acceso al CRM productivo. No se modificaron permisos ni datos reales.

Revisión operativa: receptor v23 ACTIVE; último borrador del número personal sigue siendo 25/11/2026 09:39 Argentina, cero en la última hora consultada. No se da por resuelta la falta de respuesta. Acceso al panel Meta y bloqueo previo de publicación siguen pendientes; no se reintentó despliegue ni se utilizó una vía alternativa. La integración con confirmaciones, audio y vista CRM continúa sin activar.
