# Funcionalidades y estado

## Usuarios internos online — 02/10/2026

- Usuarios lista y crea cuentas reales mediante una función de servidor. Permite
  administrador, colaborador y técnico; clientes sin login por decisión de Luis.
- Alta de técnico con vínculo automático; sesión con técnico real y órdenes bajo RLS.
- Edición online de perfil, rol y estado; email inmutable y recuperación de clave
  mediante el login. Se elimina la prueba de acceso por suplantación local del módulo conectado.
- Aplicadas protección contra autoascenso de rol y restricción de vínculos técnicos;
  un técnico desactivado pierde el acceso a sus órdenes aunque conserve el token.
- Verificación automatizada y pruebas SQL revertidas. Falta el recorrido con sesión
  real en iPhone. Detalles y límites: `docs/USUARIOS_INTERNOS.md` en la raíz del repositorio.

Actualizado: 28/09/2026. Base de esta etapa: `5d49df9`.

## Circuito operativo

- Configuración de Supabase restaurada con clave publicable. Los datos siguen sujetos a Auth y RLS.
- Login con email para la versión conectada; las cuentas locales de demostración no habilitan trabajo online. Se conserva la compatibilidad local si no existe configuración.
- Nueva Orden utiliza los servicios existentes de clientes y órdenes.
- Dashboard consulta órdenes remotas y comparte su transformación con el listado. No usa datos locales como alternativa ante errores. Incluye carga, error y reintento.
- Métricas: separa canceladas de terminadas; solo órdenes activas sin técnico requieren asignación; una orden sin fecha no se considera atrasada.
- Resumen administrativo consulta perfiles pendientes y técnicos activos en Supabase; muestra dato no disponible si falla la consulta.
- Reprogramación revisa cruces excluyendo la propia orden y las asignadas a otro técnico. Conserva la confirmación explícita de superposición existente.
- Búsqueda de clientes corregida: un texto sin dígitos ya no coincide con todos los teléfonos.
- SDK de Supabase fijado en 2.117.2; se permite reintentar una descarga fallida.

## Validación realizada

- `node --test tests/circuito-operativo.test.cjs`: 7 pruebas automatizadas.
- Sintaxis JavaScript y revisión de cambios.
- Consulta real de permisos: el rol anónimo no puede leer órdenes; el rol administrador puede leer las 6 órdenes existentes.
- Prueba transaccional de alta de cliente, dirección, orden, cambio de estado e historial bajo el rol autenticado del administrador. Rollback completo; no se agregaron trabajos de prueba permanentes. Esto valida la base, no el login ni el circuito de navegador.

## Pendiente para cerrar el hito

- Iniciar sesión real desde el teléfono y verificar Nueva Orden → agenda → dashboard → recarga.
- Revisión visual móvil/escritorio. El navegador de pruebas no pudo instalarse en este entorno (descarga inválida).
- Recuperar referencias `dashboard1.png`, `dashboard_metricas..png` y menú citadas por AGENTS: faltan en este repositorio. Se revisó `dash_ejecutivo2_menuplegado.png` y se conservaron los estilos existentes.
- Alta de cliente + dirección aún se hace en dos operaciones; falta atomicidad e idempotencia frente a fallos de red.
- Completar autorización y sincronización de módulos de usuarios/técnicos que todavía contienen comportamiento local.
- Revisar políticas de edición de perfil antes de habilitar otros roles: actualmente permiten actualizar el perfil propio, incluido el rol, si existe ese perfil. Hoy solo se verificó un administrador.
- Presupuestos/PDF, WhatsApp y voz siguen pendientes; no se simulan como integrados.

## Cierre de guardado confirmado — 28/09/2026

