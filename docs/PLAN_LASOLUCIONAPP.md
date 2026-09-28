# LaSoluciónApp — Informe de continuidad para Codex

Fecha: 28/09/2026. Responsable del producto: Luis Banega, Córdoba, Argentina.

## Alcance y confiabilidad

Este documento reúne los requisitos disponibles en la conversación para continuar la aplicación existente. Es una especificación de trabajo inicial, no una auditoría del repositorio. No se inspeccionó el código ni la base de datos al redactarlo. Los antecedentes técnicos deben contrastarse con los archivos actuales. No marcar ninguna función como terminada basándose únicamente en este informe.

## Objetivo

Entregar una aplicación de gestión de servicios de La Solución que Luis pueda usar diariamente desde el celular: clientes, direcciones, órdenes, técnicos, agenda, presupuestos, documentos y seguimiento. Mantener la identidad visual del dashboard original. Incorporar WhatsApp como canal de atención y de carga de tareas por voz, con separación efectiva entre atención al cliente y administración interna.

La primera entrega operativa debe permitir iniciar sesión, crear un cliente y una orden, agendarla, recargar o volver a entrar, encontrar los datos guardados y actualizar el estado desde el teléfono.

## Requisitos expresados por Luis

- Continuar el proyecto existente y aprovechar el trabajo realizado.
- Respetar la gráfica del dashboard original; localizar esa referencia antes de modificar el diseño.
- Priorizar la facilidad de uso desde el celular, especialmente iPhone.
- Usar datos reales en Nueva Orden, agenda y dashboard.
- Completar presupuestos y generación de PDF.
- Publicar la aplicación online; existe interés en un dominio .com.
- Integrar el menú o catálogo de WhatsApp con el sistema sin dar a los clientes acceso al CRM.
- Integrar comandos de voz mediante WhatsApp para incluir tareas en agenda.
- Los pedidos de turnos de clientes deben quedar pendientes de validación personal, sin convertirse automáticamente en reservas confirmadas.

Una petición anterior contemplaba una web de clientes con la misma identidad del CRM. La petición más reciente prioriza que la atención del cliente sea solamente por catálogo/WhatsApp y que no vea la página interna. Implementar esa separación; dejar cualquier portal público adicional como decisión pendiente, sin borrar automáticamente lo ya desarrollado.

## Antecedentes técnicos por verificar

Se ha trabajado con HTML, CSS y JavaScript, VS Code y WSL Ubuntu. Se utilizó un servidor local Python para servir la aplicación. No imponer un cambio de framework sin una necesidad concreta y explicada.

Módulos mencionados: index, dashboard, agenda, órdenes, clientes, técnicos, estadísticas, configuración, mensajes y usuarios. Sus nombres no prueban que estén completos.

Roles históricos: Administrador, Colaborador, Técnico, Cliente y Cliente pendiente. Revisar su implementación y definir una matriz de permisos conforme al comportamiento existente. Como propuesta conservadora: administración gestiona el conjunto; técnico ve únicamente lo autorizado y asignado; cliente no accede al CRM. El alcance del colaborador queda por confirmar si no está documentado.

Tablas Supabase mencionadas: perfiles, clientes, direcciones_clientes, tecnicos, categorias_trabajo, ordenes, historial_ordenes, evidencias, gastos, presupuestos, presupuesto_items, pagos y notificaciones. Buckets mencionados: evidencias-ordenes, comprobantes-gastos y documentos-clientes. Verificar nombres, columnas, relaciones y políticas actuales antes de escribir consultas o migraciones.

Antecedentes de problemas: sesión de Supabase no activa en agenda; coexistencia de usuarios locales y Supabase Auth; proyecto Supabase pausado o unhealthy. Son incidencias históricas, no diagnósticos actuales. No utilizar un acceso local de demostración como autenticación de producción.

URL histórica aportada por Luis: https://banegaluis.github.io/lasolucion-web/?v=300d7ecc#inicio . Es una pista para localizar el proyecto, no una confirmación de que ese despliegue o su repositorio contengan la última versión.

## Primera fase: inspeccionar y establecer una base

