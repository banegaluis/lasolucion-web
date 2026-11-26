# Edición conversacional de agenda — 25/11/2026

Primera etapa implementada en agenda-edicion.mjs: núcleo puro sin red ni escritura. Prepara una reprogramación por número de orden y acepta correcciones dentro de una sesión privada de hasta 30 minutos. No está conectado al webhook ni desplegado. Supabase verificado: whatsapp-interno v23 ACTIVE; base GitHub bd70bca008489c6ad79f3adf546cbe66713b6020.

Ejemplo comprobado: «Pasá la orden #42 para mañana a las 10» genera una propuesta de 10:00 a 12:00 para una orden de dos horas; «Mejor a las 11» conserva orden, fecha y duración y propone 11:00 a 13:00. «Cancelar cambio» descarta la propuesta. Ningún texto confirma escrituras en este módulo.

Acepta hoy, mañana, pasado mañana o DD/MM/AAAA y horas explícitas. Usa la fecha de Córdoba. Solo órdenes pendientes, identificadas unívocamente por número; no resuelve nombres de clientes todavía. Rechaza fechas imposibles, pasado, horarios inválidos, cruce de medianoche, superposición y datos horarios incompletos. La corrección no renueva el vencimiento original; una sesión de otro operador o un cambio de horario/estado/id de la orden invalida la propuesta.

Pruebas: nueve escenarios nuevos; 258 resultados aprobados en suite completa incluyendo SQL aislado y grupos padre. Una corrección breve («Mejor a las 11») evita repetir la orden y fecha en el caso probado; no hay ahorro operativo o latencia de WhatsApp medidos.

Límites: el llamador futuro debe autorizar al operador y entregar todas las órdenes relevantes recién consultadas; un arreglo local incompleto no garantiza disponibilidad. El estado de sesión se devuelve como objeto, todavía sin persistencia. No hay búsqueda por cliente, audio real, adaptador de chat, guardado ni protección transaccional implementados para esta edición. Las comprobaciones del módulo no sustituyen la validación SQL bajo bloqueo ni una confirmación exacta vinculada a la versión de la propuesta.

Siguiente etapa: integrar selección y propuesta en el chat privado, persistir sesión ligada al acceso y preparar confirmación con código propio. El guardado deberá revalidar permisos, estado original y disponibilidad atómicamente, registrar auditoría y ser idempotente. No reutilizar el comando de alta para editar. No desplegar como función completa antes de esas pruebas. No se cambiaron dashboard, clientes reales, agenda, Caja, números, secretos ni envíos. Reversión: retirar este módulo y sus pruebas; no hay migración productiva que revertir.

## Confirmación conversacional — 25/11/2026, 22 h

Se agregó agenda-edicion-conversacion.mjs, un adaptador puro todavía no conectado al webhook. Cada propuesta/corrección recibe un UUID aleatorio de 32 caracteres hexadecimales; solo admite texto exacto «CONFIRMAR CAMBIO código», separado de las confirmaciones de alta. Corregir reemplaza el código. Cancelar, una corrección inválida o una confirmación incorrecta descartan la sesión que devuelve el adaptador.

Al confirmar reutiliza la validación del núcleo: dueño, vencimiento, estado original, fecha futura y disponibilidad sobre las órdenes entregadas. Devuelve intencion_validada con base y propuesta, y sesión nula; no ejecuta un UPDATE ni informa guardado exitoso. Una nueva llamada con la sesión devuelta no vuelve a producir intención. Esto NO garantiza consumo atómico ni idempotencia entre procesos: debe implementarse en el almacenamiento del adaptador real y en SQL. Tampoco vuelve a consultar permisos o datos por sí mismo.

Siete pruebas nuevas cubren conversación completa, código anterior, texto alterado/alta/audio, identidad/vencimiento, modificaciones externas/conflictos, cancelación/error y repetición con sesión consumida. Suite completa 265/265 resultados aprobados. La función desplegada permanece v23 ACTIVE, verificada antes del trabajo; base GitHub 55451e1fba71cc2b694166034ba9125f97d9bfb9. No hay despliegue, escrituras productivas, mensajes ni medición de eficiencia operativa nueva.

