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
