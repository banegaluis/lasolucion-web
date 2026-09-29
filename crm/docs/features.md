# Funcionalidades y estado

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