Integración pendiente: persistencia privada de sesiones con reemplazo/consumo atómico; autorización real de edición y consulta completa; RPC transaccional con comprobación de base, disponibilidad e idempotencia; luego conectar al chat. La instrucción de confirmación del módulo es parte del contrato futuro y no está disponible hoy en WhatsApp. Revertir este commit retira adaptador/tests/documentación, sin rollback de base.

## Persistencia con revisión — 25/11/2026, 22:56 h

Se agregó supabase/propuestas/edicion-sesion.sql como prototipo aislado, fuera de migraciones. Mantiene una fila por acceso y reemplaza su contexto solo si coinciden versión de acceso y revisión leídas. La primera escritura exige revisión cero y no sobrescribe una fila existente. Cancelar guarda NULL e incrementa la revisión, sin eliminar la fila, para impedir que una respuesta atrasada restablezca un contexto viejo. Un conflicto devuelve NULL: el adaptador debe releer y resolver, no repetir a ciegas ni informar éxito.

Es SECURITY INVOKER, con search_path vacío y sin permisos PUBLIC de esquema, tabla o función. No es un endpoint autorizado: la identidad no se valida contra bot_autorizar, no se conceden permisos a service_role ni se publica por PostgREST. No aplicar en producción hasta integrar autorización, expiración, cambio de versión de acceso, deduplicación de eventos y consumo junto al guardado de la orden en la misma transacción. No se acortó ni eliminó ninguna comprobación del bot actual.

Seis escenarios SQL nuevos (siete resultados con el grupo): respuesta atrasada, descarte, versión/reintento, rollback, JSON inválido y ausencia de privilegios para un rol visitante. Total 272/272 aprobados. PGlite serializa: comprueba conflictos de revisión secuenciales, no carreras entre conexiones ni entrega WhatsApp. No hay métricas de eficiencia operativa nuevas.

Verificación al inicio: v23 ACTIVE y rama e20473faf7092925e5f5d7dca7e038bd06fd8354. No hubo despliegue, datos productivos modificados, envíos, cambios visuales ni secretos. Próximo paso: adaptar esta persistencia al acceso privado y vincular reemplazo/confirmación con el evento original, antes de habilitar edición real. Revertir el commit retira el prototipo y sus pruebas; producción no requiere rollback.

## Validación del contexto — 26/11/2026

Se reprodujeron tres regresiones antes de corregirlas: contexto sin propuesta causaba excepción; cambiar cliente/domicilio/título conservaba una propuesta basada en la información anterior; reloj inválido o filas nulas podían interrumpir el procesamiento. El núcleo ahora descarta entradas incompletas con una aclaración y amplía la base comparada a cliente, domicilio y título. El adaptador debe consultar y suministrar esos campos: si los omite, no puede detectar cambios de datos ausentes. Las sesiones de formato anterior se invalidan de forma conservadora.

Tres pruebas nuevas (con matrices de casos) fallaban antes y pasan después. Suite completa: 275/275 resultados. No se midió ahorro operativo. Lectura fresca de GitHub: 37c911d5078bb8b54f6a666b100ab2035a236b93; Supabase whatsapp-interno v23 ACTIVE. Corrección solo del prototipo de edición: no hubo despliegue, mensajes ni cambios reales. Persistencia autorizada, guardado transaccional e integración WhatsApp siguen pendientes. Revertir el commit restaura el prototipo anterior; no requiere rollback productivo.

## Persistencia autorizada aislada — 26/11/2026, 01 h

edicion-sesion-autorizada.sql envuelve el reemplazo con validación del único número privado, versión explícita, permiso agenda.editar y evento de texto ligado al mismo acceso/perfil/versión. El operador del JSON debe coincidir con el UUID del acceso. Conserva SECURITY INVOKER, search_path vacío y EXECUTE revocado a PUBLIC. Toma FOR SHARE sobre acceso/perfil antes de autorizar; su interacción concurrente con revocación sigue pendiente de prueba multiconexión. No se otorgó agenda.editar a nadie en producción.

Cinco escenarios nuevos (seis resultados contando el grupo): guardado/conflicto/descarte, número/versión/permiso incorrectos, evento ajeno/audio, dueño de contexto ajeno y revocación previa/rollback. Total 281/281 resultados. Usa copia de bot_autorizar previamente obtenida del despliegue sobre tablas mínimas locales. No valida esquema completo de la sesión, antigüedad del evento, correspondencia semántica entre texto/propuesta ni deduplicación de eventos; estas condiciones y el consumo atómico con edición de orden deben integrarse antes de exponer un endpoint. La función inferior reemplazar continúa siendo un auxiliar privado no autorizado para clientes.

