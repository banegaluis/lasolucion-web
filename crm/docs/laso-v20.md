# Laso: correcciones de horario, 25/11/2026

Se inspeccionó whatsapp-interno ACTIVE v19 en Supabase. El PR #12 conserva el receptor anterior: no debe desplegarse encima de v19 porque perdería conversación, audio y altas. La copia exacta de v19 queda en `supabase/snapshots/whatsapp-interno-v19`; la propuesta corregida completa está en `supabase/functions/laso-privado`, cuyo nombre de despliegue sigue siendo `whatsapp-interno`.

## Cambio
Solo clientes-alta.mjs cambia frente a v19. Corregir duración o fin elimina primero los valores anteriores. Una duración inválida o que excede el día requiere aclaración; el fin explícito descarta la duración previa; indicar ambos requiere elegir uno. Se recalcula el fin derivado al cambiar el inicio. No se cambia la base recibida ni se permite confirmar por voz.

## Pruebas
214/214 pruebas Node aprobadas, 6 nuevas: 5 de interpretación y 1 de integración con lectura/guardado de pendientes simulados. Cuatro escenarios fallaban antes. No hay ahorro de latencia medido ni llamadas de red nuevas.
En PostgreSQL real: laso_confirmar_alta y laso_confirmar_turno devuelven denegado para número ajeno, bajo service_role, dentro de BEGIN/ROLLBACK. Sin crear personas ni órdenes ficticias o reales. Esto no prueba altas completas, concurrencia ni rollback por fallo a mitad de una escritura.
Las dos RPC inspeccionadas son SECURITY INVOKER y ejecutables por service_role/postgres. La auditoría general detecta advertencias de funciones SECURITY DEFINER accesibles por anon/authenticated; requieren revisión de sus controles internos antes de alterar permisos del CRM. No se concluye exposición de datos solo por esa advertencia.

## Despliegue y recuperación
Desplegar todos los archivos de laso-privado como whatsapp-interno, entrypoint index.js, verify_jwt=false porque el cuerpo valida HMAC. No modificar secretos ni destinos. Para rollback, redesplegar los archivos exactos del snapshot v19 con la misma configuración. No hay migración de esquema ni cambios de datos.
Verificación posterior: recuperar fuente y comparar todos los archivos; probar rechazo de POST sin firma (sin mensajes). Mantener las confirmaciones escritas y número privado fijo.
Pendiente: transacciones/concurrencia con datos aislados, revocación durante espera de bloqueo, entrega confiable de respuestas tras fallos, y suite HTTP completa del nuevo flujo. No se probaron Safari, PDF, audio real ni WhatsApp extremo a extremo en esta ejecución.
