# Integración de la portada pública en LaSolucionapp

Este script integra la landing pública dentro del CRM existente sin modificar `dashboard.html`, órdenes, agenda, clientes ni técnicos.

## Qué hace

- Guarda una copia de seguridad del `index.html`, `js/auth.js` y `js/login.js`.
- Copia el login actual a `acceso-interno.html`, sin enlaces desde la vidriera pública.
- Convierte `index.html` en la portada pública.
- Crea `css/public.css` y `js/public.js`.
- Cambia las redirecciones de cierre/protección desde `index.html` hacia `acceso-interno.html`.
- Mantiene `dashboard.html` como panel del CRM y no muestra ningún acceso interno en la portada pública.
- Conecta WhatsApp Business a **+54 9 351 543-9183**.
- Agrega catálogo comercial con CTA específico por servicio.
- Publica el precio interno confirmado de recambio de calefón tiro balanceado posterior: **$220.000 de mano de obra**, con materiales y adaptaciones aparte.
- Prepara una galería de fotos y videos reales mediante `assets/public/trabajos/manifest.json`.

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
- Acceso interno: http://localhost:5500/acceso-interno.html (no se publica ni enlaza en la vidriera)
- Dashboard: http://localhost:5500/dashboard.html

El script aborta si no encuentra la estructura esperada del CRM.


## Separación público / interno

La portada pública no muestra botones, enlaces ni textos de acceso al CRM. El archivo `acceso-interno.html` incluye `noindex,nofollow` para evitar que los buscadores lo indexen. Esto mejora la separación visual y de navegación; la seguridad real sigue dependiendo de la autenticación del CRM.


## Portfolio de trabajos

Los archivos visuales viven en:

`assets/public/trabajos/`

La galería se genera leyendo `manifest.json`. Ejemplo:

```json
[
  {
    "archivo": "calefon-orbis.jpg",
    "tipo": "imagen",
    "titulo": "Recambio de calefón",
    "rubro": "Gas y calefacción",
    "descripcion": "Trabajo realizado en Córdoba."
  },
  {
    "archivo": "bano.mp4",
    "tipo": "video",
    "titulo": "Terminación de baño",
    "rubro": "Obra y terminaciones",
    "descripcion": "Cerámicos y terminaciones."
  }
]
```

## Agenda pública

No se implementa todavía. La portada queda preparada para agregar más adelante un paso de solicitud de visita con **rango horario sugerido**, sin mostrar la agenda interna ni exponer disponibilidad del CRM.
