export const LIMIT = 5;
export const NETWORKS = {
  instagram: { name: 'Instagram', profile: 'https://www.instagram.com/lasolucioncba/' },
  facebook: { name: 'Facebook', profile: 'https://www.facebook.com/lasolucioncba' },
  tiktok: { name: 'TikTok', profile: 'https://www.tiktok.com/@lasolucioncba' }
};

export function postUrl(network, value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') return null;
    const host = url.hostname.replace(/^www\./, '');
    const valid = network === 'instagram' ? host === 'instagram.com' && /^\/(p|reel|tv)\/[\w-]+\/?$/.test(url.pathname)
      : network === 'tiktok' ? host === 'tiktok.com' && /^\/@lasolucioncba\/video\/\d+\/?$/.test(url.pathname)
      : network === 'facebook' && host === 'facebook.com' && url.pathname !== '/' && url.pathname !== '/lasolucioncba';
    if (!valid) return null;
    url.hash = '';
    if (network !== 'facebook') url.search = '';
    return url.href;
  } catch { return null; }
}

export function latestPosts(network, posts) {
  const unique = new Set();
  return (Array.isArray(posts) ? posts : []).filter(post => post && typeof post === 'object').map(post => ({
    id: String(post.id || ''),
    url: postUrl(network, post.url),
    caption: String(post.caption || '').slice(0, 1000),
    publishedAt: post.publishedAt,
    image: safeImage(post.image)
  })).filter(post => {
    if (!post.url || !Number.isFinite(Date.parse(post.publishedAt)) || unique.has(post.url)) return false;
    unique.add(post.url);
    return true;
  }).sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)).slice(0, LIMIT);
}

export function safeImage(value) {
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : null; }
  catch { return null; }
}

export function playerUrl(network, post) {
  const url = postUrl(network, post.url);
  if (!url) return null;
  if (network === 'tiktok') return 'https://www.tiktok.com/player/v1/' + new URL(url).pathname.match(/video\/(\d+)/)[1] + '?autoplay=0&rel=0';
  if (network === 'instagram') return new URL(url).origin + new URL(url).pathname.replace(/\/$/, '') + '/embed/';
  return 'https://www.facebook.com/plugins/post.php?href=' + encodeURIComponent(url) + '&width=500&show_text=true';
}
