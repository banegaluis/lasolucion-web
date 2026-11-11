# Laso — secretario interno: contrato de borradores v1

Código fuente: `supabase/functions/whatsapp-interno/secretario-borradores.mjs`.
Pruebas: `tests/secretario-borradores.test.mjs`.

**Estado:** módulo puro de interpretación en rama del PR #12. **NO está conectado al webhook de Meta, al CRM ni desplegado en Supabase.** No es un modelo conversacional: usa reglas simples y deterministas. Ningún texto ejecuta órdenes o envía mensajes.

## Funcionalidad probada (pruebas locales de desarrollo)
- Clasifica borradores internos: agenda, recordatorio, presupuesto y nota.
- Reconoce expresiones frecuentes: «Agendame», «Agendá», «Recordame», «Presupuestame».
- Acepta fechas DD/MM/AAAA y horarios HH:MM; también «a las 10» o «9 hs».
- Permite «hoy», «mañana» y «pasado mañana» **solo cuando se proporciona explícitamente una fecha/hora de referencia** (objeto Date válido). Usa America/Argentina/Cordoba para decidir el día correcto y suma días de calendario, incluso a medianoche UTC o en cambios de mes.
- Rechaza fechas calendarias imposibles. Una fecha explícita inválida tiene prioridad sobre una expresión relativa, para no inventar otro día.
- Si falta una fecha/hora fiable, lo indica en el arreglo `faltantes`. Mencionar «para Guille» sirve como indicio textual, **no identifica ni valida clientes del CRM**.
- El módulo emite siempre `requiere_confirmacion: true`, `puede_ejecutar: false`, `puede_enviar: false`. No hace escrituras, consultas externas ni pagos.

### Cómo correr las pruebas
```bash
node --test tests/secretario-borradores.test.mjs
```

Resultado local reportado al 8/11/2026: 12 pruebas del módulo aprobadas con Node 22. Esto **no sustituye** CI, pruebas Deno, integración con la API, test del webhook real ni ensayos desde iPhone.

## Diseño seguro de la siguiente fase
1. Completar el simulador de solicitudes sin datos personales: pedido → borrador → aclaración → aprobación. La preparación de preguntas y resumen existe desde el 11/11; la aprobación con estado todavía no.
2. Interpretación ampliada para días de semana y fechas coloquiales con resolución determinista de zona y ambigüedades, sin inventar horarios.
3. Consulta mínima y autorizada de agenda/clientes, sin exponer datos a remitentes no autenticados.
4. Voz interna optativa con consentimiento, control de costos, política de retención y eliminación de audios.
5. Estado auditable de borradores (pendiente, aclarado, aprobado, cancelado), con idempotencia y prevención de duplicados.
6. Antes de crear órdenes, realizar pruebas transaccionales y requerir aprobación del operador. Mantener `WHATSAPP_BOT_MODO=apagado` por defecto.
7. Conectar WhatsApp solamente después de verificar coexistencia, recepción del webhook, permisos y controles de despliegue.

## Advertencias técnicas
- El parser reconoce patrones básicos, no comprende el significado completo ni detecta conflictos de agenda.
- El ejemplo «Agendame mañana a las 10 para Guille» produce una fecha si hay reloj inyectado, pero **no crea turno real**.
- No atribuir esta prueba a la implementación desplegada en Supabase ni a WhatsApp.
- No activar mensajes externos, gastos, escritura de datos ni acceso a Caja por una instrucción recibida en el propio chat.

## Corrección 9/11/2026: horarios inválidos y ambiguos
- «a las 10:75» ya no se reduce a 10:00. Horarios inválidos, incluso acompañados de otro válido, dejan `hora: null` y solicitan `hora_explicita`.
- Varios horarios distintos (incluidos formatos mixtos) requieren aclaración. Repetir el mismo horario no genera un faltante.
- No resuelve aún franjas «tarde/noche», rangos ni correcciones conversacionales. Mantiene confirmación obligatoria y ninguna ejecución/envío.
- Módulo puro sin conexión al webhook: no implica activación ni mejora desplegada.

Validación local del 9/11/2026 (Node v24.22.1): `node --test tests/*.test.cjs tests/*.test.mjs`, 105 pruebas aprobadas, 0 fallos; 8 pruebas nuevas. `git diff --check` sin errores. No se probaron Safari, flujos reales de Nueva Orden/agenda/PDF, Deno, webhook ni audio. No se midió ahorro de tiempo operativo.

## Corrección 10/11/2026: mañana y tarde junto a una hora
- «3 de la tarde» y «3:30 de la tarde» producen 15:00 y 15:30; se admite también la hora de 24 h (15 de la tarde). «9 de la mañana» conserva 09:00.
- «De la mañana» ya no se interpreta como fecha relativa. Sin otro día indicado, pide fecha; «mañana a las 9 de la mañana» conserva el día siguiente.
- Por criterio conservador, «12 de la mañana/tarde», «de la noche», contradicciones y horarios inválidos piden hora explícita de 24 h. No interpreta todas las variantes del habla, rangos ni correcciones conversacionales.
- Validación: 120 pruebas locales aprobadas, 0 fallos (15 nuevas), con `node --test tests/*.test.cjs tests/*.test.mjs`; `git diff --check` limpio. Los dos errores reproducidos (03:00 en vez de 15:00 y fecha siguiente inventada) quedan cubiertos. No se midió ahorro de tiempo de uso real.
- Se mantienen confirmación obligatoria, ejecución/envío deshabilitados y módulo sin conectar al webhook. No se probaron audio, Deno, Safari ni flujos reales de Nueva Orden, agenda y PDF. Sin cambios de interfaz ni producción.

## Revisión interna 11/11/2026
- Nuevo módulo puro `supabase/functions/whatsapp-interno/secretario-revision.mjs`, función `prepararRevisionInterna(texto, { ahora })`. Reutiliza el intérprete; no confía en flags externos de un borrador.
- Para agenda/recordatorios devuelve preguntas en español por los faltantes detectados y un resumen estructurado con pedido original, fecha, hora y zona. Agrupa todos los faltantes en una revisión. No vuelve a preguntar por campos ya interpretados.
- Estados: `entrada_invalida`, `revision_manual` (otros tipos o confirmaciones sueltas), `necesita_aclaracion` y `pendiente_revision`. Este último no equivale a aprobación ni valida la tarea o el cliente: el indicio textual del intérprete sigue requiriendo revisión humana.
- Para aclarar, se reenvía el pedido completo; no mantiene conversación, no combina respuestas parciales ni recibe aprobaciones. Tampoco persiste, autentica, envía o conecta al webhook. Siempre requiere confirmación, con ejecución/envío deshabilitados.
- Pruebas: `node --test tests/*.test.cjs tests/*.test.mjs`, 128/128 aprobadas en Node v24.22.1; 8 pruebas nuevas. Caso medido: 3 faltantes agrupados en una revisión; con fecha y cliente indicados pregunta solo por la hora. No hay medición de ahorro operativo real.
- No se ejecutaron pruebas de audio, Deno, Safari ni flujos CRM reales (Nueva Orden, agenda, PDF). Dashboard sin cambios; `WHATSAPP_BOT_MODO=apagado` sigue por defecto. Próximo paso: estado versionado para correcciones y aprobación vinculada al borrador, con rechazo de confirmaciones antiguas.
