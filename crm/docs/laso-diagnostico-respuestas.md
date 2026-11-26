# Diagnóstico de respuestas privadas — 26/11/2026

## Evidencia actual

Receptor productivo `whatsapp-interno`: v23 ACTIVE. En la ventana predeterminada de últimas 24 horas del flujo de logs disponible aparecen dos eventos function_logs (Boot/Shutdown) y un function_edge_logs: GET a `/functions/v1/whatsapp-interno`, 403, a las 17:10 UTC (14:10 Argentina). Corresponde temporalmente al diagnóstico anterior. No se observó POST de Meta en esta consulta. No prueba que Meta no lo haya enviado: faltan evidencias de entrega/suscripción desde su panel y no se conoce la completitud del flujo. El GET rechazado no acredita recepción ni respuesta WhatsApp; EarlyDrop tampoco se toma como causa del incidente.

## Cambio preparado, no desplegado

`supabase/functions/laso-privado/respuesta-diagnostico.mjs` se integra al envío final del receptor en GitHub. Clasifica aceptación por Meta, rechazo HTTP, respuesta sin confirmación, tiempo agotado y fallo de transporte. Conserva códigos y subcódigos numéricos para diagnóstico. Nunca registra el cuerpo de error, mensaje, destinatario, token, id del mensaje ni traza de Meta. Aceptación exige HTTP 2xx e identificador no vacío, sin error; **no significa entrega al teléfono**.

No se cambian HMAC, autorización, destino fijo, número comercial, operaciones del CRM ni reintentos. Continúa pendiente el diseño de recuperación de envíos fallidos: el evento guardado no se reprocesa automáticamente. El nuevo diagnóstico no corrige por sí solo la falta de respuesta.

## Validación y siguiente paso

Cinco pruebas nuevas: aceptación, rechazo y privacidad, respuestas inválidas, metadatos arbitrarios y timeout/red. Suite completa **356 pruebas pasadas**, cero fallos: `node --test tests/*.test.cjs tests/*.test.mjs tests/sql-aislado/*.test.mjs`. Sintaxis del receptor validada con `node --check`. Los casos usan objetos locales, no Meta ni mensajes reales. No se midió latencia productiva.

Siguiente paso operativo: verificar en Meta el número de prueba, suscripción de mensajes y último intento de entrega contra este endpoint; correlacionar un POST real con LASO_DIAG/LASO_RESULT/LASO_REPLY. Hace falta acceso autorizado al panel. El bloqueo anterior de publicación continúa sin resolver; no se intentó eludirlo ni se desplegó esta instrumentación. Tramitar aprobación por la vía normal antes de publicar y comprobar después la versión y registros. No hay una causa confirmada ni se declara el servicio recuperado.
