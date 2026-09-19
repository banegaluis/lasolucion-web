#!/usr/bin/env bash
set -euo pipefail

# Integra una portada pública en LaSolucionapp sin tocar dashboard/agenda/ordenes.
# Ejecutar DESDE la raíz de LaSolucionapp.

required=("index.html" "dashboard.html" "js/auth.js" "js/login.js")
for f in "${required[@]}"; do
  if [[ ! -e "$f" ]]; then
    echo "Falta $f. Ejecutá este script desde la raíz de LaSolucionapp."
    exit 1
  fi
done

stamp="$(date +%Y%m%d_%H%M%S)"
backup="_backup_pre_portal_${stamp}"
mkdir -p "$backup/js" "$backup/css"

cp index.html "$backup/index.html"
cp js/auth.js "$backup/js/auth.js"
cp js/login.js "$backup/js/login.js"
[[ -f css/style.css ]] && cp css/style.css "$backup/css/style.css"

# El acceso interno se conserva intacto, pero queda fuera de la vidriera pública.
cp index.html acceso-interno.html

python3 - <<'PY'
from pathlib import Path
p = Path("acceso-interno.html")
txt = p.read_text(encoding="utf-8-sig")
if '<meta name="robots" content="noindex,nofollow">' not in txt:
    txt = txt.replace("<head>", '<head>\n    <meta name="robots" content="noindex,nofollow">', 1)
p.write_text(txt, encoding="utf-8")
PY

mkdir -p css js

