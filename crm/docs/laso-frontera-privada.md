# Frontera privada de Laso — 25/11/2026, 11 h

Base inspeccionada: Supabase whatsapp-interno ACTIVE v21. Incluía una corrección de fecha relativa posterior a v20, conservada al sincronizar `supabase/functions/laso-privado`. Snapshot exacto de retorno: `supabase/snapshots/whatsapp-interno-v21`.

## Corrección
Antes, otro número con permiso accidental podía insertar borradores aunque la respuesta estuviera bloqueada al operador. Ahora `procesarMensajes` descarta cualquier remitente distinto de +5493512143961 antes de autorización o persistencia. El operador sigue sujeto a autorización; no se confía en números declarados en el texto. No se cambia destino de mensajes, número comercial, HMAC, secretos, confirmaciones ni permisos financieros.

## Evidencia
219/219 pruebas Node pasan; cinco nuevas. Tres regresiones del núcleo fallaban antes. Cuatro pruebas de núcleo cubren permiso accidental, denegación del operador, lote mixto/deduplicación y suplantación textual. Una integración ejecuta index.js con Deno y fetch simulados: tres cuerpos firmados ficticios de terceros (confirmación, audio, suplantación), cero llamadas a Supabase/Meta/Groq y cero registros. No demuestra recepción real de WhatsApp ni entrega al operador.

La consulta de logs de 13:00–14:03 UTC devolvió conteos por fuente, no verifica ausencia de errores. Se consultaron avisos de seguridad; las advertencias generales del CRM siguen pendientes de análisis. No se modificaron tablas ni datos reales. No se probaron altas completas, concurrencia SQL, audio real, Safari ni PDF. Sin medición de latencia; se eliminan consultas de autorización innecesarias para terceros.

## Despliegue y rollback
Desplegar los siete archivos de laso-privado como whatsapp-interno, entrypoint index.js y verify_jwt=false (autenticación HMAC propia). Releer la versión antes del reemplazo; si cambió, detener y reconciliar. Para rollback, usar los siete archivos del snapshot v21 con igual configuración. Después comparar fuentes recuperadas con las enviadas y comprobar HTTP 403 para POST sin firma, sin crear mensajes ni personas.

Próximo paso: transacciones aisladas de alta y concurrencia, manteniendo confirmación exacta y control de revocación durante espera de bloqueo.
