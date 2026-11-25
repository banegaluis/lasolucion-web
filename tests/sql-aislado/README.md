# Pruebas de altas en PostgreSQL aislado

Ejecutar desde la raíz del repositorio:

```sh
npm ci --prefix tests/sql-aislado --ignore-scripts --no-audit --no-fund
node --test tests/*.test.cjs tests/*.test.mjs tests/sql-aislado/alta.test.mjs
```

PGlite 0.6.0 fijado con lockfile, solo dependencia de pruebas. Ejecuta PostgreSQL WASM en memoria; no usa URLs, claves ni datos de Supabase. No requiere servidor, cuenta paga ni cambios en producción. No agregar node_modules al repositorio.

`alta-desplegada.sql` es la definición de laso_confirmar_alta recuperada de Supabase el 25/11/2026 a las 15 h. Se prueba sin modificar el cuerpo. El arnés crea tablas mínimas y sustituye bot_autorizar por una autorización local determinista. No es el esquema completo del CRM: no replica todos sus triggers, restricciones, RLS, roles ni auditoría.

Se prueban: alta completa, repetición idempotente, rollback de cliente/dirección cuando falla la orden por CHECK, evento inexistente, texto alterado/audio, vencimiento y horario ocupado. El fallo artificial se introduce únicamente mediante una restricción de la tabla local de órdenes. No hay clientes ficticios en producción.

La prueba de rollback comprueba cero clientes, direcciones, órdenes y confirmaciones después del error. No exige continuidad de secuencias: PostgreSQL puede consumir números incluso si revierte la transacción.

No prueba concurrencia entre conexiones: PGlite serializa el acceso. Tampoco prueba Meta, WhatsApp, transporte HTTP/PostgREST, permisos reales ni la función de confirmar turnos existentes. La prueba de éxito SQL no implica que el flujo WhatsApp esté listo.

Fuentes del motor: https://pglite.dev/docs/api y https://pglite.dev/docs/about.