- Crear y editar comparten el cierre del formulario después de una escritura confirmada. Se eliminaron las consultas de detalle redundantes previas a recargar el listado.
- Una falla posterior de lectura no se presenta como error de escritura: se confirma el guardado y se indica recargar el listado sin volver a crear la orden.
- El botón queda bloqueado durante el cierre; siempre se libera al terminar. El listado también libera su bloqueo ante excepciones y permite reintentar.
- Si falla la escritura, se conservan los campos para corregir o reintentar y no se informa éxito.
- Validación: `node --test tests/*.test.cjs`, 13 pruebas aprobadas (7 existentes + 6 de regresión). Servicios simulados, sin escrituras en producción. Sintaxis y diff verificados.
- Límite: esto no implementa idempotencia de servidor ni atomicidad cliente/dirección/orden; una respuesta de escritura perdida sigue requiriendo conciliación. Pendientes la sesión real en móvil y la publicación aprobada.

## Reintento de alta en la misma pestaña — 28/09/2026

- Antes de insertar una orden, se conserva en `sessionStorage` un UUID v4 y el payload original, separados por proyecto y usuario de Auth. No se guardan claves ni tokens. La clave primaria existente impide insertar dos filas con ese UUID.
- Si se pierde la respuesta, el siguiente Guardar ofrece recuperar el envío original antes de validar el formulario o volver a resolver/crear el cliente. Funciona también después de recargar la misma pestaña.
- Primero consulta por UUID y creador; si ya existe, devuelve esa orden. Si no existe, inserta el mismo UUID y payload. Ante conflicto de unicidad, consulta de nuevo; no hace upsert ni modifica una orden existente.
- Un envío incierto no admite otros datos hasta resolverlo. La recuperación pide confirmación con trabajo, fecha y hora; los cambios posteriores del formulario no se envían. Rechazar conserva los campos sin crear nada.
- Se elimina el registro al confirmar el guardado. Contiene temporalmente datos de contacto/domicilio del envío en esa pestaña. Si el almacenamiento falla o está corrupto, se bloquea un nuevo envío sin descartar el registro previo.
- Auth y RLS siguen vigentes; el creador se toma de la sesión. Se comprobó con consultas de metadatos que `ordenes.id` es UUID con clave primaria y que sus triggers no reemplazan ese ID. No se cambió el esquema ni se escribieron datos de producción.
- Validación: 27 pruebas automatizadas aprobadas. Nuevos casos: respuesta perdida, recarga, corte antes de llegada, conflicto concurrente, datos cambiados, cuentas distintas, sesión ausente, almacenamiento bloqueado/corrupto, rechazo SQL, lectura fallida, identidad suministrada por llamador y recuperación desde formulario vacío.
- Alcance: protección por envío en la misma pestaña mientras se conserve `sessionStorage`. No deduplica cargas independientes en otros dispositivos/pestañas; cerrar la pestaña o borrar sus datos puede perder la recuperación. No resuelve atomicidad ni respuesta perdida durante el alta previa de cliente/dirección. Sigue pendiente la prueba real con sesión en iPhone y la publicación aprobada.

## Alta recuperable de cliente y dirección inicial — 28/09/2026

- El servicio compartido por Clientes y Nueva Orden conserva UUID separados para cliente y dirección inicial antes de escribir. Un reintento consulta los registros existentes y completa solo lo faltante con los mismos identificadores, sin upsert ni cambios en otras direcciones.
- El registro pendiente se separa por proyecto/cuenta en sessionStorage y contiene temporalmente los datos originales; se elimina después de leer el cliente con su dirección confirmada. Una falla de lectura final conserva la recuperación.
- La detección de duplicados sigue activa para altas nuevas; no confunde el cliente creado parcialmente por ese mismo envío con un duplicado ajeno. Hay bloqueo de altas concurrentes dentro del módulo.
- Si cambiaron los datos, Clientes y Nueva Orden ofrecen recuperar el alta anterior mediante confirmación. En Nueva Orden, la recuperación de otros datos selecciona el cliente original y detiene el guardado para que se revise antes de continuar.
- Validación: 40 pruebas automatizadas aprobadas. Trece nuevas cubren cortes antes/después de ambas inserciones y lectura final, recuperación tras recarga del servicio, cambios de datos, permisos, almacenamiento, sesión/cuenta, concurrencia y duplicados nuevos. Consultas reales de metadatos confirmaron UUID/PK y políticas; ninguna escritura en producción.
- Límites: sigue siendo una secuencia de dos escrituras, no una transacción atómica. Un cliente puede quedar temporalmente sin dirección hasta recuperar el envío. Se necesita conservar los datos de la pestaña. Tras recargar, se reingresan datos válidos para llegar a Guardar; no hay restauración automática del formulario vacío. Edición de clientes y agregado de direcciones adicionales no están cubiertos por esta recuperación. Pendientes prueba real en iPhone y publicación.

