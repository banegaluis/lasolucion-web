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

## Escrituras incompletas y rollback — 26/11/2026

Se volvió a leer la RPC productiva y se verificó el receptor v23 ACTIVE. La definición no comprueba filas afectadas. Se reprodujo localmente una supresión silenciosa del INSERT de historial con un trigger de prueba: la función actual devuelve dos ítems guardados aunque no exista historial. **El trigger se inyectó solo en PGlite; no se afirma que exista en producción ni que explique la falta de respuesta de WhatsApp.**

`supabase/propuestas/memoria-atomica.sql` añade comprobación ROW_COUNT = 1 después de crear lista, actualizarla y registrar historial. Si alguna escritura no ocurre, lanza P0001 y revierte la llamada. Conserva interfaz y controles actuales. Es una propuesta, no una migración aplicada ni una solución completa de autorización/confirmación; no ejecutar aisladamente en un entorno nuevo con permisos predeterminados.

Las mismas regresiones de comandos, propiedad/RLS y permisos se ejecutan sobre snapshot y propuesta. Tres casos inyectan supresión en cada escritura y comprueban igualdad de lista, fecha e historial anteriores, más reintento exitoso sin evento consumido. No hay pruebas de concurrencia nativa multiconexión, JWT ni WhatsApp real. Siguen pendientes confirmación exacta vinculada al contenido, revalidación tras esperas y mínimo privilegio antes de integrar memoria al receptor o CRM. Publicación continúa sujeta a resolver el bloqueo por la vía autorizada; no se reintentó desplegar.

Validación de esta entrega: **343 pruebas pasadas, cero fallos**, con `node --test tests/*.test.cjs tests/*.test.mjs tests/sql-aislado/*.test.mjs` (incluye agenda y clientes). La suite específica de memoria contiene 19 pruebas contando sus dos grupos; son 12 adicionales respecto del total anterior de 331. No se midió latencia productiva ni ahorro de tiempo del usuario.

## Conversación y confirmación de listas — 26/11/2026

`functions/laso-privado/memoria-conversacion.mjs` prepara creación/agregado desde texto o transcripción usando el parser existente. Muestra nombre y todos los ítems interpretados, admite reemplazar el pedido completo con `Mejor: Creá lista ...`, y exige `CONFIRMAR LISTA <código>` escrito. Cada propuesta tiene código nuevo, identidad (acceso/perfil/versión) y vigencia de 15 minutos. Las correcciones dentro de la sesión conservan su fecha inicial. Cancelar descarta la propuesta. Consultas producen una intención de lectura; cambios por índice se detienen hasta poder mostrar y vincular el ítem actual.

El módulo es puro y no está importado por el receptor activo. Devuelve intención validada, nunca éxito de guardado. Su identidad/sesión deben venir de almacenamiento autenticado del servidor; el código no es una firma criptográfica del contenido. No revalida permisos contra la base. Antes de activar falta persistir sesión con control de revisión y consumir confirmación atómicamente con la escritura: invocar dos veces esta función pura con la misma sesión aún devuelve dos intenciones. La deduplicación SQL y la protección frente a correcciones concurrentes siguen siendo obligatorias. No conectar directamente esta intención a la RPC actual.

Ocho pruebas nuevas cubren texto/transcripción, corrección e invalidación de código, vencimiento, cambio de identidad/versión, alteración de propuesta, reordenamiento JSONB, cancelación, consultas, acciones por índice y entradas inválidas. No hay prueba de audio real, WhatsApp ni vista CRM en esta entrega. La versión activa observada continúa v23; no se reintentó el despliegue bloqueado ni se alteraron datos reales.

Suite completa: **351 pruebas pasadas, cero fallos**, con `node --test tests/*.test.cjs tests/*.test.mjs tests/sql-aislado/*.test.mjs`, incluidas agenda, clientes y SQL local. No se midió mejora de latencia productiva.
