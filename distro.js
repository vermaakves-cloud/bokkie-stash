'use strict';

function cleanOrigin(origin) {
  const s = String(origin || 'https://stash.mymark.co.za').trim().replace(/\/+$/, '');
  return /^https?:\/\//i.test(s) ? s : 'https://stash.mymark.co.za';
}

function cleanKey(key) {
  return String(key || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);
}

function buildPwaManifest(origin, vaultKey) {
  const base = cleanOrigin(origin);
  const k = cleanKey(vaultKey);
  const startPath = k ? '/app?key=' + encodeURIComponent(k) : '/app';
  const quickPath = k ? '/quick?key=' + encodeURIComponent(k) : '/quick';
  return {
    name: 'MyMmark Stash — Zero-RAM Media & Link Vault',
    short_name: 'MyMmark Stash',
    description: 'Save YouTube, movie, and project tabs into zero-RAM visual cards with instant 1-click sharing.',
    start_url: base + startPath,
    display: 'standalone',
    background_color: '#0b0f17',
    theme_color: '#10b981',
    icons: [{
      src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 128 128'%3E%3Crect width='128' height='128' rx='24' fill='%2310b981'/%3E%3Ctext x='64' y='82' font-size='56' font-family='monospace' font-weight='bold' text-anchor='middle' fill='%2304120c'%3EMS%3C/text%3E%3C/svg%3E",
      sizes: '128x128',
      type: 'image/svg+xml'
    }],
    share_target: {
      action: quickPath,
      method: 'GET',
      params: { title: 'title', text: 'text', url: 'url' }
    }
  };
}

function buildBookmarklet(origin, vaultKey) {
  const base = cleanOrigin(origin);
  const k = cleanKey(vaultKey);
  const keyParam = k ? '&key=' + encodeURIComponent(k) : '';
  return "javascript:(function(){var w=430,h=380,l=Math.round((screen.width-w)/2),t=Math.round((screen.height-h)/2);window.open('" +
    base + "/quick?url='+encodeURIComponent(location.href)+'&title='+encodeURIComponent(document.title)+'" + keyParam +
    "','mm_stash','width='+w+',height='+h+',left='+l+',top='+t);})();";
}

function buildLinuxFlushScript() {
  return [
    '#!/usr/bin/env bash',
    'set -e',
    'USER_ID=$(id -u)',
    'export DISPLAY="${DISPLAY:-:0}"',
    'export DBUS_SESSION_BUS_ADDRESS="${DBUS_SESSION_BUS_ADDRESS:-unix:path=/run/user/${USER_ID}/bus}"',
    'if command -v xsel >/dev/null 2>&1; then xsel -pc || true; xsel -sc || true; xsel -bc || true; fi',
    'if pgrep -f "/usr/bin/csd-clipboard" >/dev/null 2>&1; then pkill -f "/usr/bin/csd-clipboard" || true; sleep 0.3; nohup /usr/bin/csd-clipboard >/dev/null 2>&1 & fi',
    'find /dev/shm -maxdepth 1 -user "$USER" -name ".org.chromium.Chromium.*" -mmin +60 -delete 2>/dev/null || true',
    'AVAIL=$(free -h | awk \'/^Mem:/ {print $7}\')',
    'command -v notify-send >/dev/null 2>&1 && notify-send -t 3000 "MyMmark Stash Care" "Clipboard & browser SHM cleared | Free RAM: $AVAIL" || true',
    'echo "Cleared clipboard & stale Chromium /dev/shm segments. Available RAM: $AVAIL"'
  ].join('\n') + '\n';
}

function buildWindowsFlushScript() {
  return [
    '# MyMmark Stash — Windows Clipboard & Browser Temp Care',
    'Set-Clipboard -Value $null',
    '$os = Get-CimInstance Win32_OperatingSystem',
    '$freeGb = [math]::Round($os.FreePhysicalMemory / 1MB, 2)',
    'Write-Host "Clipboard buffer cleared! Available Physical RAM: $freeGb GB" -ForegroundColor Green'
  ].join('\r\n') + '\r\n';
}

