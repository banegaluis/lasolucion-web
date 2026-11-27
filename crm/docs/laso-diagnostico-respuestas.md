# Diagnóstico de respuestas privadas — 26/11/2026

## Evidencia actual

Receptor productivo `whatsapp-interno`: v23 ACTIVE. En la ventana predeterminada de últimas 24 horas del flujo de logs disponible aparecen dos eventos function_logs (Boot/Shutdown) y un function_edge_logs: GET a `/functions/v1/whatsapp-interno`, 403, a las 17:10 UTC (14:10 Argentina). Corresponde temporalmente al diagnóstico anterior. No se observó POST de Meta en esta consulta. No prueba que Meta no lo haya enviado: faltan evidencias de entrega/suscripción desde su panel y no se conoce la completitud del flujo. El GET rechazado no acredita recepción ni respuesta WhatsApp; EarlyDrop tampoco se toma como causa del incidente.

## Cambio preparado, no desplegado

`supabase/functions/laso-privado/respuesta-diagnostico.mjs` se integra al envío final del receptor en GitHub. Clasifica aceptación por Meta, rechazo HTTP, respuesta sin confirmación, tiempo agotado y fallo de transporte. Conserva códigos y subcódigos numéricos para diagnóstico. Nunca registra el cuerpo de error, mensaje, destinatario, token, id del mensaje ni traza de Meta. Aceptación exige HTTP 2xx e identificador no vacío, sin error; **no significa entrega al teléfono**.

No se cambian HMAC, autorización, destino fijo, número comercial, operaciones del CRM ni reintentos. Continúa pendiente el diseño de recuperación de envíos fallidos: el evento guardado no se reprocesa automáticamente. El nuevo diagnóstico no corrige por sí solo la falta de respuesta.

## Validación y siguiente paso

Cinco pruebas nuevas: aceptación, rechazo y privacidad, respuestas inválidas, metadatos arbitrarios y timeout/red. Suite completa **356 pruebas pasadas**, cero fallos: `node --test tests/*.test.cjs tests/*.test.mjs tests/sql-aislado/*.test.mjs`. Sintaxis del receptor validada con `node --check`. Los casos usan objetos locales, no Meta ni mensajes reales. No se midió latencia productiva.

Siguiente paso operativo: verificar en Meta el número de prueba, suscripción de mensajes y último intento de entrega contra este endpoint; correlacionar un POST real con LASO_DIAG/LASO_RESULT/LASO_REPLY. Hace falta acceso autorizado al panel. El bloqueo anterior de publicación continúa sin resolver; no se intentó eludirlo ni se desplegó esta instrumentación. Tramitar aprobación por la vía normal antes de publicar y comprobar después la versión y registros. No hay una causa confirmada ni se declara el servicio recuperado.

## Receptor completo aislado — 26/11/2026

`tests/laso-webhook-aislado.test.mjs` importa el `index.js` real de la rama y captura el handler de Deno. Envía Request locales con HMAC calculada sobre el cuerpo, usando claves inventadas exclusivamente para pruebas. Sustituye fetch global por una lista cerrada de rutas; no existe fallback de red. Las respuestas de Supabase y Meta son dobles locales, no servicios reales.

Ocho escenarios (nueve pruebas contando el grupo) verifican saludo firmado con tres autorizaciones y destino fijo, rechazo de firma/remitente/phone_id sin acceso de red, ausencia o revocación de permiso antes de enviar, deduplicación entre Requests, diagnóstico de rechazo Meta sin contenido sensible, timeout sin falsa aceptación, fallo de base 503 sin envío y modo apagado por defecto. No se ejecutan operaciones financieras ni se escriben datos reales.

Se reproduce una limitación funcional existente: tras guardar el evento, un rechazo de envío retorna HTTP 200 al webhook; si llega el mismo evento otra vez, no intenta reenviar. La prueba lo documenta, no lo corrige ni lo atribuye a la incidencia productiva. La solución exige separar recepción, ejecución de acciones y estado de entrega con idempotencia, autorización vigente y tratamiento de resultados de envío inciertos; no basta con reprocesar el mensaje, porque podría repetir una escritura.

La lectura actual del despliegue mantiene v23 ACTIVE. Estos tests acreditan el circuito del código de la rama con dependencias sustituidas, no credenciales, suscripción Meta, entrega WhatsApp ni runtime Deno productivo. No se publicó código. Continúan pendientes acceso a Meta para revisar entregas y aprobación normal del despliegue previamente bloqueado.

Validación completa de esta entrega: **365 pruebas pasadas, cero fallos**, comando `node --test tests/*.test.cjs tests/*.test.mjs tests/sql-aislado/*.test.mjs`; incluye regresiones de agenda, clientes y memoria. No hay una mejora medida de latencia ni entrega productiva.

## Prohibir redirecciones REST — 27/11/2026

La función compartida `rest` del receptor ahora envía `redirect: 'error'` en las llamadas POST a Supabase, igual que las consultas y envíos que ya lo especificaban. Evita seguir una redirección desde el endpoint configurado en solicitudes con cabeceras de servicio. No se observó una redirección real ni exposición de credenciales; es una corrección preventiva, no la causa identificada de la falta de respuesta.

Dos escenarios nuevos del handler aislado comprueban que sus cinco solicitudes del saludo (tres autorizaciones, un guardado y un envío) llevan la política, y que un error de redirección durante autorización devuelve 503 sin guardar ni enviar. El doble local lanza TypeError; no se probó una redirección HTTP real ni se contactó un destino externo. Las pruebas cubren integración de opciones y manejo del error, no la implementación de fetch de Deno.

Sin despliegue: versión productiva observada v23 ACTIVE. Siguen pendientes la revisión de entrega en Meta y la aprobación del despliegue por la vía normal; no se reintentó ni se eludió el bloqueo. Se mantienen HMAC, número autorizado y destino fijo.

Validación: **372 pruebas pasadas, cero fallos**, con `node --test tests/*.test.cjs tests/*.test.mjs tests/sql-aislado/*.test.mjs`, incluidas regresiones de memoria, agenda y clientes. Sin medición de rendimiento productivo.

## Entradas nulas en lotes — 27/11/2026

`extraerMensajes` accedía directamente a `entry.changes` y `change.field`: un elemento null podía lanzar una excepción antes del manejo de errores de procesamiento. Se agregaron accesos opcionales para ignorar esas entradas, conservando el filtrado de número/phone_id y los mensajes válidos del lote.

Dos pruebas del handler con HMAC local comprueban un lote mixto con entradas/cambios nulos y un lote sin entradas utilizables: el primero procesa el saludo válido una vez; el segundo responde sin consultas ni envíos. No se observó este payload en producción y no se atribuye a él la incidencia de WhatsApp.

Producción sigue v23 ACTIVE. Cambio sin desplegar; no se modifican datos reales ni se envían mensajes. Continúan pendientes verificación de entrega en Meta y aprobación normal del despliegue bloqueado. No se alteran memoria, agenda ni CRM visual.

Validación completa: **374 pruebas pasadas, cero fallos**, comando `node --test tests/*.test.cjs tests/*.test.mjs tests/sql-aislado/*.test.mjs`; incluye memoria, agenda y clientes. Sin prueba productiva de entrega ni medición de eficiencia.
