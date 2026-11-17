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

## Sesión versionada 12/11/2026
- Nuevo `secretario-sesion.mjs`: `crearSesionRevision({ id, texto, ahora })` devuelve `consultar()`, `corregir(textoCompleto, { id, version })` y `confirmar({ id, version })`. Reutiliza la revisión existente.
- Estado encapsulado en memoria y copias independientes al consultar. Cada corrección aceptada incrementa la versión y borra la confirmación simulada, incluso si se reenvía el mismo texto. Se rechazan referencias antiguas, de otro borrador o sin versión; una segunda corrección basada en la versión vieja no pisa la primera.
- Solo permite confirmación simulada de `pendiente_revision`; faltantes y otros tipos quedan bloqueados. Repetir la misma confirmación no cambia el estado. El reloj inicial se copia para conservar el significado de fechas relativas durante la sesión.
- **No es autorización ni aprobación de producción.** El identificador lo asigna el integrador; conocerlo no autentica al remitente. No persiste, no resuelve concurrencia entre procesos, no acepta respuestas parciales, no valida clientes ni tareas. El integrador futuro debe autenticar, autorizar y persistir con control transaccional de versión. No usar `confirmacion_simulada` para habilitar escrituras.
- Todas las salidas conservan ejecución/envío deshabilitados y confirmación real pendiente. Sigue separado del webhook y del CRM; `WHATSAPP_BOT_MODO=apagado`. Sin cambios visuales, de producción o datos reales.
- Validación local: `node --test tests/*.test.cjs tests/*.test.mjs`, 137/137 aprobadas (9 nuevas); `git diff --check` limpio. Casos comprobados: invalidación tras corregir, rechazo de confirmación vieja, conflicto de dos correcciones, confirmación repetida idempotente y aislamiento de copias. No se midió ahorro operativo.
- No se probaron Deno, audio, Safari, Nueva Orden/agenda/PDF reales ni persistencia. Próximo paso: cancelación y vencimiento de sesiones antes de diseñar su integración autenticada.

## Cancelación de sesión 13/11/2026
- `cancelar({ id, version })` descarta la sesión vigente en memoria, revoca su confirmación simulada y bloquea `confirmar` y `corregir`. Se expone `estado_sesion: activa | cancelada` separado del estado de interpretación. No hay reapertura; para otro pedido se crea una nueva sesión con identificador único.
- La cancelación no incrementa la versión del contenido: el estado terminal bloquea cualquier acción posterior. Repetirla con la misma referencia devuelve `ya_cancelada` sin cambios. Referencias antiguas, ausentes o de otro borrador se rechazan; pueden cancelarse pedidos incompletos.
- Pruebas locales: `node --test tests/*.test.cjs tests/*.test.mjs`, 142/142 aprobadas (5 nuevas), `git diff --check` limpio. Verificado: revocación, bloqueo posterior, reintento idempotente, rechazo de referencias viejas e independencia entre sesiones/copias. Sin medición de ahorro de tiempo operativo.
- Sigue siendo simulación interna sin autenticación, persistencia, webhook, envíos ni guardado CRM. No se modifican producción, datos reales o dashboard; bot apagado por defecto. No se probaron audio, Deno, Safari ni Nueva Orden/agenda/PDF reales. Vencimiento automático pendiente como siguiente paso.

## Vencimiento de sesión 14/11/2026
- `crearSesionRevision` admite `reloj` (función que devuelve milisegundos, por defecto `Date.now`) y `vigenciaMs` (entero positivo, por defecto 15 minutos). Ese plazo es una decisión provisional de simulación, pendiente de validar para uso real. `ahora` sigue siendo la referencia independiente para interpretar fechas relativas.
- Cada consulta o acción verifica el reloj. Al alcanzar el límite pasa a `vencida`, revoca confirmación simulada y rechaza confirmar, corregir o cancelar. Corregir no renueva el plazo. No usa temporizador ni proceso en segundo plano: detecta el vencimiento en el siguiente acceso.
- Un reloj inválido, que falla o retrocede cierra la sesión como vencida; no se reabre aunque el reloj se recupere. Cancelación previa conserva su estado terminal. Se expone `vence_en_ms` en la copia de consulta.
- Validación: `node --test tests/*.test.cjs tests/*.test.mjs`, 148/148 aprobadas, 6 nuevas; `git diff --check` limpio. Casos medidos con reloj simulado: aceptación 1 ms antes, rechazo en el límite, plazo no renovable, fallo/regresión del reloj y cancelación previa. No hay medición de ahorro operativo.
- Continúa en memoria, sin autenticación, persistencia, integración CRM/WhatsApp ni efectos externos. Sin cambios de dashboard o producción; bot apagado. No se probaron audio, Deno, Safari ni Nueva Orden/agenda/PDF reales. Siguiente paso: probar la autorización del operador junto con este ciclo de borrador en un adaptador aislado, antes de conectar servicios reales.

