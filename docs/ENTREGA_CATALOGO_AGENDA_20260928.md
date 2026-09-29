# Catálogo y agenda — entrega del 28/09/2026

## Publicable

Portada y página `catalogo.html` con el lenguaje visual del dashboard; seis fichas PNG y textos para WhatsApp Business en el ZIP `assets/catalogo/LaSolucion_Catalogo_WhatsApp.zip`. No hay enlaces de clientes al CRM. No se modificaron precios ni se cargó contenido en WhatsApp.

Agenda con consulta periódica cada 30 segundos mientras está visible, al recuperar foco/conexión y verificación del acceso. No es Realtime: otros equipos ven los cambios tras la siguiente consulta. Sigue usando RLS del servidor y requiere sesiones individuales.

## Validación

43 pruebas Node aprobadas; Chromium local en 390 y 1440 px sin errores JS ni desbordamiento horizontal; revisión visual con referencia oficial disponible. Los cinco archivos de referencia citados en AGENTS siguen ausentes; se usó el dashboard ejecutivo disponible. No se simulan pruebas con usuarios reales diferentes.

## Corrección de permisos bloqueada

`docs/sql/proteger_perfiles.sql` contiene un trigger que impide a no administradores cambiar rol/estado/activo/ID y restringe el técnico actual a un perfil técnico activo. Se probó la protección en una transacción revertida, sin cambios persistentes en usuarios.

La revisión automática rechazó `apply_migration`: consideró que los cambios de permisos en producción requieren autorización específica. No se reintentó ni se aplicó indirectamente. Solicitar autorización explícita antes de aplicar este SQL; conservar la restricción de login actual mientras tanto.

Después: verificar admin/colaborador/técnico activo e inactivo con cuentas de prueba autorizadas; comprobar que un técnico solo vea sus trabajos; probar dos dispositivos; resolver edición concurrente. Para dar altas reales harán falta las identidades y roles, sin compartir contraseñas.