Verificación de esta ejecución: GitHub fae6ac8562d56ebb26c0cb2f3c045afbf7a91719 y Supabase v23 ACTIVE. No despliegue, envíos, cambios reales o secretos. Sin métricas operativas nuevas. Siguiente paso: vincular evento, propuesta vigente y confirmación exacta en una transacción que actualice la orden y deje auditoría/idempotencia. Reversión: retirar prototipo/tests; no hay cambios productivos que revertir.

## Reintentos de persistencia — 26/11/2026, 02 h

El prototipo guardar_autorizada registra solicitud y resultado por evento en la misma transacción que reemplaza la sesión. Un reintento idéntico devuelve el resultado previo con repetido=true; un evento reutilizado con distinta versión/revisión/contenido devuelve evento_reutilizado. La autorización se comprueba antes de devolver resultados previos. Reintentar una propuesta vieja después de descartarla no restaura el contexto; el consumidor debe tratar repetido como acuse histórico, no como estado actual ni motivo para reenviar un mensaje.

Se agregaron tres escenarios y se ajustó el contrato del reintento en la prueba anterior. 284/284 resultados aprobados: reutilización rechazada, reintento viejo sin resurrección y rollback del registro de evento cuando falla el reemplazo. PGlite serializa el ensayo: no acredita concurrencia real. No se implementó todavía la edición atómica de órdenes; este avance cierra la deduplicación de la persistencia que aquella necesita. Falta retención/limpieza de eventos, esquema/expiración de sesión, vínculo semántico con el mensaje y consumo con la escritura de orden/auditoría.

Lecturas frescas: rama 6b74d3d3b502aa663076812b9e9890d63dca4d08; Supabase v23 ACTIVE. Sin despliegues, datos reales modificados, secretos ni mensajes. No hay medición de eficiencia operativa; el caso local evita un segundo reemplazo y aumento de revisión por reintento. Revertir el commit solo afecta el prototipo y sus pruebas, sin rollback productivo.

## Vencimiento al persistir — 26/11/2026, 03 h

El prototipo guardar_autorizada exige creada numérica en milisegundos, código hexadecimal de 32 caracteres y objetos base/propuesta. Rechaza creación futura y antigüedad mayor o igual a 30 minutos según clock_timestamp del servidor, antes de registrar el evento o la sesión. Un reintento después del vencimiento devuelve sesion_vencida, aunque antes hubiera resultado guardada. NULL sigue permitiendo descartar contexto.

Dos escenarios nuevos con matrices de datos: vencida/futura sin registros y datos incompletos/código inválido. Suite 286/286 resultados aprobados. No prueba contenido semántico de base/propuesta ni impide por sí solo que un adaptador privilegiado cambie creada; falta contrastar creación original y vincular la propuesta con el evento. Tampoco reemplaza la comprobación de vencimiento al confirmar. Estos límites impiden tratar el prototipo como listo para producción.

Lecturas frescas: GitHub c835588369d2f6611f969fa390c6915cbd190378; Supabase v23 ACTIVE. Sin despliegue, datos reales modificados, envíos o medición operativa nueva. Siguiente etapa: cerrar vínculo de propuesta y confirmación con guardado/auditoría de orden atómicos. Reversión solo del commit de prototipo/tests, sin rollback productivo.

## Correcciones sin renovar vigencia — 26/11/2026, 04 h

Se reprodujo una falla del prototipo: guardar_autorizada aceptaba corregir una sesión cambiando su creada, renovando su vigencia, o conservando el código anterior. Ahora bloquea la fila de sesión y, cuando coincide la revisión solicitada, exige mantener creada y reemplazar el código. Un contexto inválido deja la sesión intacta y registra el rechazo por evento. Tras descartar explícitamente el contexto (NULL) se admite una conversación nueva con creación/código propios, conservando la progresión de revisión.

