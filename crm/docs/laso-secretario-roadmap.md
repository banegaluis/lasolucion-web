# Laso — secretario interno: contrato de borradores v1

Código fuente: `supabase/functions/whatsapp-interno/secretario-borradores.mjs`.
Pruebas: `tests/secretario-borradores.test.mjs`.

**Estado:** módulo puro de interpretación en rama del PR #12. **NO está conectado al webhook de Meta, al CRM ni desplegado en Supabase.** No es un modelo conversacional: usa reglas simples y deterministas. Ningún texto ejecuta órdenes o envía mensajes.

## Funcionalidad probada (Node 22, pruebas locales de desarrollo)
- Clasifica borradores internos: agenda, recordatorio, presupuesto y nota.
- Reconoce expresiones frecuentes: «Agendame», «Agendá», «Recordame», «Presupuestame».
- Acepta fechas DD/MM/AAAA y horarios HH:MM; también «a las 10» o «9 hs».
- Permite «hoy», «mañana» y «pasado mañana» **solo cuando se proporciona explícitamente una fecha/hora de referencia** (objeto Date válido). Usa America/Argentina/Cordoba para decidir el día correcto y suma días de calendario, incluso a medianoche UTC o en cambios de mes.
- Rechaza fechas calendarias imposibles. Una fecha explícita inválida tiene prioridad sobre una expresión relativa, para no inventar otro día.
- Si falta una fecha/hora fiable, lo indica en el arreglo `faltantes`. Mencionar «para Guille» sirve como indicio textual, **no identifica ni valida clientes del CRM**.
- El módulo emite siempre `requiere_confirmacion: true`, `puede_ejecutar: false`, `puede_enviar: false`. No hace escrituras, consultas externas ni pagos.

### Cómo correr las pruebas
```bash
node --test tests/secretario-borradores.test.mjs
```

Resultado local reportado al 8/11/2026: 12 pruebas del módulo aprobadas con Node 22. Esto **no sustituye** CI, pruebas Deno, integración con la API, test del webhook real ni ensayos desde iPhone.

## Diseño seguro de la siguiente fase
1. Simulador de solicitudes sin datos personales: pedido → borrador → aclaración → aprobación.
2. Interpretación ampliada para días de semana y fechas coloquiales con resolución determinista de zona y ambigüedades, sin inventar horarios.
3. Consulta mínima y autorizada de agenda/clientes, sin exponer datos a remitentes no autenticados.
4. Voz interna optativa con consentimiento, control de costos, política de retención y eliminación de audios.
5. Estado auditable de borradores (pendiente, aclarado, aprobado, cancelado), con idempotencia y prevención de duplicados.
6. Antes de crear órdenes, realizar pruebas transaccionales y requerir aprobación del operador. Mantener `WHATSAPP_BOT_MODO=apagado` por defecto.
7. Conectar WhatsApp solamente después de verificar coexistencia, recepción del webhook, permisos y controles de despliegue.

## Advertencias técnicas
- El parser reconoce patrones básicos, no comprende el significado completo ni detecta conflictos de agenda.
- El ejemplo «Agendame mañana a las 10 para Guille» produce una fecha si hay reloj inyectado, pero **no crea turno real**.
- No atribuir esta prueba a la implementación desplegada en Supabase ni a WhatsApp.
- No activar mensajes externos, gastos, escritura de datos ni acceso a Caja por una instrucción recibida en el propio chat.
