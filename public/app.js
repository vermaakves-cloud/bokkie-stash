'use strict';

const LOCAL_AGENT = 'http://127.0.0.1:17326';
const BASE = window.location.pathname.indexOf('/vault') === 0 ? '/vault' : '';
const urlKey = new URLSearchParams(window.location.search).get('key') || '';
if (urlKey) localStorage.setItem('bokkie_stash_key', urlKey.trim());
const state = { tree: [], items: [], catId: null, subId: null, folderName: 'Quick Drop Inbox (Default)', status: '', q: '', key: localStorage.getItem('bokkie_stash_key') || '', isOwner: false };
const el = (id) => document.getElementById(id);
const on = (id, ev, fn) => { const n = el(id); if (n) n.addEventListener(ev, fn); };

function h(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => {
    if (k === 'className') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v !== undefined && v !== null) node.setAttribute(k, String(v));
  });
  children.filter(Boolean).forEach((c) => node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
  return node;
}

function syncZeroStoreLinks() {
  const kp = state.key ? '&key=' + encodeURIComponent(state.key) : '';
  const rootUrl = window.location.origin + BASE;
  if (el('bookmarkletLink')) el('bookmarkletLink').href = "javascript:(function(){var w=430,h=380,l=Math.round((screen.width-w)/2),t=Math.round((screen.height-h)/2);window.open('" + rootUrl + "/quick?url='+encodeURIComponent(location.href)+'&title='+encodeURIComponent(document.title)+'" + kp + "','bs_quick','width='+w+',height='+h+',left='+l+',top='+t);})();";
  let mf = document.querySelector('link[rel="manifest"]');
  if (!mf) { mf = document.createElement('link'); mf.rel = 'manifest'; document.head.appendChild(mf); }
  mf.href = BASE + '/manifest.webmanifest' + (state.key ? '?key=' + encodeURIComponent(state.key) : '');
}

function showToast(msg) {
  const t = el('toastMsg'); if (!t) return;
  t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(showToast.tm); showToast.tm = setTimeout(() => t.classList.add('hidden'), 3400);
}

async function api(p, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (state.key) headers['X-Stash-Key'] = state.key;
  const res = await fetch(BASE + p, { ...opts, headers });
  const data = await res.json();
  if (!res.ok || !data.ok) throw new Error(data.error || ('HTTP ' + res.status));
  return data;
}

