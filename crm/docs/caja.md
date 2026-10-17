# Caja y movimientos

## Alcance

Módulo `crm/caja.html`, integrado al menú y reservado al administrador activo. Usa Auth y RLS; no tiene modo local que simule un guardado en la nube.

- Dictado mediante el micrófono del teclado del teléfono, sin subir audios a otro servicio.
- Intérprete determinista para una operación por frase: reconoce importes numéricos con «pesos», «mil» o «millón». Números escritos con letras, nombres y frases ambiguas requieren completar campos manualmente. No es una integración con WhatsApp.
- Borrador editable y segunda confirmación antes de insertar. No se guarda el borrador al cerrar la página.
- Cobros, gastos, nuevos saldos por cobrar, retiros personales, aportes y transferencias internas.
- Cliente seleccionado explícitamente, con teléfono para distinguir homónimos; órdenes filtradas por cliente.
- Saldos pendientes con cobros parciales vinculados. Registrar un saldo pendiente significa **agregar deuda**, no reemplazar el saldo total de un cliente.
- Cobros sin saldo vinculado no descuentan deudas automáticamente.
- Resumen por período de cobros, gastos, retiros, aportes y flujo; deuda pendiente de todos los registros.
- Las transferencias no incrementan ingresos ni gastos. Los retiros personales no son gastos operativos. Flujo no equivale a rentabilidad ni saldo disponible.

## Persistencia y seguridad

`docs/sql/caja_movimientos.sql` prepara la tabla, permisos y validaciones, de forma transaccional. Solo administradores activos pueden leer/insertar. Sin UPDATE/DELETE desde el cliente para conservar el historial. Se valida relación cliente/orden y que el cobro no supere la deuda; los cobros sobre una misma deuda se serializan.

Cada confirmación conserva un UUID durante los reintentos. Si se pierde la respuesta, se busca ese UUID antes de volver a insertar. Ante resultado de red incierto no se permite editar hasta resolver el reintento. No cerrar ni recargar la página durante ese estado: no hay cola persistente offline.

Caja es un libro nuevo: no importa ni sincroniza automáticamente `pagos`/`gastos` históricos. Evitar registrar dos veces una misma operación. La pantalla advierte esta limitación. La conciliación histórica y la edición/anulación auditada quedan para una etapa posterior.

## Estado de entrega

El 17/10/2026 se reemplazó la tabla anterior vacía por la estructura nueva, con autorización del usuario. Se comprobó que tenía cero filas y ninguna referencia externa. La migración bloquea la tabla y cancela el reemplazo si aparecen movimientos; no usa CASCADE.

Validado en Supabase mediante transacción revertida: administrador inserta y lee; deuda de $80.000 menos cobro de $30.000 deja $50.000; se rechaza sobrecobro; colaborador no puede leer ni insertar; anon no tiene privilegio de lectura. No quedaron movimientos ficticios. Ocho pruebas automatizadas de intérprete, cálculos y servicio aprobadas.

Pendientes: prueba de concurrencia desde dos dispositivos y recorrido de interfaz real en Safari/iPhone. WhatsApp no está conectado. El asesor de seguridad informó advertencias preexistentes ajenas a Caja (funciones y extensiones); no se modificaron dentro de esta tarea.

SQL de instalación: `docs/sql/caja_movimientos.sql`. Reemplazo aplicado: `docs/sql/caja_reemplazar_vacia.sql`. El ajuste de compatibilidad anterior se descartó al optar por la nueva tabla.

## Prueba de aceptación al activar

1. Comprobar acceso con administrador, técnico y usuario sin sesión; los dos últimos no deben leer ni insertar.
2. Dictar «Hoy gasté 25 mil pesos en caños, en efectivo», revisar, confirmar y recargar. Verificar una sola fila.
3. Crear saldo de $80.000 vinculado a cliente/orden y cobrar $30.000 desde «Registrar cobro». Debe quedar $50.000; rechazar sobrecobro, incluso desde dos dispositivos.
4. Registrar retiro y transferencia; verificar que no inflen ingresos operativos.
5. Simular pérdida de respuesta y reintentar; verificar un solo UUID en la tabla.
6. Probar Safari del iPhone y navegador interno de WhatsApp, dictado del teclado y legibilidad móvil. No se presentan como probados desde este entorno.
