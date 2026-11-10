'use strict';

const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const db = require('./db');
const vaults = require('./vaults');
const distro = require('./distro');
const { enrichUrl } = require('./metadata');

const PORT = Number(process.env.PORT || 3026);
const HOST = process.env.HOST || '127.0.0.1';
const PUBLIC_DIR = path.join(__dirname, 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };

function sendJson(res, code, payload) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type,X-Stash-Key' });
  res.end(JSON.stringify(payload));
}

function sendDownload(res, filename, type, content) {
  res.writeHead(200, { 'Content-Type': type, 'Content-Disposition': 'attachment; filename="' + filename + '"', 'Cache-Control': 'no-store' });
  res.end(content);
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', (c) => { size += c.length; if (size > 1048576) { req.destroy(); reject(new Error('Payload too large')); } else chunks.push(c); });
    req.on('end', () => { try { const r = Buffer.concat(chunks).toString('utf8').trim(); resolve(r ? JSON.parse(r) : {}); } catch (_) { reject(new Error('Invalid JSON')); } });
    req.on('error', reject);
  });
}

function normalizeUrl(raw) {
  const s = String(raw || '').trim();
  return /^https?:\/\//i.test(s) ? s : (/^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(s) ? 'https://' + s : '');
}

function getOrigin(req) {
  if (req.headers['x-stash-base']) return String(req.headers['x-stash-base']).replace(/\/+$/, '');
  const host = String(req.headers.host || 'stash.mymark.co.za');
  const proto = req.headers['x-forwarded-proto'] || (host.includes('127.0.0.1') || host.includes('localhost') ? 'http' : 'https');
  return proto + '://' + host;
}

function resolveReqVault(req, u) {
  const key = String(req.headers['x-stash-key'] || u.searchParams.get('key') || '').trim();
  if (key) return vaults.resolveVault(key, false);
  const host = String(req.headers.host || '').toLowerCase();
  return (host.startsWith('stash.bokkie.online') || host.startsWith('127.0.0.1') || host.startsWith('localhost')) ? vaults.resolveVault('', true) : null;
}

async function ingestOne(store, entry, categoryId, subsectionId, sharedNotes) {
  const rawUrl = normalizeUrl(typeof entry === 'string' ? entry : (entry && entry.url));
  if (!rawUrl) throw new Error('Invalid URL');
  const meta = await enrichUrl(rawUrl);
  const customTitle = (typeof entry === 'object' && entry && entry.title) ? String(entry.title).trim() : '';
  return store.createItem({ categoryId, subsectionId, url: rawUrl, title: customTitle || meta.title, notes: (typeof entry === 'object' && entry && entry.notes) ? entry.notes : (sharedNotes || ''), attributes: meta.attributes });
}

function buildSystemStatus(vault, store) {
  const stash = store.getStats();
  if (!vault.isOwner) return { hostname: 'MyMmark Vault Cloud', uptimeHrs: 99.9, load: [0], mem: { availMb: stash.totalItems * 145, totalMb: vault.maxItems * 145, swapUsedMb: 0, swapTotalMb: 0 }, apps: [], stash, tier: vault.tier, maxItems: vault.maxItems, isOwner: false };
  let mem = {}, apps = [];
  try { const l = execFileSync('free', ['-m'], { encoding: 'utf8' }).trim().split(/\r?\n/), m = (l[1] || '').split(/\s+/), s = (l[2] || '').split(/\s+/); mem = { totalMb: Number(m[1] || 0), usedMb: Number(m[2] || 0), availMb: Number(m[6] || 0), swapTotalMb: Number(s[1] || 0), swapUsedMb: Number(s[2] || 0) }; } catch (_) {}
  try { apps = JSON.parse(execFileSync('pm2', ['jlist'], { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 })).map((p) => ({ name: p.name, status: p.pm2_env && p.pm2_env.status, memMb: Math.round(((p.monit && p.monit.memory) || 0) / 1048576) })); } catch (_) {}
  return { hostname: os.hostname(), uptimeHrs: Math.round(os.uptime() / 360) / 10, load: os.loadavg().map((n) => Number(n.toFixed(2))), mem, apps, stash, registry: vaults.getRegistryStats(), isOwner: true };
}