function extractUrls(raw) {
  return [...new Set(String(raw || '').split(/[\r\n\s]+/).map((s) => s.trim()).map((s) => (/^https?:\/\//i.test(s) ? s : (/^[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(s) ? 'https://' + s : ''))).filter(Boolean))];
}

async function saveUrls(urls, notes, catId, subId, label) {
  if (!urls.length) return showToast('Paste or drop a valid link first (e.g. https://youtube.com/...)');
  showToast('Saving ' + urls.length + ' link(s) to ' + label + '...');
  const out = await api('/api/items', { method: 'POST', body: JSON.stringify({ urls, notes: notes || '', categoryId: catId, subsectionId: subId }) });
  state.tree = out.tree; await refreshView(); showToast('Saved ' + out.count + ' link(s) into ' + label + '!');
}

function bindDropTarget(node, catId, subId, label) {
  if (!node) return;
  node.addEventListener('dragover', (e) => { e.preventDefault(); node.classList.add('drop-hover'); });
  node.addEventListener('dragleave', () => node.classList.remove('drop-hover'));
  node.addEventListener('drop', async (e) => {
    e.preventDefault(); e.stopPropagation(); node.classList.remove('drop-hover');
    const cardId = Number(e.dataTransfer.getData('application/x-stash-card') || 0);
    try {
      if (cardId) { const out = await api('/api/items/' + cardId, { method: 'PATCH', body: JSON.stringify({ categoryId: catId || state.catId || 1, subsectionId: subId || null }) }); state.tree = out.tree; await refreshView(); showToast('Moved card to ' + label); }
      else { await saveUrls(extractUrls(e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain')), '', catId || state.catId, subId !== undefined ? subId : state.subId, label || state.folderName); }
    } catch (err) { showToast('Error: ' + err.message); }
  });
}

function renderSidebar() {
  el('totalCountBadge').textContent = String(state.tree.reduce((s, c) => s + Number(c.item_count || 0), 0));
  el('allItemsBtn').classList.toggle('active', !state.catId && !state.subId);
  el('targetFolderLabel').textContent = state.folderName;
  const nav = el('categoryTree'); nav.innerHTML = '';
  state.tree.forEach((cat) => {
    const cBtn = h('button', { type: 'button', className: 'cat-row' + (state.catId === cat.id && !state.subId ? ' active' : ''), onClick: () => { state.catId = cat.id; state.subId = null; state.folderName = cat.name; el('activeHeading').textContent = cat.name; refreshView(); } },
      [h('span', {}, [h('span', { className: 'cat-icon', text: cat.icon }), h('span', { text: cat.name })]), h('span', { className: 'count-pill', text: String(cat.item_count || 0) })]);
    bindDropTarget(cBtn, cat.id, null, cat.name);
    const subs = (cat.subsections || []).map((sub) => {
      const label = cat.name + ' / ' + sub.name;
      const sBtn = h('button', { type: 'button', className: 'sub-row' + (state.subId === sub.id ? ' active' : ''), onClick: () => { state.catId = cat.id; state.subId = sub.id; state.folderName = label; el('activeHeading').textContent = label; refreshView(); } },
        [h('span', { text: sub.name }), h('span', { className: 'count-pill', text: String(sub.item_count || 0) })]);
      bindDropTarget(sBtn, cat.id, sub.id, label); return sBtn;
    });
    nav.appendChild(h('div', { className: 'cat-group' }, [cBtn, subs.length ? h('div', { className: 'sub-list' }, subs) : null]));
  });
}

function renderCards() {
  el('itemCountBadge').textContent = state.items.length + ' items';
  const grid = el('cardsGrid'); grid.innerHTML = '';
  state.items.forEach((item) => {
    const a = item.attributes || {}, loc = item.category_name + (item.subsection_name ? ' / ' + item.subsection_name : '');
    const thumb = h('div', { className: 'card-thumb' }, [a.thumbnail ? h('img', { src: a.thumbnail, alt: item.title, loading: 'lazy' }) : h('span', { className: 'muted', text: a.domain || '[LINK]' }), h('span', { className: 'card-badge', text: a.badge || '[WEB]' }), h('span', { className: 'card-status', text: item.status.toUpperCase() })]);
    const note = h('input', { className: 'card-note', type: 'text', value: item.notes || '', placeholder: 'Type a note & press Enter...', onChange: async (e) => { await api('/api/items/' + item.id, { method: 'PATCH', body: JSON.stringify({ notes: e.target.value }) }); showToast('Note saved'); } });
    const stSel = h('select', { className: 'btn-small', onChange: async (e) => { const out = await api('/api/items/' + item.id, { method: 'PATCH', body: JSON.stringify({ status: e.target.value }) }); state.tree = out.tree; refreshView(); } }, ['unwatched', 'watching', 'done', 'archived'].map((st) => { const o = h('option', { value: st, text: st }); o.selected = item.status === st; return o; }));
    const actions = h('div', { className: 'card-actions' }, [
      a.embed_url ? h('button', { type: 'button', className: 'btn btn-small btn-accent', text: '[Play]', onClick: () => { el('modalTitle').textContent = item.title; el('playerFrameWrap').innerHTML = ''; el('playerFrameWrap').appendChild(h('iframe', { src: a.embed_url + '?autoplay=1', allow: 'autoplay; encrypted-media; picture-in-picture', allowfullscreen: 'true' })); el('playerModal').classList.remove('hidden'); } }) : null,
      h('a', { className: 'btn btn-small', href: item.url, target: '_blank', rel: 'noopener', text: '[Open]' }), stSel,
      h('button', { type: 'button', className: 'btn btn-small btn-danger', text: '[Del]', onClick: async () => { const out = await api('/api/items/' + item.id, { method: 'DELETE' }); state.tree = out.tree; refreshView(); } })
    ]);
    grid.appendChild(h('article', { className: 'stash-card', draggable: 'true', onDragstart: (e) => e.dataTransfer.setData('application/x-stash-card', String(item.id)) }, [thumb, h('div', { className: 'card-body' }, [h('a', { className: 'card-title', href: item.url, target: '_blank', rel: 'noopener', text: item.title }), h('div', { className: 'card-meta' }, [h('span', { text: loc }), h('span', { text: a.author || a.domain || '' })]), note, actions])]));
  });
}

async function refreshView() {
  const qs = new URLSearchParams();
  if (state.catId) qs.set('categoryId', String(state.catId));
  if (state.subId) qs.set('subsectionId', String(state.subId));
  if (state.status) qs.set('status', state.status);
  if (state.q) qs.set('q', state.q);
  state.items = (await api('/api/items?' + qs.toString())).items;
  renderSidebar(); renderCards();
}

async function loadSystemPage() {
  try {
    const { vps } = await api('/api/system');
    el('vpsSysBox').innerHTML = '';
    const metrics = vps.isOwner ? [['VPS RAM', vps.mem.availMb + ' / ' + vps.mem.totalMb + ' MB'], ['VPS Swap', vps.mem.swapUsedMb + ' / ' + vps.mem.swapTotalMb + ' MB'], ['Stash Vault', vps.stash.totalItems + ' links (' + vps.stash.dbSizeKb + ' KB)'], ['Public Vaults', ((vps.registry && vps.registry.publicVaults) || 0) + ' active']] : [['Browser RAM Saved', '~' + vps.mem.availMb + ' MB freed'], ['Vault Plan', (vps.tier || 'FREE') + ' (' + vps.stash.totalItems + '/' + vps.maxItems + ')'], ['Vault Footprint', vps.stash.dbSizeKb + ' KB SQLite'], ['Vault Key', state.key || 'Paired']];
    metrics.forEach(([k, v]) => el('vpsSysBox').appendChild(h('div', { className: 'stat-box' }, [h('span', { text: k }), h('strong', { text: v })])));
    el('pm2List').innerHTML = '';
    if (vps.isOwner) (vps.apps || []).forEach((p) => el('pm2List').appendChild(h('div', { className: 'pm2-row' }, [h('span', { text: p.name + ' [' + p.status + ']' }), h('span', { text: p.memMb + ' MB' })])));
    else el('pm2List').appendChild(h('div', { className: 'pm2-row' }, [h('a', { href: BASE + '/dl/linux-flush.sh', style: 'color:var(--accent)', text: '[Download Linux .sh]' }), h('a', { href: BASE + '/dl/windows-flush.ps1', style: 'color:var(--accent)', text: '[Download Windows .ps1]' })]));
  } catch (e) { showToast('Status error: ' + e.message); }
  try { const loc = await (await fetch(LOCAL_AGENT + '/status')).json(); el('localSysBox').textContent = 'Connected — Free RAM: ' + loc.availRam + ' | Swap: ' + loc.swapUsed + ' | /dev/shm: ' + loc.shmUsed; }
  catch (_) { el('localSysBox').textContent = 'Download the Zero-Store Clipboard & SHM Care script or press Ctrl+Alt+C on Linux Mint.'; }
}

async function runLocalFlush(killBloated) {
  try { const r = await (await fetch(LOCAL_AGENT + '/flush', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ killBloated }) })).json(); showToast('Flushed! Avail RAM: ' + r.availRam); loadSystemPage(); }
  catch (_) { window.location.href = BASE + '/dl/linux-flush.sh'; }
}

function switchTab(w) {
  [['Links', 'links'], ['System', 'system'], ['Guide', 'guide']].forEach(([c, id]) => { el('tabBtn' + c).classList.toggle('active', w === id); el('view' + c).classList.toggle('hidden', w !== id); });
  if (w === 'system') loadSystemPage();
}

function initEvents() {
  syncZeroStoreLinks();
  on('bookmarkletLink', 'click', (e) => { e.preventDefault(); showToast('Drag this green pill up onto your Chrome Bookmarks Bar!'); });
  [['tabBtnLinks', 'links'], ['tabBtnSystem', 'system'], ['tabBtnGuide', 'guide']].forEach(([id, tab]) => on(id, 'click', () => switchTab(tab)));
  on('btnToggleTips', 'click', () => { document.body.classList.toggle('help-pulse'); el('tipsBanner').classList.toggle('hidden'); });
  on('btnCloseTips', 'click', () => { document.body.classList.remove('help-pulse'); el('tipsBanner').classList.add('hidden'); });
  document.addEventListener('mouseover', (e) => { const b = e.target.closest('.help-btn'); if (!b) return; const r = b.getBoundingClientRect(), bub = el('helpBubble'); bub.textContent = b.dataset.tip; bub.classList.remove('hidden'); bub.style.top = Math.min(window.innerHeight - 110, r.bottom + 8) + 'px'; bub.style.left = Math.max(10, Math.min(window.innerWidth - 330, r.left - 40)) + 'px'; });
  document.addEventListener('mouseout', (e) => { if (e.target.closest('.help-btn')) el('helpBubble').classList.add('hidden'); });
  document.addEventListener('click', (e) => { const b = e.target.closest('.help-btn'); if (b) { e.preventDefault(); e.stopPropagation(); showToast(b.dataset.tip); } });
  bindDropTarget(el('globalDropzone'), null, undefined, '');
  on('allItemsBtn', 'click', () => { state.catId = null; state.subId = null; state.folderName = 'Quick Drop Inbox (Default)'; el('activeHeading').textContent = 'All Active Links'; refreshView(); });
  on('quickSaveForm', 'submit', async (e) => { e.preventDefault(); try { await saveUrls(extractUrls(el('quickUrlInput').value), el('quickNotesInput').value.trim(), state.catId, state.subId, state.folderName); el('quickUrlInput').value = ''; el('quickNotesInput').value = ''; } catch (err) { showToast('Error: ' + err.message); } });
  on('btnPasteSave', 'click', async () => { try { await saveUrls(extractUrls(await navigator.clipboard.readText()), el('quickNotesInput').value.trim(), state.catId, state.subId, state.folderName); } catch (_) { const m = prompt('Paste link here:'); if (m) await saveUrls(extractUrls(m), '', state.catId, state.subId, state.folderName); } });
  on('statusFilter', 'change', (e) => { state.status = e.target.value; refreshView(); });
  on('searchInput', 'input', (e) => { state.q = e.target.value.trim(); clearTimeout(initEvents.t); initEvents.t = setTimeout(refreshView, 220); });
  on('btnCloseModal', 'click', () => { el('playerFrameWrap').innerHTML = ''; el('playerModal').classList.add('hidden'); });
  on('addSubForm', 'submit', async (e) => { e.preventDefault(); const out = await api('/api/subsections', { method: 'POST', body: JSON.stringify({ categoryId: state.catId || 1, name: el('newSubName').value.trim() }) }); el('newSubName').value = ''; state.tree = out.tree; renderSidebar(); showToast('Sub-folder created'); });
  on('btnAddCat', 'click', async () => { const n = prompt('New main category name:'); if (n && n.trim()) { const out = await api('/api/categories', { method: 'POST', body: JSON.stringify({ name: n.trim(), icon: '[DIR]' }) }); state.tree = out.tree; renderSidebar(); showToast('Category created'); } });
  on('btnRefreshSys', 'click', loadSystemPage); on('btnFlushClip', 'click', () => runLocalFlush(false)); on('btnFlushBloated', 'click', () => runLocalFlush(true));
}

initEvents();
api('/api/bootstrap').then(async (d) => {
  if (d.needsVault) {
    const existing = prompt('Welcome to MyMmark Stash! Paste an existing Vault Key (BS-...) or leave blank to create a FREE Private Vault now:');
    if (existing && existing.trim()) { state.key = existing.trim(); localStorage.setItem('bokkie_stash_key', state.key); }
    else { const c = await api('/api/vaults', { method: 'POST', body: JSON.stringify({ label: 'My Stash Vault' }) }); state.key = c.vault.vaultKey; localStorage.setItem('bokkie_stash_key', state.key); alert('Save your Private Vault Key: ' + state.key); }
    syncZeroStoreLinks(); d = await api('/api/bootstrap');
  }
  state.isOwner = Boolean(d.vault && d.vault.isOwner); state.tree = d.tree; state.items = d.items; renderSidebar(); renderCards();
}).catch((e) => showToast('Init error: ' + e.message));
