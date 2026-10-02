# Usuarios internos — 02/10/2026

Usuarios ahora consulta cuentas reales y crea Auth + perfil desde `usuarios-admin`.
Roles habilitados: administrador, colaborador y técnico. Los clientes siguen siendo
fichas comerciales; no se crean cuentas ni se habilita su login.

## Operación

- Entrar con la cuenta administradora existente; abrir Usuarios y crear con email
  y contraseña de al menos 10 caracteres. El email queda confirmado por el alta administrativa.
- Los técnicos reciben su vínculo automáticamente y ven sus órdenes asignadas.
- Editar permite nombre, apellido, teléfono, rol y estado. No permite modificar el
  email ni cambiar contraseñas ajenas. La recuperación de clave sigue siendo el circuito vigente.
- El administrador no puede quitarse su propio acceso. Solo el servidor puede
  modificar roles, estado, actividad y vínculos de identidad.
- No se importan automáticamente las cuentas locales antiguas. Hay que crearlas
  nuevamente como cuentas reales; no se reutilizan contraseñas guardadas localmente.

## Implementación y recuperación

`supabase/functions/usuarios-admin` valida el token con Auth y vuelve a consultar el
perfil administrador activo. La clave de servicio queda exclusivamente en Supabase.
La función SQL `administrar_perfil_interno` es SECURITY INVOKER, ejecutable solo por
service_role; perfil y vínculo técnico se completan en una transacción.

Auth y Postgres no comparten una transacción: si falla el perfil, la cuenta queda sin
acceso operativo. Reintentar desde la misma pestaña y email recupera únicamente el
mismo envío del mismo administrador mediante app_metadata; no adopta cuentas ajenas.
El navegador conserva solo un identificador de alta en sessionStorage, nunca la clave.
El caso de alta interrumpida después de cerrar la pestaña requiere conciliación administrativa.

## Verificación

- Suite existente y pruebas nuevas de autorización, roles excluidos, duplicados,
  recuperación de alta y fallo parcial aprobadas con Node.
- Prueba SQL revertida: colaborador no puede ascender su propio rol.
- Prueba SQL revertida: técnico ve solo la orden asignada y deja de verla al desactivarse.
- Función desplegada con validación JWT; RPC no ejecutable por anon/authenticated.
- Sin cuentas de prueba permanentes ni cambios en las órdenes existentes.
- Pendiente comprobación de alta y login reales desde iPhone: no se dispone de una
  sesión administrativa de navegador para ejecutar ese recorrido en este entorno.

La configuración de URLs de recuperación es independiente y no se modificó en esta entrega.
