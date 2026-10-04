import { NETWORKS, latestPosts, playerUrl } from './social-feed-core.mjs';

const root = document.getElementById('social-feed');
const element = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
};
const link = (text, url, className) => {
  const node = element('a', className, text);
  node.href = url; node.target = '_blank'; node.rel = 'noopener noreferrer';
  return node;
};

function render(feed, failed = false) {
  root.replaceChildren();
  for (const [network, config] of Object.entries(NETWORKS)) {
    const group = element('section', 'social-network');
    group.setAttribute('aria-labelledby', 'social-title-' + network);
    const head = element('div', 'social-network-head');
    const title = element('h3', '', config.name); title.id = 'social-title-' + network;
    head.append(title, link('Ver más ↗', config.profile, 'btn btn-secondary'));
    group.append(head);
    const posts = latestPosts(network, feed?.networks?.[network]?.posts);
    if (!posts.length) {
      group.append(element('p', 'social-empty', failed ? 'No pudimos cargar las publicaciones. Podés verlas en nuestro perfil.' : 'Encontrá nuestros trabajos y novedades en el perfil.'));
    } else {
      const grid = element('div', 'social-posts');
      for (const post of posts) {
        const card = element('article', 'social-post');
        const view = element('div', 'social-post-view');
        const button = element('button', 'social-preview', network === 'instagram' || network === 'facebook' ? 'Ver publicación' : 'Reproducir video');
        button.type = 'button';
        button.setAttribute('aria-label', 'Mostrar publicación de ' + config.name);
        if (post.image) {
          const image = element('img'); image.src = post.image; image.alt = ''; image.loading = 'lazy'; image.decoding = 'async';
          image.addEventListener('error', () => image.remove(), { once: true });
          button.prepend(image);
        }
        button.addEventListener('click', () => {
          // Only one player remains loaded at a time, avoiding simultaneous audio.
          root.querySelectorAll('iframe').forEach(frame => frame.closest('.social-post-view').replaceChildren(frame._preview));
          const frame = element('iframe', 'social-player');
          frame.src = playerUrl(network, post); frame.title = 'Publicación de ' + config.name;
          frame.allow = 'fullscreen; picture-in-picture; encrypted-media'; frame.allowFullscreen = true;
          frame._preview = button;
          view.replaceChildren(frame);
        });
        view.append(button); card.append(view);
        const body = element('div', 'social-post-body');
        if (post.caption) body.append(element('p', 'social-caption', post.caption));
        const date = element('time', 'social-date', new Date(post.publishedAt).toLocaleDateString('es-AR'));
        date.dateTime = post.publishedAt;
        body.append(date, link('Abrir en ' + config.name + ' ↗', post.url, 'social-original'));
        card.append(body); grid.append(card);
      }
      group.append(grid);
      if (feed.networks[network].status === 'stale') group.append(element('p', 'catalog-note', 'Mostramos las últimas publicaciones disponibles.'));
    }
    root.append(group);
  }
}

if (root) {
  render(null);
  async function refresh() {
    try {
      const response = await fetch(new URL('../data/social-feed.json', import.meta.url), { cache: 'no-store', signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error('Feed unavailable');
      const feed = await response.json();
      if (!feed || typeof feed.networks !== 'object') throw new Error('Invalid feed');
      render(feed);
    } catch {
      if (!root.querySelector('.social-post')) render(null, true);
    }
  }
  refresh();
  // Refresh on returning to the page; do not interrupt a player in use.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !root.querySelector('iframe')) refresh();
  });
}