1. Leer las instrucciones existentes del repositorio. Identificar rama, cambios sin guardar, estructura, scripts y despliegue.
2. Encontrar la versión actual y la referencia visual del dashboard original. Si hay varias copias incompatibles, presentar las diferencias relevantes antes de elegir.
3. Ejecutar el proyecto con su procedimiento real. Registrar qué funciona, qué falla y qué muestra datos ficticios.
4. Revisar configuración y disponibilidad de Supabase, autenticación y permisos usando accesos autorizados. No imprimir claves ni credenciales.
5. Crear un plan por hitos con criterios de aceptación y registrar hallazgos comprobados.
6. Continuar con el primer hito viable. No detener todo el trabajo por una decisión secundaria o integración todavía inaccesible.

## Circuitos funcionales y aceptación

### Sesión y permisos

Inicio y cierre de sesión centralizados. Manejar sesión expirada con un mensaje claro y preservar cuando sea posible lo escrito en formularios. Proteger datos también en backend: ocultar menús no constituye control de acceso. Comprobar que una cuenta sin autorización no puede consultar ni modificar órdenes ajenas mediante solicitudes directas.

### Clientes y direcciones

Buscar clientes antes de crear uno nuevo. Gestionar nombre, teléfono y dirección con los campos reales del sistema. Permitir varias direcciones si lo soporta el esquema. Reducir duplicados sin fusionar registros de forma destructiva. Validar información requerida y mostrar errores comprensibles.

### Nueva Orden

Usar el esquema existente para cliente, dirección, rubro, descripción, fecha/hora, técnico y estado. Determinar qué campos son obligatorios según el flujo real. Evitar doble guardado por toques repetidos. Mostrar éxito solo cuando la operación persistió. Ante errores conservar el formulario y permitir reintentar sin crear duplicados.

Aceptación: crear una orden, recargar, cerrar y volver a abrir sesión, verificar cliente y dirección asociados; editar y comprobar persistencia. Esa misma orden debe aparecer coherentemente en agenda y dashboard.

### Agenda

Mostrar órdenes o tareas reales; distinguir solicitudes pendientes de trabajos confirmados. Permitir consultar detalle y reprogramar conforme a los permisos. Usar America/Argentina/Cordoba para la interpretación de fechas. Detectar conflictos al confirmar o mover turnos según la disponibilidad del técnico. No asumir que dos trabajos pueden superponerse si la duración todavía no está definida.

Aceptación: crear, reprogramar y cambiar estado; comprobar concordancia con el detalle de la orden y persistencia tras recargar. Una solicitud del cliente no ocupa un turno confirmado antes de la validación del responsable.

### Dashboard

Conservar el diseño original. Conectar tarjetas, contadores y listados con las mismas fuentes reales que órdenes y agenda. Especificar filtros de fecha y estados para que cada cifra sea reproducible. Distinguir carga, error y ausencia de datos. Eliminar indicadores ficticios del entorno de producción.

### Presupuestos y PDF

Completar cliente, trabajo, ítems, cantidades, precios y totales; contemplar mano de obra, materiales y condiciones comerciales según el sistema existente. Descuentos, anticipos e impuestos deben ser explícitos y configurables: no aplicar automáticamente condiciones históricas de un trabajo a todos los clientes.

Generar PDF legible y consistente con lo guardado, con identidad de La Solución, fechas y totales. Revisar saltos de página, descripciones largas y apertura/descarga desde iPhone. No inventar logo, matrícula, firma ni datos fiscales faltantes.

### Técnicos y seguimiento

Mantener asignación y estados coherentes. Integrar historial, evidencias, gastos y pagos según la funcionalidad actual, sin ampliar estos módulos con reglas comerciales inventadas. Proponer primero el alcance mínimo que permite seguir un trabajo desde su alta hasta su finalización.

## WhatsApp y voz

### Atención a clientes

Diseñar un menú o catálogo de servicios con la identidad de La Solución y captura simple de solicitudes. El cliente no debe recibir enlaces administrativos ni acceso a información interna. Registrar cada solicitud como pendiente; Luis la revisa y confirma o propone otro horario. Verificar las posibilidades y restricciones actuales de la integración elegida antes de prometer un catálogo sincronizado.

### Comandos internos de voz

Caso objetivo: Luis envía un audio del tipo «Agendá mañana a las diez revisar el calefón de un cliente». El sistema identifica al emisor autorizado, transcribe, extrae la intención y los campos y resuelve el cliente/dirección. Si faltan datos o hay ambigüedad, pide aclaración. Como propuesta inicial, devuelve un resumen con fecha absoluta para confirmar antes de guardar.

