// v10.25 : applique le thème choisi AVANT le premier affichage (pas d'éclair de l'ancien thème).
// Thèmes : « scolaire » (cahier, post-it, ardoise — par défaut), « simple » (sans décor),
// « contraste » (noir et blanc, pour la sensibilité visuelle). Le choix reste dans ce téléphone.
(function () {
  var theme = 'scolaire';
  try {
    var saved = window.KalimatiStorage.getItem('kalimati-theme');
    if (saved === 'simple' || saved === 'contraste' || saved === 'scolaire') theme = saved;
  } catch (e) { /* navigation privée : thème par défaut */ }
  document.documentElement.setAttribute('data-theme', theme);
})();