## Recuperación de contraseña — 28/09/2026

- El login conectado incorpora “¿Olvidaste tu contraseña?” y abre una ventana propia para ingresar el email y enviar el enlace, sin depender del campo de usuario del login.
- El envío usa Supabase Auth `resetPasswordForEmail` con retorno a `crm/recuperar-clave.html`; el mensaje no revela si el email existe.
- La pantalla de recuperación valida la sesión creada por el enlace, exige confirmación de la nueva clave y actualiza la contraseña con `updateUser`.
- Después del cambio se cierra la sesión de recuperación y se vuelve al login con confirmación visible.
- Se reutilizan los estilos y servicios de Auth existentes; no se guarda ninguna contraseña en localStorage ni en el repositorio.
- Para producción, la URL `https://banegaluis.github.io/lasolucion-web/crm/recuperar-clave.html` debe estar admitida en la configuración de Redirect URLs de Supabase Auth; si el proveedor ignora un redirect no autorizado, hay que agregar esa URL en Auth > URL Configuration.

## Agenda compartida: refresco y permisos — 28/09/2026

- Refresco de datos cada 30 segundos con la agenda visible y conexión, al volver a la pestaña y al recuperar internet. Se consulta nuevamente Supabase con la sesión actual; no se comparten datos locales entre equipos.
- Antes del refresco se vuelve a verificar el perfil operativo. Si se revoca el acceso, se vacían los eventos. Un error de carga elimina datos anteriores de memoria. Las respuestas atrasadas no reemplazan el estado más reciente.
- 43 pruebas automatizadas aprobadas, incluidas tres sobre refresco, pestaña oculta/sin conexión y acceso revocado.
- Se verificó que la política de UPDATE de perfiles permite modificar rol/estado/activo propios. Se preparó `docs/sql/proteger_perfiles.sql` y se probó en transacción revertida: nombre editable, rol/estado/activo rechazados para un no administrador.
- La revisión automática de aprobación rechazó aplicar esa corrección en producción porque requiere autorización específica de cambios de permisos. NO está aplicada. No se habilitó el login de técnicos ni se crearon usuarios nuevos. Los roles operativos actuales siguen admin/colaborador.
- Pendientes: autorización para aplicar la corrección, pruebas reales con cuentas por rol y equipos separados, habilitación controlada de técnicos, actualización de roles locales y protección frente a dos ediciones simultáneas. No presentar esta entrega como multiusuario completamente terminado.

## Agenda: conservar el horario consultado — 29/09/2026

- Las actualizaciones automáticas y los filtros del mismo período conservan el desplazamiento horario del usuario. El enfoque inicial se realiza una sola vez por vista/período, y vuelve a habilitarse al cambiar de día, semana o tipo de vista.
- Un desplazamiento pendiente se descarta si llegó una consulta posterior, para evitar saltos por respuestas atrasadas.
- Validación automatizada: refrescos repetidos, cambio de período/vista, respuesta superada antes del render y recuperación después de una consulta fallida. No se modificaron permisos ni datos de producción. Pendiente comprobación en iPhone con sesión real.


## Recuperación de contraseña: destino público — 30/09/2026

- Las solicitudes iniciadas desde `localhost`, `127.0.0.1`, IPv6 local o un archivo de la computadora usan como retorno la pantalla pública `https://banegaluis.github.io/lasolucion-web/crm/recuperar-clave.html`.
- En la web publicada y en un futuro dominio propio se conserva el mismo origen válido, eliminando parámetros y fragmentos anteriores.
- El mensaje de confirmación aclara que el enlace recibido debe abrir la web de La Solución.
- Esto prepara el destino correcto, pero Supabase Auth todavía debe admitir la URL pública en **Redirect URLs**. Si no está admitida, Supabase puede reemplazarla por su **Site URL**, que anteriormente apuntaba a localhost.
- No se modificaron usuarios, contraseñas ni configuración de producción. Pendiente: comprobar un email real desde el iPhone y confirmar el cambio de clave completo.

