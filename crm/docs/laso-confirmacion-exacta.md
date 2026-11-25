# Confirmación exacta — 25/11/2026, 14 h

Base: whatsapp-interno v22 ACTIVE; GitHub 1ba27be739865098272e7cbb7f3a309e81933db7. Se recuperó la ejecución local tras un bloqueo temporal por límite de uso.

## Cambio
`confirmacion-exacta.mjs` verifica el mensaje escrito original antes de llamar a las RPC de alta/turno. Exige CONFIRMAR ALTA código o CONFIRMAR código; admite mayúsculas/minúsculas y espacios exteriores, pero no puntuación, espacios interiores extra, código distinto o audio. Las dos gestiones reutilizan este control. Ante diferencia devuelve la instrucción exacta sin llamar a la base para confirmar. Conserva la validación SQL existente; no amplía permisos ni modifica datos.

## Evidencia
225/225 pruebas locales aprobadas (6 nuevas); dos regresiones fallaban antes. Cada flujo prueba seis entradas alteradas, tres variantes válidas y un audio. En los 12 casos alterados no se llama RPC; las seis variantes válidas conservan la llamada y respuesta. Son dependencias simuladas: no prueba guardado real ni entrega WhatsApp. Sin medición de latencia.
Consulta de permisos reales: ambas RPC no ejecutables por anon/authenticated, SECURITY INVOKER. No hubo llamadas de alta real, clientes ficticios, cambios financieros ni mensajes.

## Despliegue y rollback
Usar los ocho archivos de supabase/functions/laso-privado, nombre whatsapp-interno, entrypoint index.js y verify_jwt=false por HMAC propio. Antes del despliegue verificar que sigue v22; después comparar fuentes y verificar rechazo de POST sin firma.
Rollback: recuperar los siete archivos de supabase/functions/laso-privado en commit 1ba27be739865098272e7cbb7f3a309e81933db7 y redesplegar con la misma configuración. Sin migración SQL.
Pendientes: altas completas, concurrencia, rollback tras fallo parcial, revocación durante espera y pruebas reales de audio/WhatsApp/Safari/PDF. No se declara disponibilidad integral.