cat > css/public.css <<'CSS'
:root{
  --bg:#090909;--card:#141414;--line:#292929;--text:#f5f5f5;--muted:#a8a8a8;
  --yellow:#f5c518;--red:#ff453a;--blue:#2d8cff;--radius:22px;
}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--text);font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;line-height:1.5}
a{color:inherit;text-decoration:none}
button,input,select,textarea{font:inherit}
.wrap{width:min(1160px,calc(100% - 32px));margin:auto}
.topbar{position:sticky;top:0;z-index:30;background:rgba(9,9,9,.88);backdrop-filter:blur(16px);border-bottom:1px solid rgba(255,255,255,.07)}
.nav{height:72px;display:flex;align-items:center;justify-content:space-between;gap:18px}
.brand{display:flex;align-items:center;gap:12px;font-weight:900;letter-spacing:.03em}
.brand img{width:46px;height:46px;object-fit:contain}
.brand small{display:block;color:var(--muted);font-size:11px;font-weight:600}
.links{display:flex;align-items:center;gap:22px;color:#d0d0d0;font-size:14px;font-weight:700}
.btn{display:inline-flex;align-items:center;justify-content:center;border-radius:999px;padding:13px 18px;font-weight:900;border:1px solid transparent;cursor:pointer}
.btn-primary{background:var(--yellow);color:#0a0a0a}
.btn-secondary{border-color:#333;background:#111;color:#fff}
.hero{padding:72px 0 44px}
.hero-grid{display:grid;grid-template-columns:1.15fr .85fr;gap:46px;align-items:center}
.eyebrow{display:inline-flex;align-items:center;gap:8px;padding:7px 11px;border:1px solid #303030;border-radius:999px;background:#111;color:#d4d4d4;font-size:13px;font-weight:800}
.dot{width:8px;height:8px;border-radius:50%;background:var(--yellow)}
h1{font-size:clamp(45px,7vw,82px);line-height:.94;letter-spacing:-.055em;margin:22px 0}
h1 span{color:var(--yellow)}
.lead{font-size:clamp(18px,2vw,23px);color:#c6c6c6;max-width:700px}
.slogan{font-size:18px;font-weight:900;margin:26px 0}
.actions{display:flex;flex-wrap:wrap;gap:10px}
.hero-card{background:linear-gradient(145deg,#181818,#0c0c0c);border:1px solid #292929;border-radius:30px;padding:22px}
.hero-card h3{margin:0 0 6px;font-size:24px}
.hero-card p{margin:0 0 18px;color:var(--muted)}
.quick{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.quick a{min-height:118px;border:1px solid #2b2b2b;border-radius:18px;padding:16px;background:#101010;display:flex;flex-direction:column;justify-content:space-between}
.quick strong{font-size:17px}
.quick small{color:#999}
.quick .gas{border-top:3px solid var(--yellow)}
.quick .heat{border-top:3px solid var(--red)}
.quick .water{border-top:3px solid var(--blue)}
.quick .cool{border-top:3px solid #eaf4ff}
section{padding:66px 0}
.kicker{color:var(--yellow);font-size:12px;text-transform:uppercase;letter-spacing:.14em;font-weight:900}
h2{font-size:clamp(34px,4vw,52px);line-height:1.03;letter-spacing:-.04em;margin:8px 0 28px}
.services{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
.service{background:var(--card);border:1px solid var(--line);border-radius:var(--radius);padding:24px;min-height:230px;display:flex;flex-direction:column;justify-content:space-between}
.service h3{font-size:22px;margin:16px 0 8px}
.service p{color:var(--muted);margin:0}
.tags{display:flex;flex-wrap:wrap;gap:6px;margin-top:16px}
.tag{font-size:12px;border:1px solid #353535;border-radius:999px;padding:5px 8px;color:#ccc;background:#101010}
.process{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;counter-reset:step}
.step{counter-increment:step;border-top:1px solid #333;padding:18px 8px}
.step:before{content:"0" counter(step);color:var(--yellow);font-size:12px;font-weight:900}
.step h3{margin:9px 0 5px}.step p{margin:0;color:#999}
.quote{display:grid;grid-template-columns:.8fr 1.2fr;gap:32px;align-items:start}
.quote-copy p{color:#aaa;font-size:17px}
form{background:#141414;border:1px solid #292929;border-radius:26px;padding:24px}
.field{margin-bottom:14px}
label{display:block;font-size:13px;font-weight:800;color:#ccc;margin-bottom:6px}
input,select,textarea{width:100%;background:#0c0c0c;border:1px solid #303030;color:#fff;border-radius:13px;padding:13px 14px;outline:none}
textarea{min-height:115px;resize:vertical}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
footer{padding:34px 0 90px;color:#888}
.footer{display:flex;justify-content:space-between;gap:20px;flex-wrap:wrap}
.float-wa{position:fixed;right:18px;bottom:18px;width:58px;height:58px;border:0;border-radius:50%;background:#25d366;color:#06180d;font-size:24px;font-weight:900;box-shadow:0 16px 40px rgba(0,0,0,.4);cursor:pointer}
.mobile{display:none}
@media(max-width:900px){
  .links{display:none}
  .hero-grid,.quote{grid-template-columns:1fr}
  .services{grid-template-columns:1fr 1fr}
  .process{grid-template-columns:1fr 1fr}
}
@media(max-width:620px){
  .wrap{width:min(100% - 22px,1160px)}
  .nav{height:66px}
  .brand small{display:none}
  .nav>.btn-primary{display:none}
  .hero{padding-top:40px}
  h1{font-size:48px}
  .quick,.services,.process,.form-grid{grid-template-columns:1fr}
  section{padding:54px 0}
}
CSS

cat > js/public.js <<'JS'
(() => {
  "use strict";
  const WHATSAPP_NUMBER = "5493515439183";

  function wa(message){
    return "https://wa.me/" + WHATSAPP_NUMBER + "?text=" + encodeURIComponent(message);
  }

  document.querySelectorAll("[data-wa]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      window.open(wa(el.dataset.wa || "Hola, vi la web de La Solución y quiero hacer una consulta."), "_blank", "noopener");
    });
  });

  const form = document.getElementById("quoteForm");
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const servicio = document.getElementById("service").value;
    const zona = document.getElementById("zone").value.trim();
    const detalle = document.getElementById("detail").value.trim();
    const plazo = document.getElementById("timing").value;
    const msg =
      "Hola, vi la web de La Solución y quiero pedir presupuesto.\n\n" +
      "Servicio: " + servicio + "\n" +
      "Zona: " + zona + "\n" +
      "Plazo: " + plazo + "\n" +
      "Trabajo: " + detalle + "\n\n" +
      "Ahora adjunto fotos/video.";
    window.open(wa(msg), "_blank", "noopener");
  });

  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();
})();
JS

cat > index.html <<'HTML'
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>La Solución | Servicios técnicos en Córdoba</title>
  <meta name="description" content="Gas, calefacción, plomería, refrigeración, electricidad y terminaciones en Córdoba. Pedí presupuesto por WhatsApp.">
  <meta name="theme-color" content="#090909">
  <link rel="stylesheet" href="css/public.css">
</head>
<body>
<header class="topbar">
  <div class="wrap nav">
    <a class="brand" href="#inicio">
      <img src="assets/logo/logo.png" alt="La Solución">
      <span>LA SOLUCIÓN<small>Servicios técnicos · Córdoba</small></span>
    </a>
    <nav class="links">
      <a href="#servicios">Servicios</a>
      <a href="#como">Cómo trabajamos</a>
      <a href="#presupuesto">Presupuesto</a>
      <a href="https://www.instagram.com/lasolucioncba/" target="_blank" rel="noopener">Instagram</a>
          </nav>
    <a class="btn btn-primary" href="#presupuesto">Pedir presupuesto</a>
  </div>
</header>

<main id="inicio">
<section class="hero">
  <div class="wrap hero-grid">
    <div>
      <div class="eyebrow"><span class="dot"></span>Córdoba Capital y alrededores</div>
      <h1>El trabajo tiene que <span>quedar bien.</span></h1>
      <p class="lead">Gas, calefacción, agua, refrigeración, electricidad y terminaciones. Un solo contacto para resolver trabajos técnicos.</p>
      <p class="slogan">Va a funcionar, pero aparte va a quedar fachero.</p>
      <div class="actions">
        <a class="btn btn-primary" href="#" data-wa="Hola, vi la web de La Solución y necesito presupuesto para un trabajo.">Pedir presupuesto por WhatsApp →</a>
        <a class="btn btn-secondary" href="#servicios">Ver servicios</a>
      </div>
    </div>
    <aside class="hero-card">
      <h3>¿Qué necesitás resolver?</h3>
      <p>Elegí el rubro y contanos qué pasa.</p>
      <div class="quick">
        <a class="gas" href="#presupuesto"><span>🔥</span><div><strong>Gas</strong><br><small>Instalación · reparación</small></div></a>
        <a class="heat" href="#presupuesto"><span>♨️</span><div><strong>Calefacción</strong><br><small>Calefones · termotanques</small></div></a>
        <a class="water" href="#presupuesto"><span>💧</span><div><strong>Plomería</strong><br><small>Agua · sanitarios</small></div></a>
        <a class="cool" href="#presupuesto"><span>❄️</span><div><strong>Refrigeración</strong><br><small>Aire · frío comercial</small></div></a>
      </div>
    </aside>
  </div>
</section>

<section id="servicios">
  <div class="wrap">
    <div class="kicker">Servicios</div>
    <h2>Una solución para cada rubro.</h2>
    <div class="services">
      <article class="service"><div><div>🔥</div><h3>Gas</h3><p>Instalaciones, recambios, reparaciones, pruebas y adecuaciones.</p></div><div class="tags"><span class="tag">Cañerías</span><span class="tag">Cocinas</span><span class="tag">Artefactos</span></div></article>
      <article class="service"><div><div>♨️</div><h3>Calefacción</h3><p>Calefones, termotanques, calefactores y mantenimiento.</p></div><div class="tags"><span class="tag">Recambio</span><span class="tag">Service</span><span class="tag">Diagnóstico</span></div></article>
      <article class="service"><div><div>💧</div><h3>Plomería</h3><p>Agua, sanitarios, griferías, bombas, pérdidas y reparaciones.</p></div><div class="tags"><span class="tag">Baños</span><span class="tag">Bombas</span><span class="tag">Pérdidas</span></div></article>
      <article class="service"><div><div>❄️</div><h3>Refrigeración</h3><p>Climatización, mantenimiento y soluciones de frío.</p></div><div class="tags"><span class="tag">Aire acondicionado</span><span class="tag">Frío comercial</span></div></article>
      <article class="service"><div><div>⚡</div><h3>Electricidad</h3><p>Tomas, iluminación, artefactos, reparaciones y modificaciones.</p></div><div class="tags"><span class="tag">Iluminación</span><span class="tag">Tomas</span></div></article>
      <article class="service"><div><div>🧱</div><h3>Obra & terminaciones</h3><p>Cerámicos, porcelanatos, reparaciones y trabajos de terminación.</p></div><div class="tags"><span class="tag">Cerámicos</span><span class="tag">Porcelanato</span></div></article>
    </div>
  </div>
</section>

<section id="como">
  <div class="wrap">
    <div class="kicker">Cómo trabajamos</div>
    <h2>Simple para vos. Ordenado para nosotros.</h2>
    <div class="process">
      <div class="step"><h3>Escribinos</h3><p>Mandá una descripción junto con fotos o video.</p></div>
      <div class="step"><h3>Evaluamos</h3><p>Pedimos sólo los datos necesarios para entender el trabajo.</p></div>
      <div class="step"><h3>Presupuestamos</h3><p>Definimos alcance, materiales y condiciones antes de avanzar.</p></div>
      <div class="step"><h3>Coordinamos</h3><p>Agendamos y seguimos el trabajo por WhatsApp y nuestro sistema.</p></div>
    </div>
  </div>
</section>

<section id="presupuesto">
  <div class="wrap quote">
    <div class="quote-copy">
      <div class="kicker">Presupuesto</div>
      <h2>Contanos qué necesitás.</h2>
      <p>Completá lo básico y te llevamos a WhatsApp con el mensaje ordenado. Ahí podés adjuntar fotos o video.</p>
      <p><strong style="color:white">@lasolucioncba</strong><br>Córdoba, Argentina</p>
    </div>
    <form id="quoteForm">
      <div class="form-grid">
        <div class="field"><label for="service">Servicio</label><select id="service" required><option value="">Elegir…</option><option>Gas</option><option>Calefón / termotanque</option><option>Calefacción</option><option>Plomería</option><option>Refrigeración / aire</option><option>Electricidad</option><option>Cerámicos / terminaciones</option><option>Otro</option></select></div>
        <div class="field"><label for="zone">Barrio / localidad</label><input id="zone" placeholder="Ej.: Alta Córdoba" required></div>
      </div>
      <div class="field"><label for="detail">¿Qué hay que hacer?</label><textarea id="detail" placeholder="Contanos brevemente el problema o trabajo…" required></textarea></div>
      <div class="field"><label for="timing">¿Para cuándo?</label><select id="timing"><option>Sin urgencia</option><option>Esta semana</option><option>Lo antes posible</option></select></div>
      <button class="btn btn-primary" style="width:100%" type="submit">Enviar por WhatsApp →</button>
    </form>
  </div>
</section>

</main>

<footer>
  <div class="wrap footer">
    <span>LA SOLUCIÓN · Córdoba</span>
    <span>@lasolucioncba · © <span id="year"></span></span>
  </div>
</footer>

<button class="float-wa" data-wa="Hola, vi la web de La Solución y quiero hacer una consulta." aria-label="Abrir WhatsApp">◉</button>
<script src="js/public.js"></script>
</body>
</html>
HTML

python3 - <<'PY'
from pathlib import Path

auth = Path("js/auth.js")
txt = auth.read_text(encoding="utf-8-sig")
txt = txt.replace('window.location.href = "index.html";', 'window.location.href = "acceso-interno.html";')
txt = txt.replace("window.location.href = 'index.html';", "window.location.href = 'acceso-interno.html';")
auth.write_text(txt, encoding="utf-8")

login = Path("js/login.js")
txt = login.read_text(encoding="utf-8-sig")
old = 'if (pagina === "" || pagina === "index.html") {'
new = 'if (pagina === "acceso-interno.html") {'
if old not in txt and new not in txt:
    raise SystemExit("No encontré la condición de página de login esperada en js/login.js; no seguí para no romper el CRM.")
txt = txt.replace(old, new)
login.write_text(txt, encoding="utf-8")
PY

echo
echo "Integración completada."
echo "Backup: $backup"
echo "Portada pública: index.html"
echo "Acceso interno: acceso-interno.html (no enlazado desde la vidriera)"
echo "Dashboard: dashboard.html (sin modificar)"
echo
echo "Probá con: python3 -m http.server 5500"
echo "Luego: http://localhost:5500/"
