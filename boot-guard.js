// v10.5.3 : filet de sécurité au démarrage. Si l'appli ne s'affiche pas en 10 s (iPhone, réseau, mémoire bloquée),
// on montre un message et un bouton « Réessayer » au lieu d'un écran vide.
(function () {
  function showHelp(reason) {
    if (window.__kalimatiStarted || document.getElementById('boot-help')) return;
    var box = document.createElement('div');
    box.id = 'boot-help';
    box.setAttribute('role', 'alert');
    box.style.cssText = 'position:fixed;inset:auto 16px 24px 16px;z-index:99999;background:#fff;color:#1d2a26;border:3px solid #1F6F5C;border-radius:18px;padding:16px;font:600 16px/1.4 system-ui,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.2)';
    var p = document.createElement('p');
    p.style.margin = '0 0 12px';
    p.textContent = 'Kalimati met du temps à s’ouvrir. Touchez « Réessayer ». Si cela revient, fermez Safari complètement puis rouvrez.';
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = '🔄 Réessayer';
    b.style.cssText = 'font:800 18px system-ui,sans-serif;padding:12px 20px;border-radius:14px;border:0;background:#1F6F5C;color:#fff;min-height:48px';
    b.onclick = function () { window.location.reload(); };
    box.appendChild(p); box.appendChild(b);
    (document.body || document.documentElement).appendChild(box);
    try { console.error('[Kalimati] démarrage lent :', reason); } catch (e) { /* rien */ }
  }
  setTimeout(function () { showHelp('délai'); }, 10000);
  window.addEventListener('error', function (e) {
    var t = e && e.target;
    if (t && t.tagName === 'SCRIPT') setTimeout(function () { showHelp('script'); }, 1500);
  }, true);
})();