## Agenda: borrador de orden por voz — 01/10/2026

- La agenda incorpora “Dictar” para capturar o escribir tarea, cliente, fecha y hora. Reconoce expresiones como hoy, mañana, pasado mañana, días de la semana, fechas numéricas y horas; los cuatro datos se muestran para revisión.
- Los datos faltantes se solicitan en el mismo cuadro. Si el navegador no ofrece reconocimiento de voz, se puede usar el micrófono del teclado o escribir sin perder el flujo.
- Confirmar solo abre Nueva Orden y completa el borrador; no guarda automáticamente. El usuario debe seleccionar/verificar el cliente sugerido y usar “Guardar orden”.
- El acceso reutiliza el permiso de creación de órdenes. Antes de abrir el formulario se bloquea una coincidencia exacta de cliente, tarea, fecha y hora con las órdenes cargadas.
- Validación automatizada del intérprete y del conjunto existente. Pendientes: prueba de dictado real en iPhone, variaciones de lenguaje y duplicados existentes con sesión real. No existe todavía integración con audios de WhatsApp ni procesamiento en servidor.


## Agenda: completar el dictado natural — 03/10/2026

- Corregida la frase reportada desde iPhone: “mañana domingo 10 de la mañana hay que ir al local del Guille en Duarte esguiro 3226”. Se extraen cliente, fecha y hora; la tarea conserva la visita y el domicilio transcrito para revisión, sin corregir ni asociar automáticamente una dirección.
- Se aceptan horas con “de la mañana/tarde/noche”; “de la mañana” por sí solo no asigna la fecha de mañana. Las alturas de domicilios no se interpretan como horarios.
- El texto escrito, pegado o dictado con el teclado se interpreta al recibir input, además de change. Se mantiene la revisión previa y el guardado explícito de Nueva Orden.
- Pruebas Node del intérprete aprobadas. Pendiente repetir el recorrido publicado desde iPhone y comprobar cliente seleccionado y guardado real.

## Presupuestos (07/10/2026)

- Formulario para roles con `presupuestos.editar`: cliente, dirección opcional, rubro, alcance, fecha, conceptos, cantidades, precios y condiciones.
- Total automático y vista previa con marca La Solución; impresión / Guardar como PDF mediante el navegador.
- Borrador manual por usuario en este navegador, sin guardado en Supabase ni historial compartido.
- Ejemplo de Arre Taquería por $80.000 disponible para cargar.
- Pendiente: validar impresión/compartir en iPhone real y conectar presupuestos e ítems a Supabase.

## Caja y movimientos

- Carga con dictado del teclado → interpretación conservadora → edición → confirmación.
- Cobros, gastos, saldos pendientes y cobros parciales, retiros/aportes personales y transferencias.
- Relaciones explícitas con cliente y orden; resumen por período sin presentar flujo como ganancia.
- Solo administrador activo; Tabla nueva y RLS aplicados el 17/10/2026. Guardado, cobro parcial, bloqueo de sobrecobro y restricciones de acceso comprobados mediante transacción revertida.
- Sin WhatsApp conectado, conciliación histórica ni prueba real en Safari todavía. Ver [Caja](caja.md).

## Configuración: accesos del bot

- Panel exclusivo de administrador con número, persona/rol del CRM, estado y permisos granulares.
- Confirmación de cambios, revocación, protección frente a edición concurrente e historial automático.
- Vista de actividad filtrada; sin actividad ficticia. La conexión WhatsApp sigue pendiente.
- Base con RLS aplicada; pruebas de permisos e historial aprobadas. Ver [Accesos del bot](bot-accesos.md).

### Laso — corrección de horarios en desarrollo (9/11/2026)
El intérprete de borradores rechaza horarios numéricos inválidos y exige aclaración cuando encuentra horarios distintos. Evita convertir «10:75» en «10:00». Solo en rama de desarrollo; sin webhook, escrituras ni envíos. Ver `laso-secretario-roadmap.md`.

