'use strict';

(function renderVisualGuide() {
  const host = document.getElementById('guideDiagrams');
  if (!host) return;

  const cards = [
    {
      title: '[Method 1] Save One Complete Browser Page',
      svg: [
        '<svg viewBox="0 0 420 210" xmlns="http://www.w3.org/2000/svg">',
        '  <rect width="420" height="210" fill="#070b12"/>',
        '  <rect x="14" y="14" width="392" height="78" rx="7" fill="#121926" stroke="#25324a"/>',
        '  <circle cx="28" cy="28" r="4" fill="#ef4444"/><circle cx="40" cy="28" r="4" fill="#f59e0b"/><circle cx="52" cy="28" r="4" fill="#10b981"/>',
        '  <text x="68" y="32" fill="#8b9bb4" font-size="10" font-family="sans-serif">YouTube Movie Tab</text>',
        '  <rect x="24" y="42" width="372" height="34" rx="6" fill="#06281c" stroke="#10b981" stroke-width="2"/>',
        '  <text x="36" y="63" fill="#6ee7b7" font-size="11.5" font-family="monospace">https://www.youtube.com/watch?v=TBrjPw30...</text>',
        '  <rect x="278" y="47" width="110" height="24" rx="4" fill="#10b981"/>',
        '  <text x="333" y="63" text-anchor="middle" fill="#04120c" font-size="10.5" font-weight="bold" font-family="sans-serif">1. Ctrl+L &amp; Ctrl+C</text>',
        '  <path d="M210 96 L210 118" stroke="#10b981" stroke-width="3"/>',
        '  <polygon points="203,115 217,115 210,125" fill="#10b981"/>',
        '  <rect x="14" y="128" width="392" height="68" rx="7" fill="#121926" stroke="#25324a"/>',
        '  <rect x="26" y="140" width="118" height="44" rx="5" fill="#090d14" stroke="#25324a"/>',
        '  <text x="85" y="159" text-anchor="middle" fill="#8b9bb4" font-size="9.5" font-family="sans-serif">2. Click Folder</text>',
        '  <text x="85" y="174" text-anchor="middle" fill="#10b981" font-size="10.5" font-weight="bold" font-family="sans-serif">Movies / To Watch</text>',
        '  <rect x="158" y="142" width="234" height="40" rx="6" fill="#10b981"/>',
        '  <text x="275" y="166" text-anchor="middle" fill="#04120c" font-size="12" font-weight="bold" font-family="sans-serif">3. [1-Click Paste Clipboard &amp; Save]</text>',
        '</svg>'
      ].join(''),
      steps: [
        'On the YouTube or web page you want to keep, press <kbd>Ctrl + L</kbd> (selects the complete hidden <code>https://</code> link) then <kbd>Ctrl + C</kbd>.',
        'Switch to <strong>[1. Saved Links]</strong> and click your target folder on the left (e.g. <strong>Movies &amp; Series / To Watch</strong>).',
        'Click <strong>[1-Click Paste Clipboard &amp; Save]</strong>, then close the heavy YouTube tab (<kbd>Ctrl + W</kbd>).'
      ]
    },
    {
      title: '[Method 2] 1-Click Bookmarks Bar Button',
      svg: [
        '<svg viewBox="0 0 420 210" xmlns="http://www.w3.org/2000/svg">',
        '  <rect width="420" height="210" fill="#070b12"/>',
        '  <rect x="14" y="14" width="392" height="62" rx="7" fill="#121926" stroke="#25324a"/>',
        '  <text x="26" y="34" fill="#8b9bb4" font-size="10" font-family="sans-serif">Chrome Bookmarks Bar:</text>',
        '  <rect x="26" y="44" width="54" height="22" rx="4" fill="#182234"/><text x="53" y="59" text-anchor="middle" fill="#cbd5e1" font-size="10" font-family="sans-serif">YT DL</text>',
        '  <rect x="88" y="44" width="58" height="22" rx="4" fill="#182234"/><text x="117" y="59" text-anchor="middle" fill="#cbd5e1" font-size="10" font-family="sans-serif">myself</text>',
        '  <rect x="156" y="42" width="112" height="26" rx="13" fill="#06281c" stroke="#10b981" stroke-width="2" stroke-dasharray="4,2"/>',
        '  <text x="212" y="59" text-anchor="middle" fill="#10b981" font-size="11" font-weight="bold" font-family="sans-serif">+ Stash This</text>',
        '  <rect x="130" y="138" width="156" height="40" rx="20" fill="#10b981" stroke="#ffffff" stroke-width="2" stroke-dasharray="5,3"/>',
        '  <text x="208" y="163" text-anchor="middle" fill="#04120c" font-size="13" font-weight="bold" font-family="sans-serif">+ Stash This</text>',
        '  <path d="M210 132 Q 245 102 218 74" fill="none" stroke="#10b981" stroke-width="3.5"/>',
        '  <polygon points="212,80 225,73 213,67" fill="#10b981"/>',
        '  <text x="292" y="114" fill="#6ee7b7" font-size="11" font-weight="bold" font-family="sans-serif">Drag straight up</text>',
        '  <text x="292" y="129" fill="#8b9bb4" font-size="10" font-family="sans-serif">onto bar once!</text>',
        '</svg>'
      ].join(''),
      steps: [
        'Drag the green <strong>+ Stash This</strong> oval button at the top of this page up onto your Chrome Bookmarks Bar (do this once).',
        'While watching any YouTube movie or reading an article, click <strong>+ Stash This</strong> on your Bookmarks Bar.',
        'A small saver box pops up with the full link and title pre-filled — click <strong>Save Now</strong> and close the tab!'
      ]
    },
    {
      title: '[Method 3] Save All 25+ Open Tabs at Once',
      svg: [
        '<svg viewBox="0 0 420 210" xmlns="http://www.w3.org/2000/svg">',
        '  <rect width="420" height="210" fill="#070b12"/>',
        '  <rect x="12" y="16" width="122" height="178" rx="7" fill="#121926" stroke="#25324a"/>',
        '  <text x="73" y="38" text-anchor="middle" fill="#10b981" font-size="10.5" font-weight="bold" font-family="sans-serif">1. Bookmark All</text>',
        '  <rect x="22" y="48" width="18" height="10" rx="2" fill="#ef4444"/><rect x="44" y="48" width="18" height="10" rx="2" fill="#ef4444"/><rect x="66" y="48" width="18" height="10" rx="2" fill="#ef4444"/><rect x="88" y="48" width="18" height="10" rx="2" fill="#ef4444"/>',
        '  <rect x="22" y="78" width="102" height="34" rx="6" fill="#090d14" stroke="#10b981"/>',
        '  <text x="73" y="99" text-anchor="middle" fill="#e6edf7" font-size="11" font-weight="bold" font-family="monospace">Ctrl+Shift+D</text>',
        '  <text x="73" y="138" text-anchor="middle" fill="#8b9bb4" font-size="9.5" font-family="sans-serif">Save open window</text>',
        '  <text x="73" y="152" text-anchor="middle" fill="#8b9bb4" font-size="9.5" font-family="sans-serif">into folder "temp"</text>',
        '  <rect x="149" y="16" width="122" height="178" rx="7" fill="#121926" stroke="#25324a"/>',
        '  <text x="210" y="38" text-anchor="middle" fill="#10b981" font-size="10.5" font-weight="bold" font-family="sans-serif">2. Copy All URLs</text>',
        '  <rect x="159" y="52" width="102" height="26" rx="5" fill="#090d14" stroke="#25324a"/>',
        '  <text x="210" y="69" text-anchor="middle" fill="#cbd5e1" font-size="10" font-family="monospace">Ctrl+Shift+O</text>',
        '  <rect x="159" y="88" width="102" height="44" rx="6" fill="#06281c" stroke="#10b981"/>',
        '  <text x="210" y="107" text-anchor="middle" fill="#6ee7b7" font-size="10.5" font-weight="bold" font-family="monospace">Ctrl + A</text>',
        '  <text x="210" y="123" text-anchor="middle" fill="#6ee7b7" font-size="10.5" font-weight="bold" font-family="monospace">then Ctrl + C</text>',
        '  <text x="210" y="154" text-anchor="middle" fill="#8b9bb4" font-size="9.5" font-family="sans-serif">Copies all 25+ full</text>',
        '  <text x="210" y="168" text-anchor="middle" fill="#8b9bb4" font-size="9.5" font-family="sans-serif">links at once</text>',
        '  <rect x="286" y="16" width="122" height="178" rx="7" fill="#121926" stroke="#25324a"/>',
        '  <text x="347" y="38" text-anchor="middle" fill="#10b981" font-size="10.5" font-weight="bold" font-family="sans-serif">3. Paste Batch</text>',
        '  <rect x="296" y="54" width="102" height="36" rx="6" fill="#10b981"/>',
        '  <text x="347" y="70" text-anchor="middle" fill="#04120c" font-size="9.5" font-weight="bold" font-family="sans-serif">[1-Click Paste</text>',
        '  <text x="347" y="83" text-anchor="middle" fill="#04120c" font-size="9.5" font-weight="bold" font-family="sans-serif">&amp; Save]</text>',
        '  <rect x="296" y="104" width="46" height="32" rx="4" fill="#182234" stroke="#10b981"/><rect x="352" y="104" width="46" height="32" rx="4" fill="#182234" stroke="#10b981"/>',
        '  <rect x="296" y="144" width="46" height="32" rx="4" fill="#182234" stroke="#10b981"/><rect x="352" y="144" width="46" height="32" rx="4" fill="#182234" stroke="#10b981"/>',
        '</svg>'
      ].join(''),
      steps: [
        'In your crowded YouTube window, press <kbd>Ctrl + Shift + D</kbd>, save all tabs into a temporary folder named <code>temp</code>.',
        'Press <kbd>Ctrl + Shift + O</kbd> (Bookmark Manager), open <code>temp</code>, click the first link, and press <kbd>Ctrl + A</kbd> then <kbd>Ctrl + C</kbd>.',
        'In Bokkie Stash Tab 1, pick your folder and click <strong>[1-Click Paste Clipboard &amp; Save]</strong> — all 25+ tabs become cards in one go!'
      ]
    }
  ];

  host.innerHTML = cards.map((c) => (
    '<article class="info-card">' +
      '<h3>' + c.title + '</h3>' +
      '<div class="diag-frame">' + c.svg + '</div>' +
      '<ol class="step-list">' + c.steps.map((s) => '<li>' + s + '</li>').join('') + '</ol>' +
    '</article>'
  )).join('');
})();
