# Alta y rollback aislados — 25/11/2026, 15 h

Se verificó Supabase whatsapp-interno v23 ACTIVE y GitHub 509012eb059ed9a3f003d1734315831e81e5fc23. No se cambió el despliegue: este avance agrega pruebas reproducibles.

Se destrabó el ensayo SQL local usando PGlite 0.6.0 fijado en tests/sql-aislado, sin PostgreSQL/Docker del sistema ni gasto de infraestructura. Se ejecuta una copia exacta del cuerpo de laso_confirmar_alta recuperado del servidor, sobre tablas mínimas en memoria y autorización sustituida.

Resultados: suite general 225 pruebas; ensayo SQL 7 resultados (grupo y seis escenarios), total 232 aprobados. Alta completa + reintento conservan 1 cliente, 1 dirección y 1 orden. Error al insertar orden revierte cliente y dirección: 0/0/0 registros y pendiente sin confirmar. Evento ajeno, texto alterado, audio y vencimiento no escriben. Horario ocupado conserva solo la orden de bloqueo local. Sin medición de latencia ni eficiencia operativa.

Limitaciones: no reproduce todo el esquema productivo, RLS, triggers, roles o auditoría; no prueba concurrencia entre conexiones, guardar turnos para clientes existentes, audio real, Safari, PDF ni entrega WhatsApp. No se ejecutaron altas ficticias en producción, no se enviaron mensajes ni se modificaron secretos/datos reales.

Próximo paso: ampliar el arnés a laso_confirmar_turno y luego verificar carreras de bloqueo/revocación con PostgreSQL de múltiples conexiones. Ver instrucciones reproducibles en tests/sql-aislado/README.md. No hay rollback de despliegue porque no se desplegó nada en esta ejecución.
