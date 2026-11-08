# Laso — secretario interno: contrato de borradores v0

Se agregó un módulo puro `supabase/functions/whatsapp-interno/secretario-borradores.mjs` y pruebas en `tests/secretario-borradores.test.mjs`. **No está integrado al webhook ni desplegado**. Es una primera pieza comprobable para interpretar notas internas; no es un modelo de IA ni un sistema de agenda operativo.

## Alcance real
- Distingue borradores de agenda, presupuestos, recordatorios y notas generales.
- Solo interpreta fechas explícitas DD/MM/AAAA y horarios HH:MM. No adivina «mañana», «esta tarde» ni una dirección o cliente.
- Informa datos faltantes para pedir aclaración posteriormente.
- Devuelve siempre `requiere_confirmacion: true`, `puede_ejecutar: false`, `puede_enviar: false`.
- No toca SQL, clientes, órdenes, Caja, WhatsApp, Supabase desplegado ni credenciales.

## Camino hacia un secretario útil
1. Simulador de solicitudes sin datos reales: entradas → borradores → resumen para confirmar.
2. Resolver fecha relativa con zona horaria explícita de Córdoba y reloj inyectado, con pruebas de medianoche y feriados.
3. Lectura autorizada y mínima de agenda, clientes y órdenes; permisos granulares, auditoría y límites de datos.
4. Motor de voz opcional y consentimiento, límites de archivo, política de retención y costos.
5. Confirmación explícita por operador antes de cualquier escritura. Operaciones idempotentes, rollback y pruebas de concurrencia.
6. Resúmenes diarios, órdenes, presupuestos y recordatorios internos; integración con WhatsApp únicamente después de coexistencia y recepción verificadas.

## Criterios de aceptación futuros
- Jamás crear una orden con una fecha incompleta o cliente ambiguo.
- Distinguir borrador, confirmado, rechazado y ejecutado en una máquina de estados auditable.
- Ignorar instrucciones contenidas en el texto para saltarse permisos; identidad derivada del webhook firmado y autorización servidor.
- Ensayar los errores y reintentos sin duplicar órdenes ni mensajes.
- Conservar `WHATSAPP_BOT_MODO=apagado` como comportamiento predeterminado.