## Adaptador de acceso aislado 15/11/2026
- Nuevo `secretario-acceso.mjs`: `crearRevisionConAcceso({ numero, autorizar, ...opcionesSesion })` devuelve un controlador con `operar({ numero, accion, referencia, texto })`. Mantiene privada la sesión subyacente.
- Verifica `agenda.registrar` al crear y en cada consulta, corrección, confirmación simulada o cancelación. Vincula la sesión al número, acceso_id, perfil_id y versión iniciales. Un cambio de identidad/versión, revocación o error deniega sin devolver el contenido del borrador. Otro remitente no puede acceder aunque conozca id y versión.
- **Frontera de confianza:** el número debe venir de un transporte autenticado (por ejemplo, webhook con firma validada); la dependencia `autorizar` debe ser del servidor. Pasar un número o callback inventado no autentica a nadie. No está conectado al webhook, Supabase ni WhatsApp. Las pruebas usan dobles locales sin llamadas externas.
- No reemplaza autorización transaccional al guardar ni cubre revocación posterior a la comprobación. No persiste ni ejecuta acciones reales. `agenda.registrar` se reutiliza para esta simulación; permisos de revisión específicos quedan por definir antes de integrar.
- Validación: `node --test tests/*.test.cjs tests/*.test.mjs`, 154/154 aprobadas (6 nuevas); `git diff --check` limpio. Se cubren las 4 operaciones frente a otro remitente y a revocación/reasignación/cambio de versión, errores del autorizador, versiones viejas y vencimiento. Sin medición de ahorro operativo.
- Sin cambios en producción, datos reales, dashboard o modo apagado. No se probaron audio, Deno, Safari ni flujos CRM reales de Nueva Orden, agenda y PDF. Próximo paso: probar el recorrido conjunto desde un evento autenticado simulado hasta el borrador, incluyendo duplicados, sin conectar Meta.

## Recorrido de entrada 16/11/2026
- Se reprodujo una incompatibilidad: el intérprete clasificaba «Agendame» y «Programame» como agenda, pero `esComandoAgenda` los rechazaba. Ahora el filtro reutiliza `esSolicitudAgenda`, exportada por el intérprete, evitando dos reglas divergentes.
- Nuevo arnés local `tests/secretario-recorrido.test.mjs`: cuerpo ficticio firmado → validación HMAC → extracción/destino → autorización simulada → consulta del borrador. Cubre Agendame/Agendáme/Programame/Programáme, firma alterada, destino incorrecto, permiso denegado, comandos anteriores y entradas ajenas.
- Validación: `node --test tests/*.test.cjs tests/*.test.mjs`, 161/161 aprobadas (7 nuevas); `git diff --check` limpio. Las 4 variantes llegan a borrador en el arnés. Firma inválida y destino incorrecto provocan 0 consultas al autorizador. No se midió ahorro operativo.
- El arnés solo une módulos en pruebas: no se conectó el receptor real al ciclo de revisión. No demuestra recepción Meta ni deduplicación persistente. La prueba conjunta de duplicados sigue pendiente como siguiente paso.
- Sin despliegue, activación, secretos, mensajes ni cambios de datos reales/dashboard. `WHATSAPP_BOT_MODO=apagado` permanece por defecto. No se probaron Deno, audio, Safari ni Nueva Orden/agenda/PDF reales.

## Duplicados dentro del lote 17/11/2026
- `procesarMensajes` recuerda evento_id después de una inserción resuelta y omite repeticiones posteriores del mismo lote. No agrupa por texto: eventos con identificadores distintos se conservan. Requiere eventos ya validados por `extraerMensajes`.
- Duplicados del lote se contabilizan como `omitidos`; `registrados` cuenta llamadas de inserción resueltas de eventos distintos en ese lote, no necesariamente filas nuevas en la base. No autorizados no ocupan el identificador; errores de inserción se propagan y permiten reintentar la solicitud.
- Mejora medida en prueba sintética con 50 copias: 1 consulta de autorización y 1 inserción frente a 50 de cada una (98 % menos llamadas). No es una medición de latencia o ahorro en producción.
- Reintentos entre solicitudes o procesos siguen dependiendo de la restricción única persistente y del manejo existente de duplicados; no se verificó Supabase real. El doble de almacenamiento usado en pruebas no demuestra concurrencia ni persistencia real.
- Validación: `node --test tests/*.test.cjs tests/*.test.mjs`, 166/166 aprobadas (5 nuevas), `git diff --check` limpio. Sin despliegue, mensajes, secretos, datos reales ni cambios de dashboard; `WHATSAPP_BOT_MODO=apagado`. No se probaron Deno, audio, Safari ni flujos reales Nueva Orden/agenda/PDF. Próximo paso: validar reintentos concurrentes contra una base de pruebas aislada, cuando esté disponible.