function serveQuickSave(res) {
  const html = [
    '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>1-Click Stash</title>',
    '<style>body{background:#0b0f17;color:#e6edf7;font-family:system-ui,sans-serif;padding:16px;margin:0}select,input,button{width:100%;padding:9px;margin-top:8px;border-radius:6px;border:1px solid #25324a;background:#121926;color:#fff;box-sizing:border-box}button{background:#10b981;color:#04120c;font-weight:700;cursor:pointer;border:0;margin-top:12px}.msg{margin-top:10px;color:#10b981;font-weight:600;text-align:center}</style></head><body>',
    '<strong style="color:#10b981">[STASH THIS PAGE]</strong><div id="t" style="font-size:13px;margin:6px 0;color:#8b9bb4"></div><select id="cat"></select><select id="sub"></select><input id="note" placeholder="Optional note..."><button id="go">Save Now & Close</button><div id="m" class="msg"></div>',
    '<script>const B=location.pathname.indexOf("/vault")===0?"/vault":"",q=new URLSearchParams(location.search),txt=q.get("text")||"",um=txt.match(/https?:\\/\\/[^\\s]+/i),u=q.get("url")||(um?um[0]:""),ti=q.get("title")||u,vk=q.get("key")||localStorage.getItem("bokkie_stash_key")||"";if(vk)localStorage.setItem("bokkie_stash_key",vk);document.getElementById("t").textContent=ti;let tree=[];',
    'const hdr=()=>vk?{"Content-Type":"application/json","X-Stash-Key":vk}:{"Content-Type":"application/json"};',
    'function fillSub(sv){const c=tree.find(x=>x.id==document.getElementById("cat").value),s=document.getElementById("sub");s.innerHTML="<option value=\'\'>-- Folder Root --</option>";((c&&c.subsections)||[]).forEach(x=>{const o=new Option(x.name,x.id);if(sv==x.id)o.selected=true;s.add(o);});}',
    'fetch(B+"/api/bootstrap",{headers:hdr()}).then(r=>r.json()).then(d=>{tree=d.tree||[];const cs=document.getElementById("cat"),lc=localStorage.getItem("bs_cat"),ls=localStorage.getItem("bs_sub");tree.forEach(c=>{const o=new Option(c.icon+" "+c.name,c.id);if(lc==c.id)o.selected=true;cs.add(o);});fillSub(ls);cs.onchange=()=>fillSub("");});',
    'document.getElementById("go").onclick=async()=>{const c=document.getElementById("cat").value,s=document.getElementById("sub").value;localStorage.setItem("bs_cat",c);localStorage.setItem("bs_sub",s);document.getElementById("m").textContent="Saving...";',
    'const r=await fetch(B+"/api/items",{method:"POST",headers:hdr(),body:JSON.stringify({items:[{url:u,title:ti}],categoryId:Number(c)||null,subsectionId:Number(s)||null,notes:document.getElementById("note").value})});const j=await r.json();',
    'if(j.ok&&j.count>0){document.getElementById("m").textContent="Saved! Closing...";setTimeout(()=>window.close(),650);}else{document.getElementById("m").textContent="Error: "+(j.error||"Check URL");}};</script></body></html>'
  ].join('\n');
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(html);
}

