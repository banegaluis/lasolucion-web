import { test } from 'node:test';
import assert from 'node:assert/strict';
import { latestPosts, selectedPosts, displayFeed, postUrl, playerUrl } from '../js/social-feed-core.mjs';
import { syncFeed, collect } from './sync-social-feed.mjs';

const post = day => ({ id: String(day), url: 'https://www.instagram.com/p/Test' + day + '/', caption: 'Trabajo', publishedAt: '2026-09-' + String(day).padStart(2, '0') + 'T12:00:00Z' });
test('manual links work without fabricated dates, retain order and limit unique valid posts', () => {
  const items = [null, { url: 'javascript:alert(1)' }, ...[7, 2, 6, 4, 3, 1].map(day => ({ ...post(day), publishedAt: null })), post(7)];
  const selected = selectedPosts('instagram', items);
  assert.deepEqual(selected.map(item => item.id), ['7', '2', '6', '4', '3']);
  assert.ok(selected.every(item => item.publishedAt === null));
});
test('manual fallback survives sync failure, while successful empty automatic feed takes priority', () => {
  const manual = { networks: { instagram: { posts: [{ url: post(1).url }] } } };
  assert.equal(displayFeed(null, manual).networks.instagram.status, 'manual');
  assert.equal(displayFeed({ networks: { instagram: { status: 'stale', posts: [post(2)] } } }, manual).networks.instagram.posts[0].url, post(1).url);
  assert.deepEqual(displayFeed({ networks: { instagram: { status: 'ready', posts: [] } } }, manual).networks.instagram.posts, []);
});
test('keeps only five newest valid unique posts even with unsorted input', () => {
  const posts = [post(2), post(9), post(3), post(7), post(5), post(6), post(4), post(9), { ...post(1), url: 'javascript:alert(1)' }];
  assert.deepEqual(latestPosts('instagram', posts).map(p => p.id), ['9', '7', '6', '5', '4']);
});
test('rejects untrusted destinations and wrong TikTok account', () => {
  assert.equal(postUrl('instagram', 'https://instagram.com.evil.test/p/x/'), null);
  assert.equal(postUrl('tiktok', 'https://www.tiktok.com/@other/video/123'), null);
  assert.equal(postUrl('facebook', 'javascript:alert(1)'), null);
  assert.equal(playerUrl('tiktok', { url: 'https://www.tiktok.com/@lasolucioncba/video/123' }), 'https://www.tiktok.com/player/v1/123?autoplay=0&rel=0');
});
test('failure on one network preserves its feed without blocking the others', async () => {
  const previous = { networks: { instagram: { status: 'ready', updatedAt: 'old', posts: [post(1)] } } };
  const env = { META_API_VERSION: 'v99.0', INSTAGRAM_ACCOUNT_ID: '123', INSTAGRAM_ACCESS_TOKEN: 'private-ig-token', FACEBOOK_PAGE_ID: '456', FACEBOOK_PAGE_ACCESS_TOKEN: 'private-fb-token' };
  const fetcher = async url => String(url).includes('/123/') ? { ok: false, status: 401 } : { ok: true, json: async () => ({ data: [{ id: '456_1', permalink_url: 'https://www.facebook.com/lasolucioncba/posts/1', created_time: '2026-10-01T10:00:00Z', message: 'Nuevo trabajo' }] }) };
  const result = await syncFeed(previous, env, fetcher, 'now');
  assert.equal(result.feed.networks.instagram.status, 'stale');
  assert.equal(result.feed.networks.instagram.posts[0].id, '1');
  assert.equal(result.feed.networks.facebook.status, 'ready');
  assert.equal(result.feed.networks.facebook.posts.length, 1);
  assert.equal(result.feed.networks.tiktok.status, 'not_connected');
  assert.equal(JSON.stringify(result).includes('private-'), false);
});
test('successful empty response removes deleted or unavailable old posts', async () => {
  const result = await syncFeed({ networks: { instagram: { posts: [post(1)] } } }, { META_API_VERSION: 'v99.0', INSTAGRAM_ACCOUNT_ID: '123', INSTAGRAM_ACCESS_TOKEN: 'token' }, async () => ({ ok: true, json: async () => ({ data: [] }) }));
  assert.equal(result.feed.networks.instagram.status, 'ready');
  assert.equal(result.feed.networks.instagram.posts.length, 0);
});
test('TikTok request limits the API response and carries token only in the header', async () => {
  await collect('tiktok', { TIKTOK_ACCESS_TOKEN: 'secret' }, async (url, options) => {
    assert.equal(JSON.parse(options.body).max_count, 5);
    assert.equal(String(url).includes('secret'), false);
    assert.equal(options.headers.Authorization, 'Bearer secret');
    return { ok: true, json: async () => ({ data: { videos: [] }, error: { code: 'ok' } }) };
  });
});