Dos escenarios nuevos: corrección inválida/válida y reinicio tras descarte. La regresión de renovación falló antes del arreglo; suite final 288/288 resultados. PGlite prueba secuencias, no carreras multiconexión. Sigue siendo prototipo sin guardado de orden, auditoría de modificación ni conexión WhatsApp; no demuestra identidad semántica entre mensaje y propuesta.

Verificación fresca: GitHub a4c426927a4c77ed4ad724526d10d92b9370ee7f y Supabase v23 ACTIVE. Sin despliegue, mensajes o datos reales modificados. Revertir el commit afecta solo prototipo/tests. Próxima etapa: transacción de edición de orden con confirmación exacta y auditoría; este control evita que la persistencia extienda la vigencia antes de esa integración.

## Transacción de reprogramación aislada — 26/11/2026, 05 h

Se agregó supabase/propuestas/edicion-confirmar.sql: función privada SECURITY INVOKER sin concesiones PUBLIC y tabla privada de auditoría cambios. Verifica único remitente, permiso agenda.editar, versión, evento de texto con CONFIRMAR CAMBIO exacto, revisión/código/dueño/vencimiento de sesión, base original de la orden, futuro, duración conservada y superposición. Cambia únicamente fecha/hora, registra antes/después y consume la sesión dentro de la misma transacción. Un reintento de código ya auditado devuelve editada/repetido sin volver a modificar. Retiene locks de acceso/perfil y usa el advisory lock laso_turno existente; no coordina con escritores del CRM que no usen ese lock.

Seis escenarios SQL nuevos (siete resultados con grupo), suite completa 295/295: éxito y reintento; error CHECK en auditoría que revierte orden y consumo; texto alterado/revocación; base cambiada/ocupación; vencimiento/código sustituido; duración adulterada. Los clientes/órdenes sintéticos solo existen en PGlite local. El fallo artificial de auditoría se elimina y el reintento posterior pasa. No se valida concurrencia multiconexión ni todo el esquema/triggers/RLS productivos.

Se consultaron únicamente metadatos reales de columnas de ordenes: UUID en id/cliente/dirección, bigint en número, fecha y horas nativas; no se leyeron fichas de clientes. Supabase v23 ACTIVE y GitHub bb08414cee3238aa5c6c640c7a27cb548252adeb al iniciar. No se desplegó ni se otorgaron permisos productivos. No hay mensajes, secretos o datos reales alterados.

Pendientes antes de producción: integración del adaptador y lectura completa de disponibilidad; validación semántica del mensaje al preparar; seguridad y grants mínimos contra esquema completo; coordinación con escrituras CRM, ensayo de concurrencia y plan de migración/rollback. La tabla cambios es auditoría del prototipo, no sustituye aún el historial real del CRM. No se midió latencia o ahorro operativo. Próximo hito: recorrido texto → propuesta persistida → corrección → confirmación → orden/auditoría mediante adaptador, todo sobre base aislada. Revertir el commit solo retira SQL propuesto y pruebas; no hay rollback productivo necesario.

### Integración de conversación y persistencia JSONB (26/11/2026)

Se reprodujo y corrigió un rechazo incorrecto al recuperar la sesión desde PostgreSQL: JSONB reordena las claves y la comparación por `JSON.stringify` confundía ese orden con un cambio de datos. La base original y la propuesta ahora comparan campos y valores, manteniendo el rechazo de campos ausentes, adicionales o modificados.

La nueva prueba `tests/sql-aislado/edicion-integral.test.mjs` conecta los módulos reales de conversación, guardado autorizado de sesión y confirmación SQL sobre PGlite. Comprueba propuesta → persistencia → corrección → persistencia → rechazo del código anterior → confirmación actual → una edición y una auditoría → reintento sin duplicados. Antes de confirmar, el horario original permanece intacto. El fallo se observó antes de corregir y el flujo completo pasó después.

Validación: 298 pruebas pasadas, cero fallos, con `node --test tests/*.test.cjs tests/*.test.mjs tests/sql-aislado/*.test.mjs`. No se probó concurrencia multiconexión, WhatsApp real, audio ni Safari. Este ensayo usa un esquema mínimo aislado y no acredita RLS/permisos completos de producción. El adaptador HTTP, la coordinación con escritores del CRM y el despliegue de edición siguen pendientes. Supabase mantiene whatsapp-interno v23 ACTIVE; no se aplicaron migraciones ni se modificaron datos reales.