async function handleApi(req, res, u) {
  if (req.method === 'OPTIONS') return sendJson(res, 200, { ok: true });
  const origin = getOrigin(req);
  if (req.method === 'GET' && u.pathname === '/api/health') return sendJson(res, 200, { ok: true, service: 'bokkie-stash', port: PORT, registry: vaults.getRegistryStats() });
  if (req.method === 'POST' && u.pathname === '/api/vaults') {
    const v = vaults.createPublicVault((await readJson(req)).label);
    db.forPath(v.dbPath);
    return sendJson(res, 201, { ok: true, vault: { vaultKey: v.vaultKey, label: v.label, tier: v.tier, maxItems: v.maxItems }, distro: { appUrl: origin + '/app?key=' + v.vaultKey, bookmarklet: distro.buildBookmarklet(origin, v.vaultKey), manifestUrl: origin + '/manifest.webmanifest?key=' + v.vaultKey, extScriptUrl: origin + '/dl/install-chrome-saver.sh?key=' + v.vaultKey, linuxFlushUrl: origin + '/dl/linux-flush.sh', winFlushUrl: origin + '/dl/windows-flush.ps1' } });
  }
  const vault = resolveReqVault(req, u);
  if (!vault) return (req.method === 'GET' && u.pathname === '/api/bootstrap') ? sendJson(res, 200, { ok: true, needsVault: true, tree: [], items: [] }) : sendJson(res, 401, { ok: false, error: 'Valid Vault Key required.' });
  const store = db.forPath(vault.dbPath);
  if (req.method === 'GET' && u.pathname === '/api/system') return sendJson(res, 200, { ok: true, vps: buildSystemStatus(vault, store) });
  if (req.method === 'GET' && u.pathname === '/api/bootstrap') return sendJson(res, 200, { ok: true, vault: { vaultKey: vault.isOwner ? '' : vault.vaultKey, label: vault.label, tier: vault.tier, maxItems: vault.maxItems, isOwner: vault.isOwner }, tree: store.getTree(), items: store.listItems({}) });
  if (req.method === 'GET' && u.pathname === '/api/items') return sendJson(res, 200, { ok: true, items: store.listItems({ categoryId: u.searchParams.get('categoryId'), subsectionId: u.searchParams.get('subsectionId'), status: u.searchParams.get('status'), q: u.searchParams.get('q') }) });
  if (req.method === 'POST' && u.pathname === '/api/items') {
    if (store.getStats().totalItems >= vault.maxItems) return sendJson(res, 403, { ok: false, error: 'Free vault limit (' + vault.maxItems + ') reached. Upgrade to Pro for unlimited links.' });
    const b = await readJson(req), list = Array.isArray(b.items) ? b.items : (Array.isArray(b.urls) ? b.urls : [b]), created = [], errors = [];
    for (let i = 0; i < list.length; i += 4) {
      const out = await Promise.all(list.slice(i, i + 4).map((e) => ingestOne(store, e, b.categoryId, b.subsectionId, b.notes).catch((err) => { errors.push(err.message); return null; })));
      out.forEach((row) => { if (row) created.push(row); });
    }
    return created.length ? sendJson(res, 201, { ok: true, count: created.length, items: created, tree: store.getTree() }) : sendJson(res, 400, { ok: false, error: errors[0] || 'Paste a valid https:// link' });
  }
  const m = u.pathname.match(/^\/api\/items\/(\d+)$/);
  if (m && req.method === 'PATCH') return sendJson(res, 200, { ok: true, item: store.updateItem(Number(m[1]), await readJson(req)), tree: store.getTree() });
  if (m && req.method === 'DELETE') { store.deleteItem(Number(m[1])); return sendJson(res, 200, { ok: true, tree: store.getTree() }); }
  if (req.method === 'POST' && u.pathname === '/api/categories') { const b = await readJson(req); return b.name ? sendJson(res, 201, { ok: true, category: store.createCategory(b.name, b.icon), tree: store.getTree() }) : sendJson(res, 400, { ok: false, error: 'Name required' }); }
  if (req.method === 'POST' && u.pathname === '/api/subsections') { const b = await readJson(req); return (b.categoryId && b.name) ? sendJson(res, 201, { ok: true, subsection: store.createSubsection(b.categoryId, b.name), tree: store.getTree() }) : sendJson(res, 400, { ok: false, error: 'Category and name required' }); }
  return sendJson(res, 404, { ok: false, error: 'Endpoint not found' });
}

vaults.initVaultRegistry();
db.initDb();
http.createServer((req, res) => {
  const u = new URL(req.url || '/', 'http://127.0.0.1'), origin = getOrigin(req);
  if (u.pathname === '/quick') return serveQuickSave(res);
  if (u.pathname === '/manifest.webmanifest') return sendJson(res, 200, distro.buildPwaManifest(origin, u.searchParams.get('key')));
  if (u.pathname === '/dl/linux-flush.sh') return sendDownload(res, 'mymark-stash-flush.sh', 'text/x-shellscript; charset=utf-8', distro.buildLinuxFlushScript());
  if (u.pathname === '/dl/windows-flush.ps1') return sendDownload(res, 'mymark-stash-flush.ps1', 'text/plain; charset=utf-8', distro.buildWindowsFlushScript());
  if (u.pathname === '/dl/install-chrome-saver.sh') return sendDownload(res, 'install-mymark-stash-ext.sh', 'text/x-shellscript; charset=utf-8', distro.buildExtensionInstaller(origin, u.searchParams.get('key')));
  if (u.pathname.startsWith('/api/')) { handleApi(req, res, u).catch((err) => sendJson(res, 400, { ok: false, error: err.message })); return; }
  const rel = (u.pathname === '/' || u.pathname === '/app' || u.pathname === '/app/') ? '/index.html' : u.pathname;
  const target = path.resolve(PUBLIC_DIR, '.' + rel);
  if (!target.startsWith(PUBLIC_DIR)) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(target, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(target).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(buf);
  });
}).listen(PORT, HOST, () => console.log('[bokkie-stash] listening on http://' + HOST + ':' + PORT));