Separar los audios de clientes de los comandos internos: un cliente nunca debe poder ejecutar funciones administrativas. Resolver fechas relativas con la zona de Córdoba. Tratar reintentos de webhooks sin duplicar tareas. Guardar referencia del mensaje y resultado para poder explicar qué se creó. No afirmar integración completa usando solamente una simulación.

### Dependencias a resolver

Acceso autorizado a Meta/WhatsApp Business, modalidad de integración, número utilizado, endpoint servidor, almacenamiento de secretos y proveedor de transcripción. Verificar compatibilidad con el uso actual del número antes de migrarlo. Cotizar por separado los costos recurrentes de servicios externos si los hay. El plan de ChatGPT no determina por sí solo esos costos.

## Publicación y operación

Identificar el alojamiento existente. Una interfaz estática y un receptor de webhooks pueden requerir componentes distintos; decidir sobre el entorno real. Mantener secretos del servidor fuera del código público. Preparar configuración documentada sin valores privados, migraciones revisables, procedimiento de publicación y recuperación. No comprar dominio ni contratar servicios pagos sin una decisión explícita del titular.

Verificar la URL publicada y los circuitos clave con cuentas de prueba autorizadas. Entregar URL de acceso interno, instrucciones breves de uso y limitaciones pendientes. No informar «publicado» hasta comprobar el despliegue real.

## Secuencia propuesta

| Hito | Resultado verificable |
| --- | --- |
| 0 | Código localizado, app ejecutable, referencia visual y diagnóstico comprobado |
| 1 | Sesión, cliente y nueva orden persistidos correctamente |
| 2 | Agenda y dashboard coherentes con las órdenes reales |
| 3 | Presupuesto guardado y PDF correcto desde el teléfono |
| 4 | Primera versión operativa publicada y validada |
| 5 | Solicitudes de WhatsApp pendientes de aprobación |
| 6 | Audio interno convertido en tarea sin duplicados ni ambigüedades silenciosas |

Preparar interfaces para WhatsApp durante el trabajo inicial cuando convenga, pero no retrasar la primera versión útil por esa integración.

## Reglas de ejecución para Codex

- Trabajar por resultados completos y revisables. Resolver decisiones técnicas rutinarias sin pedir al usuario que programe.
- Mantener diseño, convenciones y funcionalidades útiles del proyecto. Evitar reescrituras generales sin evidencia de necesidad.
- No afirmar que algo está probado cuando solo fue escrito; distinguir validado, pendiente de validar y bloqueado.
- Hacer pruebas de los riesgos reales: persistencia, permisos, duplicados, fechas, cálculos y regresiones del circuito principal.
- Probar visualmente en ancho móvil; indicar si no fue posible comprobar el iPhone real.
- Mantener un registro breve de cambios, decisiones, pruebas y siguiente paso. Al interrumpirse por límites o acceso, dejar un punto de continuidad preciso.
- Preparar cambios de base de datos revisables; evitar borrar datos para resolver errores.
- No enviar mensajes reales a clientes como parte de pruebas sin autorización específica.
- Formular preguntas únicamente cuando una respuesta afecte de verdad el comportamiento o cuando falten accesos indispensables. Seguir con las partes independientes.

## Incorporación al repositorio

Este archivo todavía no está incorporado al repositorio. Al disponer de la versión actual, guardarlo como documentación del proyecto y vincularlo desde las instrucciones existentes para Codex, sin reemplazarlas a ciegas. Añadir al registro de avance los hallazgos reales de la auditoría, con fecha y evidencia.

## Instrucción de inicio

Leé este informe y las instrucciones del repositorio. Auditá la aplicación existente y localizá la referencia visual del dashboard. Convertí los requisitos en un plan verificable y comenzá a implementar el primer circuito completo: sesión, cliente, Nueva Orden, persistencia en Supabase, agenda y dashboard. Conservá el diseño original. Continuá con los hitos viables, probá los cambios y registrá resultados y bloqueos reales. Si falta un acceso, indicá exactamente cuál y seguí con el trabajo independiente. No des por finalizada una función hasta verificar sus criterios de aceptación.