### Laso — franjas horarias en desarrollo (10/11/2026)
El intérprete convierte «3 de la tarde» a 15:00 y evita tomar «de la mañana» como el día siguiente. Pide aclaración en franjas ambiguas o contradictorias. Incluye 15 pruebas nuevas; continúa sin integración al webhook, sin ejecución ni envíos. Detalle y límites en `laso-secretario-roadmap.md`.

### Laso — preparación de revisión interna (11/11/2026)
Nuevo módulo puro que agrupa preguntas por datos faltantes y prepara un resumen de agenda/recordatorios. No acepta confirmaciones, no guarda ni envía mensajes. Incluye 8 pruebas nuevas; queda pendiente el circuito con estado y aprobación vinculada al borrador. Detalle en `laso-secretario-roadmap.md`.

### Laso — sesión versionada de simulación (12/11/2026)
El nuevo módulo de sesión invalida la confirmación simulada ante correcciones y rechaza referencias a versiones viejas u otros borradores. Incluye 9 pruebas nuevas; no autentica, persiste, guarda turnos ni envía mensajes. Confirmación real e integración siguen pendientes. Ver `laso-secretario-roadmap.md`.

### Laso — cancelación interna en simulación (13/11/2026)
Se puede cancelar un borrador con su identificador y versión vigentes. La cancelación revoca la confirmación simulada e impide nuevas correcciones o confirmaciones; repetirla no cambia el resultado. Cinco pruebas nuevas. Sin integración, persistencia ni efectos externos; vencimiento pendiente. Ver `laso-secretario-roadmap.md`.

### Laso — vencimiento de borradores en simulación (14/11/2026)
La sesión verifica un plazo configurable al consultar o actuar: vencida, revoca confirmación y bloquea cambios. Corregir no renueva el plazo. Incluye 6 pruebas nuevas; 15 minutos es el valor provisional de simulación. No implica integración, despliegue ni guardado real. Ver `laso-secretario-roadmap.md`.

### Laso — control de acceso aislado (15/11/2026)
Nuevo adaptador que revalida permisos en cada operación sobre la sesión y bloquea otros remitentes, revocación, reasignación o cambio de versión, sin devolver el borrador denegado. Seis pruebas nuevas con autorizador simulado. No es autenticación desplegada ni integración con servicios reales. Ver `laso-secretario-roadmap.md`.

### Laso — filtro de entrada coherente (16/11/2026)
Se corrige el descarte de «Agendame» y «Programame» (con o sin tilde), reutilizando la regla del intérprete. Siete pruebas nuevas incluyen recorrido local con firma, destino, permisos y borrador. No implica recepción real de WhatsApp ni despliegue; duplicados persistentes siguen pendientes. Ver `laso-secretario-roadmap.md`.

### Laso — deduplicación dentro del lote (17/11/2026)
Se omiten eventos repetidos después de su primera inserción resuelta en el mismo lote. Prueba sintética: 50 copias producen 1 consulta de permiso y 1 intento de guardado, 98 % menos llamadas. Cinco pruebas nuevas. La unicidad entre solicitudes continúa dependiendo de la base y no se verificó en producción. Ver `laso-secretario-roadmap.md`.

### Laso — regresión HTTP sin servicios reales (18/11/2026)
Se agregan seis escenarios de prueba del manejador existente con almacenamiento simulado: apagado, firma inválida, permiso denegado, reintentos concurrentes, fallo temporal y revocación. No cambia el comportamiento funcional ni demuestra unicidad en PostgreSQL real. Ver `laso-secretario-roadmap.md`.

## Laso: aclaración de fechas múltiples — 19/11/2026
- El intérprete aislado pide una única fecha cuando reconoce varias menciones en un pedido; no elige automáticamente la primera. Mantiene rechazo de fechas imposibles y distingue «de la mañana» de una fecha relativa.
- 180/180 pruebas locales aprobadas, 7 nuevas. No habilita guardado, envíos ni conexión con WhatsApp; sin cambios de dashboard. Alcance y límites en `laso-secretario-roadmap.md`.

