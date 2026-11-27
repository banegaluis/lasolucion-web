# Concurrencia de turnos — ensayo local pendiente

Este arnés crea un clúster PostgreSQL 17.7 efímero y tres conexiones independientes. Solo escucha por socket Unix dentro de un directorio privado; no acepta DATABASE_URL, no usa secretos, no conecta Supabase ni envía mensajes. Requiere Linux x64, Node y permiso para crear sockets Unix. No ejecutar como root. Dependencias fijadas con lockfile; no usa servicios pagos.

```sh
npm ci --prefix tests/concurrencia --ignore-scripts --no-audit --no-fund
node --test tests/concurrencia/turnos.test.mjs
```

El arnés restaura los enlaces locales de bibliotecas del paquete PostgreSQL, inicia el servidor, crea tablas mínimas y carga las definiciones reales de `bot_autorizar` y `laso_confirmar_turno`. En finally cierra las conexiones, detiene el servidor y elimina el directorio efímero. Los datos ficticios solo existen allí. No replica RLS, roles ni triggers completos del CRM.

Escenarios preparados:
1. Dos conexiones confirman el mismo código: una orden y mismo resultado.
2. Dos reservas superpuestas: una registrada y otra ocupada.
3. Una confirmación espera un advisory lock mientras se revoca el acceso: debe denegar y crear cero órdenes.

La sincronización observa pg_stat_activity.wait_event_type=Lock, con límite de cinco segundos, sin depender de una pausa fija para suponer que la consulta está bloqueada. Consultas con timeout de diez segundos.

## Estado real al 25/11/2026, 17 h

Instalación e initdb completados; `node --check` aprobado. La ejecución se detuvo antes de cualquier escenario porque el entorno respondió `Operation not permitted` al crear el socket Unix. Resultado del intento: un grupo fallido, cero escenarios ejecutados. No son pruebas aprobadas ni un defecto de producción reproducido.

Inspección del SQL: la autorización se consulta antes del bloqueo; no hay otra consulta después de la espera. Esto justifica ensayar el tercer escenario, pero no demuestra por sí solo su resultado concurrente. La aserción exige el comportamiento seguro; no se adapta para aprobar una escritura revocada. No desplegar una corrección hasta reproducir y verificar la carrera. No se habilitó CI ni infraestructura nueva.

Fuentes de código SQL: Supabase hxphinxgxladtjfnosvi, lectura del 25/11/2026; cuerpo de turno idéntico al snapshot del ensayo anterior. Binarios: https://github.com/leinelissen/embedded-postgres (paquete 17.7.0-beta.16, motor PostgreSQL 17.7).
