# Integración de la portada pública en LaSolucionapp

Este script integra la landing pública dentro del CRM existente sin modificar `dashboard.html`, órdenes, agenda, clientes ni técnicos.

## Qué hace

- Guarda una copia de seguridad del `index.html`, `js/auth.js` y `js/login.js`.
- Copia el login actual a `login.html`.
- Convierte `index.html` en la portada pública.
- Crea `css/public.css` y `js/public.js`.
- Cambia las redirecciones de cierre/protección desde `index.html` hacia `login.html`.
- Mantiene `dashboard.html` como panel del CRM.
- Conecta WhatsApp Business a **+54 9 351 543-9183**.

## Ejecutar en WSL

Desde la carpeta principal de la app:

```bash
cd "/mnt/c/Users/LuisB/OneDrive/Documentos/LASOLUCION/LaSolucionapp"
curl -fsSL https://raw.githubusercontent.com/banegaluis/lasolucion-web/main/tools/integrar-en-crm.sh -o /tmp/integrar-en-crm.sh
bash /tmp/integrar-en-crm.sh
python3 -m http.server 5500
```

Abrir:

- Portada: http://localhost:5500/
- Login: http://localhost:5500/login.html
- Dashboard: http://localhost:5500/dashboard.html

El script aborta si no encuentra la estructura esperada del CRM.