## Laso: recorrido de aclaración con permisos — 20/11/2026
- Cuatro regresiones integradas cubren fechas ambiguas, corrección, confirmación versionada, revocación y vencimiento a través del adaptador de acceso aislado.
- Suite local: 184/184 aprobadas. Solo pruebas y documentación; sin nuevos comportamientos operativos, persistencia, conexión Meta o cambios visuales.

## Laso: completar hora pendiente — 21/11/2026
- Sesión y adaptador aislados admiten `completarHora` con respuesta estricta HH:MM de 24 horas. Conserva el pedido, incrementa versión y exige confirmación; no renueva el vencimiento.
- 191/191 pruebas locales aprobadas, 7 nuevas. En el ejemplo de prueba, respuesta de 5 caracteres frente a reenviar 53 (48 menos). No está conectado al webhook ni al CRM; sin medición de tiempo real.

## Laso: completar fecha pendiente — 22/11/2026
- `completarFecha` acepta una fecha válida DD/MM/AAAA en el circuito aislado, conserva los demás datos y exige confirmar la versión nueva. Comparte protecciones con `completarHora`.
- 199/199 pruebas locales aprobadas, 8 nuevas. Ejemplo: respuesta de 10 caracteres frente a reenviar 53. Sin conexión WhatsApp, guardado CRM ni cambios visuales.

## Laso: aislamiento de clientes — 23/11/2026
- Prioridad explícita de Luis: secretario exclusivamente interno; no responder ni enviar recordatorios, presupuestos o mensajes automáticos a clientes. La atención automática/catálogo no forma parte de la activación de Laso.
- Tres regresiones HTTP nuevas verifican clientes con comandos, suplantación textual y audio; lotes mixtos; saludos y consultas comerciales. 202/202 pruebas locales aprobadas. Sin nuevas funciones de envío ni cambios de producción.

## Laso: conflictos de guardado y reintentos — 24/11/2026
- El receptor ignora duplicados solo por `evento_id`, conserva el borrador previo y deja de tratar cualquier error de unicidad como éxito. Otros conflictos devuelven 503 sin detalles privados.
- 204/204 pruebas locales aprobadas (2 nuevas); mismo número de llamadas por intento. Contrato PostgREST verificado con un doble, pendiente de base aislada real. Sin activación, envíos a clientes, cambios visuales ni datos reales. Ver `laso-secretario-roadmap.md`.

## Laso: validación compartida de identidad — 25/11/2026
- Receptor y adaptador de revisión rechazan identificadores vacíos/de tipo incorrecto y versiones fuera del entero positivo admitido por el almacenamiento. Validación reutilizada, sin nuevas llamadas de red.
- 208/208 pruebas locales aprobadas (4 nuevas); matriz de 17 autorizaciones inválidas sin intentos de inserción. Sin cambios de CRM, dashboard ni configuración desplegada. Alcance y pendientes en `laso-secretario-roadmap.md`.

## Laso desplegado: corrección de horarios — 25/11/2026
La propuesta basada en v19 evita conservar fin/duración antiguos al corregir datos inválidos y exige aclaración ante fin y duración simultáneos. Seis regresiones nuevas; 214 pruebas locales pasan. Fuente desplegable y rollback separados del receptor histórico del PR; ver `laso-v20.md`.

## Laso: frontera privada en recepción — 25/11/2026, 11 h
El receptor desplegable descarta cualquier remitente distinto del operador personal antes de consultar autorización o insertar borradores, incluso si otro número recibiera permiso accidentalmente. Cinco pruebas nuevas: 219/219 aprobadas. Se conserva la corrección de fechas encontrada en v21. Ver `laso-frontera-privada.md`.

## Laso: confirmar con texto exacto — 25/11/2026, 14 h
Altas y turnos comprueban el texto escrito y su código antes de llamar a la confirmación SQL. Mensajes alterados reciben la instrucción exacta; audio no confirma. 225/225 pruebas locales aprobadas, seis nuevas. Ver `laso-confirmacion-exacta.md`.

