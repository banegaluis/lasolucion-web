# Galería de redes de La Solución

## Implementado

`catalogo.html#redes` consume `data/social-feed.json`. Cada red muestra como máximo
cinco publicaciones, ordenadas por fecha descendente y sin duplicados de URL dentro
de la misma red. «Ver más» abre el perfil correspondiente. Los reproductores se
cargan al tocar una tarjeta; abrir otro retira el anterior para evitar audio
simultáneo. Si un embed no está disponible, permanece el enlace al original.

El workflow `Actualizar publicaciones de redes` consulta las APIs cada seis horas
(GitHub puede demorar los horarios). También permite ejecución manual. Conserva
la última lista correcta de cada red si falla la consulta y nunca envía tokens al
navegador ni los guarda en el JSON público.

## Activación pendiente: cuentas y permisos

La galería no tiene publicaciones de ejemplo. Las tres redes están inicialmente
sin conectar. El código está preparado, pero la sincronización real requiere:

1. Autorizar las cuentas oficiales de La Solución para lectura mediante las APIs.
2. En GitHub → Settings → Secrets and variables → Actions, agregar los siguientes
   secretos (nunca incluirlos en código ni en el chat):
   - `INSTAGRAM_ACCOUNT_ID`, `INSTAGRAM_ACCESS_TOKEN`: cuenta profesional. Se admite
     Instagram Login o Facebook Login, con los permisos de lectura correspondientes.
   - `FACEBOOK_PAGE_ID`, `FACEBOOK_PAGE_ACCESS_TOKEN`: página LaSolucion; permiso
     `pages_read_engagement` para consultar sus publicaciones.
   - `TIKTOK_ACCESS_TOKEN`: cuenta @lasolucioncba, autorización `video.list`.
3. Agregar variable `META_API_VERSION` con una versión habilitada y verificada para
   la app Meta. Para Instagram Login agregar `INSTAGRAM_API_HOST=graph.instagram.com`;
   para Facebook Login usar `graph.facebook.com` (predeterminado).
4. Ejecutar el workflow manualmente y verificar el JSON, la publicación Pages y
   la reproducción real desde Safari y el navegador interno de WhatsApp en iPhone.

Los tokens pueden caducar o revocarse: la renovación OAuth no está implementada.
Se requiere renovarlos/reconectar antes de su caducidad para mantener el flujo.
TikTok requiere una app autorizada para Display API; no alcanza el enlace del perfil.
No hay acceso administrativo a estas cuentas ni a los secretos desde esta sesión.

## Hosting

El repositorio publica Pages desde `main`. Un commit creado por `GITHUB_TOKEN` no
dispara por sí mismo un build de Pages; el workflow solicita ese build explícitamente.
Si cambia el hosting a GitHub Actions, adaptar ese último paso al deploy correspondiente.
El workflow necesita permisos `contents:write`, `pages:write` y permitir a Actions
actualizar `main`; las protecciones de rama pueden impedirlo.

## Verificación local

`node --test scripts/social-feed.test.mjs`

Las pruebas usan respuestas simuladas, no verifican acceso real a las cuentas.

Referencias oficiales:
- https://developers.tiktok.com/docs/en/tiktok-api-v2-video-list/
- https://developers.tiktok.com/docs/en/embed-player
- https://developers.tiktok.com/docs/en/display-api-get-started
- https://developers.facebook.com/documentation/pages-api
- https://www.postman.com/meta/instagram/overview
- https://docs.github.com/en/rest/pages/pages#request-a-github-pages-build

## Selección manual mientras se conectan las cuentas

`data/social-feed-manual.json` acepta hasta cinco publicaciones por red, en el orden
indicado. Cada entrada requiere `url`; `caption`, `image` y `publishedAt` son
opcionales. Sin fecha real no se muestra una fecha inventada. Usar enlaces completos
de publicaciones, no enlaces al perfil ni enlaces cortos de compartir.

La selección se muestra cuando la red no tiene una sincronización correcta con
status `ready`. Un resultado automático correcto, incluso vacío, tiene prioridad.
El workflow no modifica el archivo manual. Actualizar estos enlaces es manual;
este modo no obtiene las publicaciones nuevas del perfil.

Las listas siguen vacías hasta recibir enlaces reales del propietario.
