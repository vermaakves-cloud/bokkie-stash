# MyMmark Stash / Bokkie Stash (:3026) — Domain & Architecture Rules

- **Production Endpoints:**
  - Public Storefront & Zero-Store Hub: `https://stash.mymark.co.za` (MyMmark Engine `:3010`, `tenant_stash01`)
  - Public Multi-Tenant Vault & PWA: `https://stash.mymark.co.za/vault/` (Caddy `handle_path /vault/*` -> `127.0.0.1:3026`)
  - Owner Private Vault & VPS Telemetry: `https://stash.bokkie.online` (`127.0.0.1:3026`)
- **Storage & Isolation:**
  - Owner data stays strictly in `/var/www/bokkie-stash/data/stash.db` gated by `OWNER_VAULT_KEY` in `.env` (`chmod 600`).
  - Public vaults map via `data/registry.db` (`BS-XXXX-XXXX-XXXX` keys) to isolated WAL files in `data/vaults/v_<hex>.db`.
- **Modular Standard:** Keep all `.js`, `.html`, and `.css` modules under 160 lines; enforce `sqlite3 -json` multi-line array parsing via `lastIndexOf('\n[')`.
