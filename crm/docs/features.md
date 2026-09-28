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
