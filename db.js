'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const DEFAULT_DB = path.join(__dirname, 'data', 'stash.db');
const initialized = new Set();

function sqlStr(v) {
  return "'" + String(v === null || v === undefined ? '' : v).replace(/'/g, "''") + "'";
}

function slugify(text) {
  return String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item-' + Date.now();
}

function execSql(dbPath, sql) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  return execFileSync('sqlite3', [dbPath, 'PRAGMA busy_timeout = 5000;\nPRAGMA foreign_keys = ON;\n' + sql], { encoding: 'utf8' });
}

function queryJson(dbPath, sql) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const out = execFileSync(
    'sqlite3',
    ['-cmd', 'PRAGMA busy_timeout = 5000;', '-cmd', 'PRAGMA foreign_keys = ON;', '-json', dbPath, sql],
    { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 }
  );
  const trimmed = (out || '').trim();
  if (!trimmed) return [];
  const idx = trimmed.lastIndexOf('\n[');
  const chunk = idx !== -1 ? trimmed.slice(idx + 1) : (trimmed.startsWith('[') ? trimmed : '');
  return chunk ? JSON.parse(chunk) : [];
}

function hydrate(row) {
  if (!row) return null;
  let attributes = {};
  try { attributes = JSON.parse(row.attributes_json || '{}'); } catch (_) {}
  return { ...row, attributes };
}

const PUBLIC_SEED = [
  { slug: 'inbox', name: 'Quick Drop Inbox', icon: '[INBOX]', subs: ['Unsorted Drops', 'Window Batch'] },
  { slug: 'video', name: 'Video Platforms', icon: '[VIDEO]', subs: ['Watch Later', 'Tutorials & Tech', 'Music', 'Documentaries'] },
  { slug: 'movies', name: 'Movies & Series', icon: '[FILM]', subs: ['To Watch', 'Series Queue', 'Favorites'] },
  { slug: 'social', name: 'Social Media', icon: '[SOCIAL]', subs: ['Saved Threads', 'Leads & Deals', 'Inspiration'] },
  { slug: 'projects', name: 'Projects', icon: '[PROJ]', subs: ['Active Project', 'Research & Docs', 'Design & Ideas', 'Tools'] }
];

function initDb(dbPath = DEFAULT_DB) {
  if (initialized.has(dbPath) && fs.existsSync(dbPath)) return;
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  execFileSync('sqlite3', [dbPath, 'PRAGMA journal_mode = WAL;'], { encoding: 'utf8' });
  execSql(dbPath, [
    "CREATE TABLE IF NOT EXISTS categories (id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, icon TEXT NOT NULL DEFAULT '[DIR]', sort_order INTEGER NOT NULL DEFAULT 0);",
    'CREATE TABLE IF NOT EXISTS subsections (id INTEGER PRIMARY KEY AUTOINCREMENT, category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE, slug TEXT NOT NULL, name TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0, UNIQUE(category_id, slug));',
    "CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY AUTOINCREMENT, category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE, subsection_id INTEGER REFERENCES subsections(id) ON DELETE SET NULL, url TEXT NOT NULL, title TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'unwatched', attributes_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL DEFAULT (datetime('now')));",
    'CREATE INDEX IF NOT EXISTS idx_items_cat ON items(category_id, subsection_id);',
    'CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);'
  ].join('\n'));

  const hasCats = (queryJson(dbPath, 'SELECT COUNT(*) AS n FROM categories;')[0] || {}).n > 0;
  if (!hasCats) {
    PUBLIC_SEED.forEach((cat, idx) => {
      execSql(dbPath, 'INSERT OR IGNORE INTO categories (slug, name, icon, sort_order) VALUES (' + [sqlStr(cat.slug), sqlStr(cat.name), sqlStr(cat.icon), idx].join(', ') + ');');
      const row = queryJson(dbPath, 'SELECT id FROM categories WHERE slug = ' + sqlStr(cat.slug) + ' LIMIT 1;')[0];
      if (row) {
        cat.subs.forEach((s, sIdx) => execSql(dbPath, 'INSERT OR IGNORE INTO subsections (category_id, slug, name, sort_order) VALUES (' + [row.id, sqlStr(slugify(s)), sqlStr(s), sIdx].join(', ') + ');'));
      }
    });
  }
  initialized.add(dbPath);
}

