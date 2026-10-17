# Panel de accesos del bot

Configuración (`crm/configuracion.html`) permite al administrador activo:
- Vincular un número internacional a una persona interna del CRM; el nombre y rol proceden de `perfiles`.
- Habilitar, deshabilitar o revocar y elegir permisos independientes para registros, consultas propias, Caja, deudas y agenda.
- Revisar antes de guardar; consultar cambios y actividad filtrados por acceso (últimos 100 eventos).

Los nuevos accesos comienzan deshabilitados y sin permisos. El número del negocio no se autoriza automáticamente como operador. No se envían mensajes ni se comprueba posesión del teléfono desde este panel. El administrador debe verificarlo antes de habilitarlo; el futuro conector debe vincularlo al remitente verificado por WhatsApp.

## Protección y trazabilidad

SQL `docs/sql/bot_accesos.sql`, aplicado el 17/10/2026. RLS limita lectura y cambios a administradores activos. No se borran accesos desde el cliente. El historial se escribe por trigger privado con administrador, instante y estado anterior/nuevo, nombre y rol de la persona. El cliente no puede insertar, editar ni borrar el historial.

Cada cambio incrementa `version`. Las ediciones utilizan la versión leída para rechazar sobrescrituras concurrentes. Ante error de red, actualizar antes de reintentar: el resultado del guardado podría ser incierto. Cambiar la persona conserva su identidad anterior en `antes.perfil_id`; los eventos del bot guardan su propia identidad histórica.

`bot_autorizar(numero, permiso, version)` es accesible solo por `service_role` y devuelve acceso/perfil/versión únicamente con permiso vigente y perfil activo. Deshabilitar el perfil bloquea al operador aunque el acceso figure habilitado.

## Contrato pendiente para WhatsApp

El bot todavía no está conectado. Los permisos son configuración persistida, no una conexión activa. El futuro backend debe:
1. Verificar firma del webhook y usar el identificador del remitente; nunca confiar en un número dictado en el mensaje.
2. Consultar autorización antes de leer datos y nuevamente al confirmar; usar versión guardada en el borrador para invalidar confirmaciones tras cualquier cambio.
3. Registrar cada consulta/operación en `bot_actividad` con ID único de evento, acceso, perfil, número, nombre/rol históricos, resultado y movimiento vinculado. Evitar datos financieros completos en logs.
4. Aplicar el filtro de autor en consultas propias. El permiso de registrar gastos no concede lectura de Caja.
5. Ejecutar autorización final y guardado de forma atómica para evitar carreras entre revocación y confirmación. El RPC actual es una consulta, no realiza esa transacción.

No se concede administración por WhatsApp. Las claves de servidor nunca van al navegador. No se afirma que ya se cancelen mensajes o confirmaciones de WhatsApp: falta esa integración.

## Verificación

Cuatro pruebas JS: formato internacional, permisos válidos, habilitación mínima y separación registro/consulta. Prueba real SQL revertida: alta y revocación auditadas, incremento de versión, permiso desconocido rechazado, colaborador bloqueado y privilegios de historial/API restringidos. No quedaron números ficticios. Pendiente recorrido visual en Safari/iPhone y pruebas del bot una vez conectado.