function buildExtensionInstaller(origin, vaultKey) {
  const base = cleanOrigin(origin);
  const k = cleanKey(vaultKey);
  const manifest = JSON.stringify({
    manifest_version: 3,
    name: 'MyMmark Stash — 1-Click Window Saver',
    version: '1.1.0',
    description: 'Save and close all open tabs in a Chrome window directly into your private MyMmark Stash vault.',
    permissions: ['tabs', 'storage'],
    host_permissions: [base + '/*'],
    action: { default_title: 'Stash Window', default_popup: 'popup.html' }
  }, null, 2);

  const popupHtml = [
    '<!DOCTYPE html><html><head><meta charset="utf-8"><style>',
    'body{width:340px;background:#0b0f17;color:#e6edf7;font-family:system-ui,sans-serif;padding:12px;margin:0;font-size:13px}',
    'select,input,button{width:100%;padding:8px;margin-top:7px;border-radius:6px;border:1px solid #25324a;background:#121926;color:#fff;box-sizing:border-box}',
    'button.pri{background:#10b981;color:#04120c;font-weight:700;border:0;cursor:pointer;margin-top:10px}.msg{margin-top:8px;color:#10b981;text-align:center}',
    '</style></head><body><strong style="color:#10b981">[MYMMARK STASH] Window Saver</strong>',
    '<select id="cat"></select><select id="sub"></select><input id="note" placeholder="Optional batch note...">',
    '<button id="saveClose" class="pri">Stash & Close Open Tabs</button><div id="m" class="msg"></div>',
    '<script src="popup.js"></script></body></html>'
  ].join('');

  const popupJs = [
    "'use strict';",
    "const BASE='" + base + "', KEY='" + k + "';",
    'let tree=[], tabs=[];',
    'const hdr=()=>KEY?{"Content-Type":"application/json","X-Stash-Key":KEY}:{"Content-Type":"application/json"};',
    'function fillSub(){const c=tree.find(x=>x.id==document.getElementById("cat").value),s=document.getElementById("sub");s.innerHTML="<option value=\'\'>-- Folder Root --</option>";((c&&c.subsections)||[]).forEach(x=>s.add(new Option(x.name,x.id)));}',
    'chrome.tabs.query({currentWindow:true}).then(t=>{tabs=t.filter(x=>x.url&&/^https?:\\/\\//i.test(x.url)&&!x.pinned&&!x.url.startsWith(BASE));document.getElementById("saveClose").textContent="Stash & Close ("+tabs.length+" Tabs)";});',
    'fetch(BASE+"/api/bootstrap",{headers:hdr()}).then(r=>r.json()).then(d=>{tree=d.tree||[];const cs=document.getElementById("cat");tree.forEach(c=>cs.add(new Option(c.icon+" "+c.name,c.id)));fillSub();cs.onchange=fillSub;});',
    'document.getElementById("saveClose").onclick=async()=>{if(!tabs.length)return;document.getElementById("m").textContent="Saving...";',
    'const r=await fetch(BASE+"/api/items",{method:"POST",headers:hdr(),body:JSON.stringify({categoryId:Number(document.getElementById("cat").value)||null,subsectionId:Number(document.getElementById("sub").value)||null,notes:document.getElementById("note").value,items:tabs.map(t=>({url:t.url,title:t.title}))})});',
    'const j=await r.json();if(j.ok){await chrome.tabs.create({url:BASE+"/app?key="+KEY});await chrome.tabs.remove(tabs.map(t=>t.id));window.close();}else document.getElementById("m").textContent=j.error||"Error";};'
  ].join('\n');

  return [
    '#!/usr/bin/env bash',
    'set -e',
    'DEST="$HOME/mymark-stash-extension"',
    'mkdir -p "$DEST"',
    "cat << 'EXT_M' > \"$DEST/manifest.json\"",
    manifest,
    'EXT_M',
    "cat << 'EXT_H' > \"$DEST/popup.html\"",
    popupHtml,
    'EXT_H',
    "cat << 'EXT_J' > \"$DEST/popup.js\"",
    popupJs,
    'EXT_J',
    'echo "Unpacked extension ready at: $DEST (Open chrome://extensions -> Developer Mode -> Load unpacked)"'
  ].join('\n') + '\n';
}

module.exports = { buildPwaManifest, buildBookmarklet, buildLinuxFlushScript, buildWindowsFlushScript, buildExtensionInstaller };