function forPath(dbPath = DEFAULT_DB) {
  initDb(dbPath);
  return {
    getTree() {
      const cats = queryJson(dbPath, "SELECT c.*, (SELECT COUNT(*) FROM items i WHERE i.category_id = c.id AND i.status != 'archived') AS item_count FROM categories c ORDER BY c.sort_order, c.id;");
      const subs = queryJson(dbPath, "SELECT s.*, (SELECT COUNT(*) FROM items i WHERE i.subsection_id = s.id AND i.status != 'archived') AS item_count FROM subsections s ORDER BY s.sort_order, s.id;");
      return cats.map((c) => ({ ...c, subsections: subs.filter((s) => s.category_id === c.id) }));
    },
    listItems(filters = {}) {
      const conds = ['1=1'];
      if (filters.categoryId) conds.push('i.category_id = ' + Number(filters.categoryId));
      if (filters.subsectionId) conds.push('i.subsection_id = ' + Number(filters.subsectionId));
      if (filters.status && filters.status !== 'all') conds.push('i.status = ' + sqlStr(filters.status));
      else if (!filters.status) conds.push("i.status != 'archived'");
      if (filters.q) {
        const like = sqlStr('%' + String(filters.q) + '%');
        conds.push('(i.title LIKE ' + like + ' OR i.url LIKE ' + like + ' OR i.notes LIKE ' + like + ')');
      }
      return queryJson(dbPath, 'SELECT i.*, c.name AS category_name, s.name AS subsection_name FROM items i JOIN categories c ON c.id = i.category_id LEFT JOIN subsections s ON s.id = i.subsection_id WHERE ' + conds.join(' AND ') + ' ORDER BY i.id DESC LIMIT 300;').map(hydrate);
    },
    createItem(data) {
      let catId = Number(data.categoryId) || 0;
      if (!catId) catId = ((queryJson(dbPath, "SELECT id FROM categories WHERE slug = 'inbox' LIMIT 1;")[0] || {}).id) || 1;
      const subSql = Number(data.subsectionId) > 0 ? String(Number(data.subsectionId)) : 'NULL';
      const sql = 'INSERT INTO items (category_id, subsection_id, url, title, notes, status, attributes_json) VALUES (' +
        [catId, subSql, sqlStr(data.url), sqlStr(data.title || data.url), sqlStr(data.notes || ''), sqlStr(data.status || 'unwatched'), sqlStr(JSON.stringify(data.attributes || {}))].join(', ') +
        '); SELECT i.*, c.name AS category_name, s.name AS subsection_name FROM items i JOIN categories c ON c.id = i.category_id LEFT JOIN subsections s ON s.id = i.subsection_id WHERE i.id = last_insert_rowid();';
      return hydrate(queryJson(dbPath, sql)[0]);
    },
    updateItem(id, patch) {
      const sets = [];
      if (patch.categoryId !== undefined) sets.push('category_id = ' + Number(patch.categoryId));
      if (patch.subsectionId !== undefined) sets.push('subsection_id = ' + (Number(patch.subsectionId) > 0 ? Number(patch.subsectionId) : 'NULL'));
      if (patch.title !== undefined) sets.push('title = ' + sqlStr(patch.title));
      if (patch.notes !== undefined) sets.push('notes = ' + sqlStr(patch.notes));
      if (patch.status !== undefined) sets.push('status = ' + sqlStr(patch.status));
      if (!sets.length) return null;
      return hydrate(queryJson(dbPath, 'UPDATE items SET ' + sets.join(', ') + ' WHERE id = ' + Number(id) + '; SELECT i.*, c.name AS category_name, s.name AS subsection_name FROM items i JOIN categories c ON c.id = i.category_id LEFT JOIN subsections s ON s.id = i.subsection_id WHERE i.id = ' + Number(id) + ';')[0]);
    },
    deleteItem(id) { execSql(dbPath, 'DELETE FROM items WHERE id = ' + Number(id) + ';'); },
    createCategory(name, icon) {
      const slug = slugify(name);
      execSql(dbPath, 'INSERT OR IGNORE INTO categories (slug, name, icon, sort_order) VALUES (' + [sqlStr(slug), sqlStr(name), sqlStr(icon || '[DIR]'), 99].join(', ') + ');');
      return queryJson(dbPath, 'SELECT * FROM categories WHERE slug = ' + sqlStr(slug) + ' LIMIT 1;')[0] || null;
    },
    createSubsection(categoryId, name) {
      const catId = Number(categoryId), slug = slugify(name);
      execSql(dbPath, 'INSERT OR IGNORE INTO subsections (category_id, slug, name, sort_order) VALUES (' + [catId, sqlStr(slug), sqlStr(name), 99].join(', ') + ');');
      return queryJson(dbPath, 'SELECT * FROM subsections WHERE category_id = ' + catId + ' AND slug = ' + sqlStr(slug) + ' LIMIT 1;')[0] || null;
    },
    getStats() {
      const row = queryJson(dbPath, "SELECT COUNT(*) AS total, SUM(CASE WHEN status='unwatched' THEN 1 ELSE 0 END) AS unwatched FROM items;")[0] || {};
      let dbKb = 0;
      try { dbKb = Math.round(fs.statSync(dbPath).size / 1024); } catch (_) {}
      return { totalItems: Number(row.total || 0), unwatchedItems: Number(row.unwatched || 0), dbSizeKb: dbKb };
    }
  };
}

module.exports = { initDb, forPath };
