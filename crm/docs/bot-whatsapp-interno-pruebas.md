# Laso — asistente interno de La Solución, etapa de pruebas

**Estado: preparado en rama de desarrollo, NO desplegado.** No se envían mensajes, no se crean órdenes y no se gestionan clientes.

## Identidad
- **Laso** es el nombre interno del asistente; no modifica el nombre público de WhatsApp Business ni representa aprobación por Meta.

## Qué incluye
- Receptor GET/POST para Meta WhatsApp Cloud API en \`supabase/functions/whatsapp-interno/\`.
- \`WHATSAPP_BOT_MODO\` es **apagado** por omisión. Solo \`interno\` permite leer eventos, cuando se instalen además secretos y la tabla.
- GET de verificación con token exacto, POST con \`x-hub-signature-256\` HMAC-SHA256 del cuerpo original. El webhook deja pasar únicamente eventos de \`metadata.phone_number_id\` configurado.
- Verifica \`messages[].from\` como teléfono internacional derivado del remitente autenticado por Meta (nunca del texto del usuario). Autoriza cada entrada con RPC \`bot_autorizar(numero, 'agenda.registrar', null)\`. Revocar acceso en Configuración impide nuevos borradores.
- Admite texto que comienza con comando de agenda o mensaje de voz interno. Audio: almacena ID de medio pero **no descarga/transcribe**. Texto: almacena literalmente hasta 2000 caracteres como borrador **sin interpretarlo ni crear turno**.
- Deduplica por \`evento_id\` único para soportar reintentos de Meta.
- Bandeja de solo lectura \`crm/bot-pruebas.html\` exclusiva del administrador, hasta 100 mensajes recientes. No hay botón «Confirmar» ni acciones sobre clientes.
- RLS de administrador en \`bot_borradores\`; solo service_role inserta y no existe política de modificación por navegador.

## Orden seguro antes de probar con WhatsApp
1. Revisar y fusionar el PR si se aprueba el código. No se modifica el CRM publicado mientras el PR siga abierto.
2. Aplicar explícitamente el SQL **aditivo** \`docs/sql/bot_entrada_interna_pruebas.sql\` a Supabase. No contiene datos iniciales.
3. Verificar inicio de sesión administrador, acceso a \`bot-pruebas.html\` y rechazo de otros roles; la bandeja debe estar vacía.
4. Crear/configurar una aplicación de WhatsApp Business Platform en Meta, comenzar con su número de prueba **sin migrar el WhatsApp Business real de La Solución**. Determinar \`phone_number_id\`, \`app secret\`, \`verify token\` y webhook \`messages\`.
5. Guardar secretos **solo** en el proyecto Supabase (\`WHATSAPP_APP_SECRET\`, \`WHATSAPP_VERIFY_TOKEN\`, \`WHATSAPP_PHONE_NUMBER_ID\`). No ponerlos en GitHub ni en \`crm/js\`.
6. Confirmar disponibilidad de \`SUPABASE_URL\` y \`SUPABASE_SERVICE_ROLE_KEY\` del entorno. Nunca publicarlos.
7. Desplegar la Edge Function \`whatsapp-interno\` con \`verify_jwt=false\` exclusivamente porque el POST se autentica por firma Meta. Dejar \`WHATSAPP_BOT_MODO=apagado\` mientras se verifica configuración; habilitar \`interno\` solamente con prueba supervisada.
8. Habilitar para una persona interna **verificada** un número en Configuración con permiso \`agenda.registrar\`. Enviar desde ese número de prueba un texto «Agendá mañana una visita» y un audio. Comprobar entrada sin creación de órdenes ni mensajes salientes.
9. Probar número no autorizado, firma falsa, evento con \`phone_number_id\` incorrecto, envío duplicado, revocación durante la prueba, interrupción de Supabase y límites de payload. Apagar si algo falla.

## Siguiente etapa pendiente
1. Transcripción de audios con un motor elegido (todavía ninguno, para no generar costos ni procesar archivos de clientes); mecanismo de revisión editable.
2. Interpretación de cliente/tarea/fecha/hora con controles de datos faltantes y búsqueda sin crear clientes automáticamente.
3. Respuesta únicamente a **operadores internos autorizados**, pidiendo confirmación y mostrando un resumen. Se requerirá un adaptador de envío; no existe en este PR.
4. Guardado atómico, idempotente y autorizado de la Nueva Orden después de la confirmación, con auditoría de cambios y estado.
5. Validar con iPhone real. Hasta ese momento todo permanece en borradores de prueba.

## Garantías y límites
- No campañas, recordatorios automáticos ni avisos a clientes.
- Sin respuestas a clientes aunque escriban al número empresarial. Los números no habilitados se omiten y su texto no se almacena.
- No se descarga audio, no se ejecuta reconocimiento de voz, no se agenda ningún trabajo, no se consulta Caja.
- No están configuradas credenciales, números de prueba de Meta ni webhooks reales por este PR.
- La validación automatizada del núcleo no reemplaza la prueba de extremo a extremo, la verificación de firma real ni el análisis de disponibilidad/costos de Meta.