## Laso: ensayo SQL aislado de alta y rollback — 25/11/2026, 15 h
Se agregó un arnés PostgreSQL en memoria: comprueba alta, idempotencia, rollback por error de orden y bloqueos de confirmación/vencimiento/ocupación. 232 resultados de prueba aprobados en total. Sin cambios a v23 ni datos productivos. Alcance y límites: `laso-transacciones-aisladas.md`.

## Laso: transacciones de turnos existentes — 25/11/2026
Ocho escenarios SQL aislados nuevos verifican confirmación idempotente, rollback después de insertar la orden, reintento y rechazo de identidad/evento/datos inválidos; comprueban superposición y límites contiguos. Suite: 241/241 resultados aprobados, incluidos grupos padre. Sin cambios del despliegue v23 ni datos reales. Límites y reproducción: `laso-transacciones-aisladas.md` y `tests/sql-aislado/README.md`.

## Laso: arnés de concurrencia preparado — 25/11/2026, 17 h
Se agregó un ensayo PostgreSQL nativo con conexiones independientes para duplicados, superposición y revocación durante espera. Ejecución bloqueada por prohibición de sockets del entorno: cero escenarios concurrentes ejecutados. Suite anterior repetida: 241/241 aprobados. Sin cambios productivos a v23. Ver tests/concurrencia/README.md y laso-transacciones-aisladas.md.

## Laso: autorización SQL real aislada — 25/11/2026, 20 h
Se prueban identidad autorizada y seis denegaciones con bot_autorizar real: revocación, versión antigua, permiso retirado, perfil inactivo, rol cliente y suspensión. 249/249 resultados aprobados; no incluyen concurrencia. La versión productiva permanece v23, sin cambios. Ver laso-transacciones-aisladas.md.

## Laso: propuesta conversacional de reprogramación — 25/11/2026, 21 h
Núcleo local para «Pasá la orden #42 para mañana a las 10» y «Mejor a las 11»: conserva duración/contexto, muestra antes/después y descarta propuestas ambiguas, vencidas, ajenas o superpuestas. Nueve escenarios nuevos; suite completa 258/258. No conectado al webhook ni al guardado: v23 permanece sin cambios. Alcance en laso-edicion-agenda.md.

## Laso: confirmar la propuesta vigente de edición — 25/11/2026, 22 h
Adaptador local de conversación: correcciones renuevan el código, confirmación exacta propia de edición, revalidación de contexto y descarte de sesión tras validar. Siete pruebas nuevas; 265/265 resultados. Devuelve intención, no guarda; persistencia atómica, RPC y conexión WhatsApp pendientes. v23 sin cambios. Ver laso-edicion-agenda.md.

## Laso: persistencia propuesta de edición — 25/11/2026, 22:56 h
Prototipo SQL aislado con comparación de revisión: evita sobrescrituras atrasadas y conserva una revisión al cancelar. Seis escenarios nuevos, suite 272/272 contando grupos. Autorización/integración/consumo transaccional pendientes; no es una migración desplegada. v23 sin cambios. Ver laso-edicion-agenda.md.

## Laso: invalidación de contexto incompleto o cambiado — 26/11/2026
Edición conversacional descarta sesiones incompletas y detecta cambios de cliente, domicilio y título además del horario/estado. Tres regresiones reproducidas y corregidas; 275/275 pruebas. Solo prototipo, v23 sin cambios. Ver laso-edicion-agenda.md.

## Laso: sesión de edición ligada al acceso — 26/11/2026, 01 h
Prototipo SQL aislado exige permiso agenda.editar, único número privado, versión y evento de texto del mismo acceso. Cinco escenarios nuevos; 281/281 resultados contando grupos. No desplegado: consumo de eventos y guardado de orden pendientes. Ver laso-edicion-agenda.md.

## Laso: eventos idempotentes para sesión de edición — 26/11/2026, 02 h
Prototipo SQL guarda resultado por evento; reintentos idénticos no reemplazan sesión, reutilización con otro contenido se rechaza y un error revierte también el evento. Tres escenarios nuevos; 284/284 resultados. No desplegado ni conectado a edición real. Ver laso-edicion-agenda.md.

