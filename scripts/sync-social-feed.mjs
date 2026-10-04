import { readFile, writeFile, rename } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { latestPosts } from '../js/social-feed-core.mjs';

const graphVersion = version => {
  if (!/^v\d+\.\d+$/.test(version || '')) throw new Error('META_API_VERSION must be configured');
  return version;
};

async function request(url, token, options = {}, fetcher = fetch) {
  const response = await fetcher(url, { ...options, signal: AbortSignal.timeout(30000), headers: {
    Authorization: 'Bearer ' + token, ...(options.body ? { 'Content-Type': 'application/json' } : {})
  } });
  if (!response.ok) throw new Error('API HTTP ' + response.status);
  const data = await response.json();
  if (data.error && data.error.code !== 'ok') throw new Error('API rejected the request');
  return data;
}

export async function collect(network, env = process.env, fetcher = fetch) {
  if (network === 'instagram') {
    if (!env.INSTAGRAM_ACCOUNT_ID || !env.INSTAGRAM_ACCESS_TOKEN) return null;
    if (!/^\d+$/.test(env.INSTAGRAM_ACCOUNT_ID)) throw new Error('Invalid account ID');
    const host = env.INSTAGRAM_API_HOST || 'graph.facebook.com';
    if (!['graph.facebook.com', 'graph.instagram.com'].includes(host)) throw new Error('Invalid Instagram API host');
    const url = new URL('https://' + host + '/' + graphVersion(env.META_API_VERSION) + '/' + env.INSTAGRAM_ACCOUNT_ID + '/media');
    url.searchParams.set('fields', 'id,caption,media_type,permalink,timestamp,thumbnail_url,media_url');
    url.searchParams.set('limit', '5');
    const data = await request(url, env.INSTAGRAM_ACCESS_TOKEN, {}, fetcher);
    if (!Array.isArray(data.data)) throw new Error('Invalid Instagram response');
    return data.data.map(post => ({ id: post.id, url: post.permalink, caption: post.caption,
      publishedAt: post.timestamp, image: post.thumbnail_url || (post.media_type !== 'VIDEO' ? post.media_url : null) }));
  }
  if (network === 'facebook') {
    if (!env.FACEBOOK_PAGE_ID || !env.FACEBOOK_PAGE_ACCESS_TOKEN) return null;
    if (!/^\d+$/.test(env.FACEBOOK_PAGE_ID)) throw new Error('Invalid page ID');
    const url = new URL('https://graph.facebook.com/' + graphVersion(env.META_API_VERSION) + '/' + env.FACEBOOK_PAGE_ID + '/posts');
    url.searchParams.set('fields', 'id,message,created_time,permalink_url,full_picture');
    url.searchParams.set('limit', '5');
    const data = await request(url, env.FACEBOOK_PAGE_ACCESS_TOKEN, {}, fetcher);
    if (!Array.isArray(data.data)) throw new Error('Invalid Facebook response');
    return data.data.map(post => ({ id: post.id, url: post.permalink_url, caption: post.message,
      publishedAt: post.created_time, image: post.full_picture }));
  }
  if (!env.TIKTOK_ACCESS_TOKEN) return null;
  const url = new URL('https://open.tiktokapis.com/v2/video/list/');
  url.searchParams.set('fields', 'id,title,video_description,share_url,create_time,cover_image_url');
  const data = await request(url, env.TIKTOK_ACCESS_TOKEN, { method: 'POST', body: JSON.stringify({ max_count: 5 }) }, fetcher);
  if (!Array.isArray(data.data?.videos)) throw new Error('Invalid TikTok response');
  return data.data.videos.map(post => ({ id: post.id, url: post.share_url,
    caption: post.video_description || post.title, publishedAt: new Date(post.create_time * 1000).toISOString(), image: post.cover_image_url }));
}

export async function syncFeed(previous, env = process.env, fetcher = fetch, now = new Date().toISOString()) {
  const feed = { version: 1, networks: {} };
  const failures = [];
  let connected = 0;
  for (const network of ['instagram', 'facebook', 'tiktok']) {
    const old = previous.networks?.[network] || { updatedAt: null, posts: [] };
    try {
      const posts = await collect(network, env, fetcher);
      if (posts === null) {
        feed.networks[network] = { ...old, posts: latestPosts(network, old.posts), status: old.posts?.length ? 'stale' : 'not_connected' };
      } else {
        // Do not overwrite a good feed with unusable API data.
        const normalized = latestPosts(network, posts);
        if (posts.length && !normalized.length) throw new Error('No valid public posts');
        feed.networks[network] = { status: 'ready', updatedAt: now, posts: normalized };
        connected++;
      }
    } catch {
      feed.networks[network] = { ...old, posts: latestPosts(network, old.posts), status: 'stale' };
      failures.push(network);
    }
  }
  return { feed, failures, connected };
}

async function main() {
  const file = new URL('../data/social-feed.json', import.meta.url);
  const previous = JSON.parse(await readFile(file, 'utf8'));
  const { feed, failures, connected } = await syncFeed(previous);
  const temporary = new URL('../data/social-feed.json.tmp', import.meta.url);
  await writeFile(temporary, JSON.stringify(feed, null, 2) + '\n');
  await rename(temporary, file);
  console.log('Social feeds updated: ' + connected + '/3.');
  for (const network of failures) console.log('::warning::' + network + ': sync failed; retained last available posts. Check account authorization.');
  if (!connected && !failures.length) console.log('::warning::No social accounts configured. Add repository secrets as described in docs/social-feed.md.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
