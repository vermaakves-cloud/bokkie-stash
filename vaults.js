'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const DATA_DIR = path.join(__dirname, 'data');
const VAULTS_DIR = path.join(DATA_DIR, 'vaults');
const REG_DB = path.join(DATA_DIR, 'registry.db');
const OWNER_DB = path.join(DATA_DIR, 'stash.db');
const ENV_PATH = path.join(__dirname, '.env');

function sqlStr(v) {
  return "'" + String(v === null || v === undefined ? '' : v).replace(/'/g, "''") + "'";
}

function execReg(sql) {
  fs.mkdirSync(VAULTS_DIR, { recursive: true });
  return execFileSync('sqlite3', [REG_DB, 'PRAGMA busy_timeout = 5000;\nPRAGMA foreign_keys = ON;\n' + sql], { encoding: 'utf8' });
}

function queryReg(sql) {
  fs.mkdirSync(VAULTS_DIR, { recursive: true });
  const out = execFileSync(
    'sqlite3',
    ['-cmd', 'PRAGMA busy_timeout = 5000;', '-cmd', 'PRAGMA foreign_keys = ON;', '-json', REG_DB, sql],
    { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }
  );
  const trimmed = (out || '').trim();
  if (!trimmed) return [];
  const idx = trimmed.lastIndexOf('\n[');
  const chunk = idx !== -1 ? trimmed.slice(idx + 1) : (trimmed.startsWith('[') ? trimmed : '');
  return chunk ? JSON.parse(chunk) : [];
}

function generateVaultKey(prefix = 'BS') {
  const raw = crypto.randomBytes(9).toString('hex').toUpperCase();
  return prefix + '-' + raw.slice(0, 4) + '-' + raw.slice(4, 8) + '-' + raw.slice(8, 12);
}

function ensureOwnerEnvKey() {
  let envRaw = '';
  try { envRaw = fs.readFileSync(ENV_PATH, 'utf8'); } catch (_) {}
  const match = envRaw.match(/^OWNER_VAULT_KEY=(.+)$/m);
  if (match && match[1].trim()) return match[1].trim();
  const ownerKey = generateVaultKey('BSOWN');
  const nextEnv = (envRaw ? envRaw.trimEnd() + '\n' : '') + 'OWNER_VAULT_KEY=' + ownerKey + '\n';
  fs.writeFileSync(ENV_PATH, nextEnv, { mode: 0o600 });
  fs.chmodSync(ENV_PATH, 0o600);
  return ownerKey;
}

function initVaultRegistry() {
  fs.mkdirSync(VAULTS_DIR, { recursive: true });
  execFileSync('sqlite3', [REG_DB, 'PRAGMA journal_mode = WAL;'], { encoding: 'utf8' });
  execReg([
    'CREATE TABLE IF NOT EXISTS vaults (',
    '  id INTEGER PRIMARY KEY AUTOINCREMENT,',
    '  vault_key TEXT NOT NULL UNIQUE,',
    "  label TEXT NOT NULL DEFAULT 'Personal Vault',",
    "  tier TEXT NOT NULL DEFAULT 'FREE',",
    '  max_items INTEGER NOT NULL DEFAULT 75,',
    '  is_owner INTEGER NOT NULL DEFAULT 0,',
    '  db_rel_path TEXT NOT NULL,',
    "  created_at TEXT NOT NULL DEFAULT (datetime('now'))",
    ');',
    'CREATE INDEX IF NOT EXISTS idx_vaults_key ON vaults(vault_key);'
  ].join('\n'));

  const ownerKey = ensureOwnerEnvKey();
  const existingOwner = queryReg('SELECT id FROM vaults WHERE is_owner = 1 LIMIT 1;')[0];
  if (!existingOwner) {
    execReg('INSERT INTO vaults (vault_key, label, tier, max_items, is_owner, db_rel_path) VALUES (' +
      [sqlStr(ownerKey), sqlStr('Philip Master Vault'), sqlStr('OWNER'), 999999, 1, sqlStr('stash.db')].join(', ') + ');');
  } else {
    execReg('UPDATE vaults SET vault_key = ' + sqlStr(ownerKey) + ' WHERE id = ' + Number(existingOwner.id) + ';');
  }
  return ownerKey;
}

function formatVault(row) {
  if (!row) return null;
  const dbPath = row.is_owner ? OWNER_DB : path.resolve(DATA_DIR, row.db_rel_path);
  return {
    id: Number(row.id),
    vaultKey: row.vault_key,
    label: row.label,
    tier: row.tier,
    maxItems: Number(row.max_items),
    isOwner: Boolean(row.is_owner),
    dbPath,
    createdAt: row.created_at
  };
}

function createPublicVault(label) {
  const cleanLabel = String(label || 'My Stash Vault').trim().slice(0, 60) || 'My Stash Vault';
  const key = generateVaultKey('BS');
  const tokenSlug = crypto.randomBytes(6).toString('hex');
  const relPath = 'vaults/v_' + tokenSlug + '.db';
  const row = queryReg(
    'INSERT INTO vaults (vault_key, label, tier, max_items, is_owner, db_rel_path) VALUES (' +
    [sqlStr(key), sqlStr(cleanLabel), sqlStr('FREE'), 75, 0, sqlStr(relPath)].join(', ') +
    '); SELECT * FROM vaults WHERE id = last_insert_rowid();'
  )[0];
  return formatVault(row);
}

function resolveVault(rawKey, allowOwnerFallback = false) {
  const cleaned = String(rawKey || '').trim();
  if (cleaned) {
    const row = queryReg('SELECT * FROM vaults WHERE vault_key = ' + sqlStr(cleaned) + ' LIMIT 1;')[0];
    return formatVault(row);
  }
  if (allowOwnerFallback) {
    const owner = queryReg('SELECT * FROM vaults WHERE is_owner = 1 LIMIT 1;')[0];
    return formatVault(owner);
  }
  return null;
}

function upgradeVaultTier(vaultKey, tier = 'PRO') {
  const maxItems = tier === 'PRO' ? 25000 : 75;
  const row = queryReg(
    'UPDATE vaults SET tier = ' + sqlStr(tier) + ', max_items = ' + maxItems + ' WHERE vault_key = ' + sqlStr(vaultKey) +
    '; SELECT * FROM vaults WHERE vault_key = ' + sqlStr(vaultKey) + ' LIMIT 1;'
  )[0];
  return formatVault(row);
}

function getRegistryStats() {
  const row = queryReg("SELECT COUNT(*) AS total, SUM(CASE WHEN tier='PRO' THEN 1 ELSE 0 END) AS pro_count FROM vaults WHERE is_owner = 0;")[0] || {};
  return { publicVaults: Number(row.total || 0), proVaults: Number(row.pro_count || 0) };
}

module.exports = { initVaultRegistry, createPublicVault, resolveVault, upgradeVaultTier, getRegistryStats };