## Laso: vencimiento de sesión al persistir — 26/11/2026, 03 h
Prototipo SQL rechaza contexto vencido/futuro, código malformado y estructura incompleta antes de persistir. Dos escenarios nuevos; 286/286 resultados. No desplegado; v23 sin cambios. Ver laso-edicion-agenda.md.

## Laso: correcciones sin renovar vigencia — 26/11/2026, 04 h
Prototipo SQL conserva creada y exige código nuevo al corregir contexto activo. Falla reproducida y corregida; dos escenarios nuevos, 288/288 resultados. No desplegado; v23 permanece sin cambios. Ver laso-edicion-agenda.md.

## Laso: reprogramación transaccional aislada — 26/11/2026, 05 h
Función propuesta confirma texto exacto, compara orden original, verifica horario y actualiza orden/auditoría/consumo juntos. Reintento no duplica; error de auditoría revierte todo. Seis escenarios nuevos; 295/295 resultados. No desplegado ni integrado a WhatsApp; concurrencia y esquema completo pendientes. Ver laso-edicion-agenda.md.

- **Laso / edición de agenda (prototipo, 26/11/2026):** corregida comparación de contexto recuperado desde JSONB; prueba integrada de conversación, corrección de horario, sesión autorizada y confirmación SQL con reintento sin duplicados. Suite local: 298 pruebas pasadas. No desplegado; edición por WhatsApp y concurrencia real pendientes. Ver `docs/laso-edicion-agenda.md`.

- **Laso / regresión integrada de edición (26/11/2026):** tres escenarios adicionales verifican cancelación persistida, bloqueo de correcciones atrasadas, cambios externos y revocación entre conversación y guardado. Suite: 301 pruebas pasadas. Solo pruebas/documentación; edición todavía no desplegada y concurrencia multiconexión pendiente.

- **Laso / coordinador de edición (prototipo, 26/11/2026):** respuestas de propuesta, cancelación y edición condicionadas al resultado SQL; errores de transporte sin éxito ficticio ni reintento automático; duplicados sin mensaje. 308 pruebas pasadas, incluida integración SQL aislada. No conectado al webhook ni desplegado.

- **Laso / conversación de agenda (prototipo, 26/11/2026):** permite corregir solo la fecha conservando la hora de una propuesta vigente, con código renovado y validación de conflictos. 311 pruebas pasadas e integración SQL aislada actualizada. No desplegado; no habilita edición por WhatsApp todavía.

- **Laso / permisos de edición (prototipo, 26/11/2026):** cierre explícito de permisos PUBLIC/anon/authenticated que contempla concesiones directas por defecto. Pruebas con SET ROLE y rechazo 42501; suite completa 315 pasadas. No aplicado a producción ni concedido acceso al bot.

- **Laso / atomicidad de edición (prototipo, 26/11/2026):** exige una fila afectada en orden, auditoría y consumo de sesión; una escritura omitida provoca rollback completo. Cuatro escenarios nuevos; suite de 319 pruebas pasadas. No desplegado.

- **Laso / sesión y deduplicación (prototipo, 26/11/2026):** el guardado exige registrar evento y resultado; una omisión revierte la sesión. Tres regresiones nuevas de fallo y recuperación; 322 pruebas pasadas. No desplegado.

- **Laso / respuestas de edición (prototipo, 26/11/2026):** ocho motivos SQL se traducen en explicaciones concretas y siguiente dato necesario; errores desconocidos conservan resultado incierto. 324 pruebas pasadas, incluida respuesta a cambio externo con SQL aislado. No desplegado.

- **Laso / memoria privada (26/11/2026):** auditados esquema, RLS y ACL existentes; snapshot de RPC y cuatro escenarios aislados de parser→SQL, idempotencia, autorización y rollback. Suite: 329 pruebas pasadas. Receptor v23 sin memoria integrada; activación no verificada, bloqueo previo de despliegue sin eludir. Ver `docs/laso-memoria-auditoria.md`.

- **Laso / privacidad de memoria (26/11/2026):** políticas SELECT reales ensayadas con roles locales; comprobado aislamiento entre administradores y rechazo de escritura/RPC para roles de aplicación. Suite: 331 pruebas pasadas. No acredita JWT/PostgREST productivo ni activa WhatsApp.
