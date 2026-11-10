'use strict';

const http = require('node:http');
const https = require('node:https');

function isBlockedHost(hostname) {
  const h = String(hostname || '').toLowerCase();
  if (!h || h === 'localhost' || h === '::1' || h === '[::1]' || h === '0.0.0.0') return true;
  if (/^(127\.|10\.|192\.168\.|169\.254\.)/.test(h)) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(h)) return true;
  return false;
}

function extractYouTubeId(u) {
  const host = u.hostname.replace(/^www\./, '').toLowerCase();
  let id = '';
  if (host === 'youtu.be') id = u.pathname.split('/').filter(Boolean)[0] || '';
  else if (host.endsWith('youtube.com')) {
    if (u.pathname === '/watch') id = u.searchParams.get('v') || '';
    else {
      const m = u.pathname.match(/^\/(shorts|embed|live)\/([A-Za-z0-9_-]{6,15})/);
      if (m) id = m[2];
    }
  }
  return /^[A-Za-z0-9_-]{6,15}$/.test(id) ? id : '';
}

function detectBadge(hostname, ytId) {
  if (ytId) return '[YT]';
  const h = hostname.replace(/^www\./, '').toLowerCase();
  if (h.includes('vimeo.com')) return '[VIMEO]';
  if (/(tiktok|instagram|facebook|twitter|x\.com|reddit|linkedin|threads)/.test(h)) return '[SOCIAL]';
  if (/(imdb|letterboxd|netflix|plex|justwatch|primevideo)/.test(h)) return '[FILM]';
  return '[WEB]';
}

function decodeEntities(str) {
  return String(str || '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;|&#x27;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, ' ')
    .trim();
}

function fetchLimited(targetUrl, maxBytes = 49152, timeoutMs = 4000, redirects = 3) {
  return new Promise((resolve, reject) => {
    let parsed;
    try { parsed = new URL(targetUrl); } catch (e) { return reject(e); }
    if (!['http:', 'https:'].includes(parsed.protocol) || isBlockedHost(parsed.hostname)) {
      return reject(new Error('Blocked or unsupported URL'));
    }
    const client = parsed.protocol === 'https:' ? https : http;
    const req = client.get(parsed, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BokkieStash/1.0)', 'Accept': 'text/html,application/json;q=0.9,*/*;q=0.5' },
      timeout: timeoutMs
    }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects > 0) {
        res.resume();
        const nextUrl = new URL(res.headers.location, parsed).href;
        return resolve(fetchLimited(nextUrl, maxBytes, timeoutMs, redirects - 1));
      }
      if (res.statusCode < 200 || res.statusCode >= 400) {
        res.resume();
        return reject(new Error('HTTP ' + res.statusCode));
      }
      const chunks = [];
      let total = 0;
      res.on('data', (chunk) => {
        chunks.push(chunk);
        total += chunk.length;
        if (total >= maxBytes) res.destroy();
      });
      res.on('close', () => resolve(Buffer.concat(chunks).toString('utf8')));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      res.on('error', () => resolve(Buffer.concat(chunks).toString('utf8')));
    });
    req.on('timeout', () => { req.destroy(new Error('Timeout')); });
    req.on('error', reject);
  });
}

function matchMeta(html, key) {
  const re1 = new RegExp('<meta[^>]+(?:property|name)=["\']' + key + '["\'][^>]+content=["\']([^"\']+)["\']', 'i');
  const re2 = new RegExp('<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property|name)=["\']' + key + '["\']', 'i');
  const m = html.match(re1) || html.match(re2);
  return m ? decodeEntities(m[1]) : '';
}

async function enrichUrl(rawUrl) {
  const parsed = new URL(String(rawUrl).trim());
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Only http/https links supported');
  const domain = parsed.hostname.replace(/^www\./, '');
  const ytId = extractYouTubeId(parsed);
  const badge = detectBadge(domain, ytId);
  const base = { title: domain + parsed.pathname, attributes: { domain, badge, thumbnail: '', author: '', embed_url: '' } };

  if (ytId) {
    base.attributes.thumbnail = 'https://i.ytimg.com/vi/' + ytId + '/hqdefault.jpg';
    base.attributes.embed_url = 'https://www.youtube-nocookie.com/embed/' + ytId;
    try {
      const raw = await fetchLimited('https://www.youtube.com/oembed?url=' + encodeURIComponent(parsed.href) + '&format=json', 16384, 3500, 2);
      const data = JSON.parse(raw);
      if (data.title) base.title = data.title;
      if (data.author_name) base.attributes.author = data.author_name;
    } catch (_) {}
    return base;
  }

  try {
    const html = await fetchLimited(parsed.href);
    const ogTitle = matchMeta(html, 'og:title') || matchMeta(html, 'twitter:title');
    const tagTitle = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '';
    const title = ogTitle || decodeEntities(tagTitle);
    if (title) base.title = title.slice(0, 240);
    const img = matchMeta(html, 'og:image') || matchMeta(html, 'twitter:image');
    if (img) base.attributes.thumbnail = new URL(img, parsed.href).href;
    base.attributes.author = matchMeta(html, 'og:site_name') || domain;
  } catch (_) {}
  return base;
}

module.exports = { enrichUrl, extractYouTubeId, detectBadge };
