# Alta y rollback aislados — 25/11/2026, 15 h

Se verificó Supabase whatsapp-interno v23 ACTIVE y GitHub 509012eb059ed9a3f003d1734315831e81e5fc23. No se cambió el despliegue: este avance agrega pruebas reproducibles.

Se destrabó el ensayo SQL local usando PGlite 0.6.0 fijado en tests/sql-aislado, sin PostgreSQL/Docker del sistema ni gasto de infraestructura. Se ejecuta una copia exacta del cuerpo de laso_confirmar_alta recuperado del servidor, sobre tablas mínimas en memoria y autorización sustituida.

Resultados: suite general 225 pruebas; ensayo SQL 7 resultados (grupo y seis escenarios), total 232 aprobados. Alta completa + reintento conservan 1 cliente, 1 dirección y 1 orden. Error al insertar orden revierte cliente y dirección: 0/0/0 registros y pendiente sin confirmar. Evento ajeno, texto alterado, audio y vencimiento no escriben. Horario ocupado conserva solo la orden de bloqueo local. Sin medición de latencia ni eficiencia operativa.

Limitaciones: no reproduce todo el esquema productivo, RLS, triggers, roles o auditoría; no prueba concurrencia entre conexiones, guardar turnos para clientes existentes, audio real, Safari, PDF ni entrega WhatsApp. No se ejecutaron altas ficticias en producción, no se enviaron mensajes ni se modificaron secretos/datos reales.

Próximo paso: ampliar el arnés a laso_confirmar_turno y luego verificar carreras de bloqueo/revocación con PostgreSQL de múltiples conexiones. Ver instrucciones reproducibles en tests/sql-aislado/README.md. No hay rollback de despliegue porque no se desplegó nada en esta ejecución.

## Ampliación: turnos de clientes existentes — 25/11/2026

Verificación fresca: whatsapp-interno v23 ACTIVE; PR #12 en addc50154cabdedd2e546fc843c5354244fae6b6 antes del cambio. Se agregó una copia exacta de laso_confirmar_turno y ocho escenarios SQL sobre tablas locales mínimas.

La suite completa pasa 241/241 resultados (225 previos generales, siete del grupo alta y nueve del grupo turno, contando los grupos padre). La nueva cobertura prueba: una sola orden ante confirmación repetida; asociación correcta a cliente, dirección y autor; rollback de la orden cuando falla el marcado final del pendiente; reintento recuperable; rechazo por número/versión, evento/texto/audio/identidad incorrectos, vencimiento y cliente/dirección inválidos; bloqueo por superposición y aceptación de un horario contiguo.

La mejora medible es ocho escenarios SQL adicionales, sin medir ahorro operativo ni latencia de producción. Autorización sustituida, tablas mínimas: no demuestra permisos productivos, RLS, triggers completos ni concurrencia. No hubo despliegue, mensajes, datos reales modificados, cambios de interfaz o pruebas nuevas de Safari/PDF/WhatsApp. Revertir este commit solo retira pruebas/documentación. Próxima prioridad: carreras entre confirmación, revocación y reservas con conexiones PostgreSQL independientes.
