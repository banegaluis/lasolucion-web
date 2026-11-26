# Vencimientos y recordatorios de La Solución

## Qué queda listo en esta etapa
- Pantalla \`crm/vencimientos.html\`, visible en menú solamente para administradores.
- CRUD sin borrado físico: cliente existente de Supabase, título, fecha registrada, detalle, periodicidad 6/12/24 meses o única, avisos a 30/7/0 días, pausa.
- La fecha no se renueva automáticamente. «Registrar renovación» propone un próximo vencimiento y exige confirmarlo; el trigger conserva fecha anterior/nueva, usuario y momento.
- Consentimiento WhatsApp desactivado de forma predeterminada. Si se marca, registrar la fuente real, fecha y respaldo; no inventarlos. Cambiar la casilla sin prueba no significa que exista permiso real.
- Contacto manual: «Abrir WhatsApp» solo abre un texto prellenado; no lo envía. «Registrar contacto» queda disponible solo en el día exacto de un aviso programado, exige confirmación posterior al envío manual y graba \`contacto_declarado\` (no equivale a entrega).
- Los registros están protegidos por RLS de \`public.is_admin()\`, no se crean clientes, mensajes ni datos de ejemplo.
- Vigencia legal: la periodicidad elegida es una **fecha administrativa**, nunca afirmación de obligación normativa universal.

## Instalación / prueba
1. Aplicar \`docs/sql/vencimientos_recordatorios.sql\` en Supabase con revisión previa. Es aditivo: tres tablas, índices, RLS, auditoría por trigger y función de consulta solo para el backend.
2. Publicar la página después de integrar el PR.
3. Abrir \`crm/vencimientos.html\` como administrador con sesión Supabase válida; cargar un cliente real, grabar, recargar y comprobar persistencia.
4. Registrar una renovación confirmada y verificar la auditoría. Probar el botón manual con un número consentido y comprobar que el sistema **no** marque automáticamente el contacto.
5. Probar en Safari de iPhone (responsive, sesión, WhatsApp, regreso y estado). La revisión en GitHub y pruebas de código **no sustituyen** estas pruebas.

## Para conectar el bot de WhatsApp (PENDIENTE)
1. Configurar Meta WhatsApp Business Platform (Cloud API o BSP autorizado), plantillas de utilidad aprobadas cuando correspondan, autenticación, webhook y servidor/Edge Function con secretos **solo del lado servidor**.
2. Obtener consentimiento válido del destinatario, guardar fuente y prueba; respetar revocaciones y políticas de mensajería. Nunca enviar por solo existir fecha y teléfono.
3. Programar un job del lado servidor con fecha calculada en \`America/Argentina/Cordoba\`; consultar \`public.vencimientos_avisos_del_dia(p_fecha)\` como \`service_role\`. La función no envía y devuelve candidatos **solo en el día exacto** del aviso para evitar envíos históricos tardíos.
4. Revalidar consentimiento/actividad/telefono del cliente justo antes de cada envío. **Reservar primero** en \`public.vencimientos_avisos\` con \`canal='whatsapp_api'\`, \`resultado='reservado'\`, \`fecha_vencimiento\` y \`dias_antes\`: la clave UNIQUE impide dos trabajadores sobre el mismo aviso. Tratar conflicto como ya reservado y NO enviar de nuevo.
5. Enviar la plantilla aprobada y persistir resultado del proveedor \`enviado\` / \`fallido\`, \`proveedor_id\`. Diseñar recuperación de \`reservado\` o \`fallido\` y webhooks de entrega antes de habilitar reintentos, sin duplicar mensajes.
6. Limitar acceso a la API backend: no usar credenciales secretas en \`crm/*.html\`. El backend deberá tener métricas y fallos, log de auditoría y forma de suspensión.
7. No prometer «mensaje entregado» porque la API respondió «enviado», ni marcar mensajes manuales como entregados.
8. Meta puede cobrar por mensajes plantilla; revisar tarifas y aprobación del cliente antes de habilitar envíos.

## Contrato de datos
- \`vencimientos\`: estado actual, \`fecha_vencimiento\`, \`periodicidad_meses\`, \`avisos_dias\`, \`whatsapp_autorizado\`, \`whatsapp_autorizacion_fuente\`.
- \`vencimientos_renovaciones\`: evento inmutable de cambio de fecha.
- \`vencimientos_avisos\`: registro único por \`(vencimiento_id, fecha_vencimiento, dias_antes)\`. El navegador solo inserta \`manual_whatsapp/contacto_declarado\`, nunca un «enviado» de la API. La función \`vencimientos_avisos_del_dia(date)\` es solo para \`service_role\`.

## Pendientes
- Integrar y validar bot real y plantillas. NO hay envíos automáticos, no hay jobs activos.
- Pruebas reales multiusuario desde iPhone; verificar permisos en sesión expirada, que no exponga clientes a técnicos.
- Eventualmente integrar vencimientos en el calendario visual. Por ahora es un módulo de seguimiento separado; no interfiere con Órdenes.
