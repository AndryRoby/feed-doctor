/* Ponuka jazyka podľa návštevníka. Spoločné pre všetky naše stránky.
 *
 * Prečo NIE automatické presmerovanie:
 *   1. Google to výslovne neodporúča; robot chodí z amerických adries a videl by
 *      vždy anglickú verziu, takže by nám neindexoval slovenskú ani nemeckú.
 *   2. Človek, ktorý si vedome otvoril inú jazykovú verziu, by sa z nej nedostal.
 *   3. Presmerovanie zdvojnásobí načítanie a pokazí odkaz, ktorý si niekto poslal.
 *
 * Čo robí namiesto toho: raz ponúkne pás s odkazom na verziu v jazyku prehliadača,
 * a keď ho návštevník zavrie alebo si jazyk zvolí sám, viac sa nepýta.
 *
 * Použitie na stránke:
 *   <link rel="alternate" hreflang="de" href="https://arling.sk/de/">   (pre každý jazyk)
 *   <script src="/style/jazyk.js" defer></script>
 * Skript si zoznam verzií prečíta priamo z hreflang odkazov, takže sa nikde
 * neduplikuje a nemôže sa rozísť so skutočnosťou.
 */
(function () {
  'use strict';
  var KLUC = 'arling.jazyk';
  // Zoznam je väčší než počet verzií, ktoré máme; použije sa len ten jazyk,
  // pre ktorý na stránke naozaj existuje hreflang odkaz.
  var NAZVY = { sk: 'slovensky', cs: 'česky', en: 'in English', de: 'auf Deutsch', hu: 'magyarul', pl: 'po polsku' };
  var VETY = {
    sk: 'Táto stránka je aj v slovenčine.',
    cs: 'Tato stránka je i v češtině.',
    en: 'This page is also available in English.',
    de: 'Diese Seite gibt es auch auf Deutsch.',
    hu: 'Ez az oldal magyarul is elérhető.',
    pl: 'Ta strona jest dostępna także po polsku.'
  };
  var ZAVRIET = { sk: 'Zavrieť', cs: 'Zavřít', en: 'Dismiss', de: 'Schließen', hu: 'Bezárás', pl: 'Zamknij' };

  function ulozene() { try { return localStorage.getItem(KLUC); } catch (e) { return null; } }
  function uloz(v) { try { localStorage.setItem(KLUC, v); } catch (e) {} }

  var tu = (document.documentElement.getAttribute('lang') || 'sk').slice(0, 2).toLowerCase();
  // Návštevník už raz rozhodol: neotravuj.
  if (ulozene()) return;

  var chce = (navigator.languages && navigator.languages[0]) || navigator.language || '';
  chce = chce.slice(0, 2).toLowerCase();
  if (!chce || chce === tu) return;

  var odkazy = {};
  Array.prototype.forEach.call(document.querySelectorAll('link[rel="alternate"][hreflang]'), function (l) {
    var h = (l.getAttribute('hreflang') || '').slice(0, 2).toLowerCase();
    if (h && h !== 'x-') odkazy[h] = l.getAttribute('href');
  });
  var ciel = odkazy[chce];
  // Verziu v jeho jazyku nemáme. Ak je stránka v jazyku, ktorému cudzinec
  // nerozumie (slovenčina, čeština), a máme anglickú verziu, ponúkneme
  // angličtinu ako spoločnú reč. Inak mlčíme, lebo ponúkať niečo, čo nemáme,
  // je horšie než neponúknuť nič.
  if (!ciel) {
    if ((tu === 'sk' || tu === 'cs') && odkazy.en) { chce = 'en'; ciel = odkazy.en; }
    else return;
  }

  var pas = document.createElement('div');
  pas.className = 'jazykpas';
  pas.setAttribute('role', 'region');
  pas.setAttribute('aria-label', 'Language');
  pas.innerHTML =
    '<span>' + (VETY[chce] || VETY.en) + '</span>' +
    '<a href="' + ciel + '" data-umami-event="lang-switch-' + chce + '">' + (NAZVY[chce] || chce) + '</a>' +
    '<button type="button" aria-label="' + (ZAVRIET[chce] || ZAVRIET.en) + '">&times;</button>';

  var css = document.createElement('style');
  css.textContent =
    '.jazykpas{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:20;display:flex;' +
    'align-items:center;gap:14px;background:var(--card,#fff);border:1px solid var(--line,#e4e2d8);' +
    'border-radius:999px;padding:9px 10px 9px 18px;box-shadow:0 10px 30px rgba(20,20,19,.12);' +
    'font-family:var(--ui,system-ui);font-size:14px;color:var(--body,#3d3d3a);max-width:92vw}' +
    '.jazykpas a{color:var(--accent,#b23a1d);font-weight:500;text-decoration:underline;text-underline-offset:3px}' +
    '.jazykpas button{border:0;background:none;font-size:20px;line-height:1;cursor:pointer;' +
    'color:var(--muted,#5e5d59);padding:0 6px}' +
    '@media (prefers-reduced-motion:no-preference){.jazykpas{animation:jazykpas-in .4s cubic-bezier(.16,1,.3,1)}' +
    '@keyframes jazykpas-in{from{opacity:0;transform:translate(-50%,10px)}to{opacity:1;transform:translateX(-50%)}}}';

  function pridaj() {
    document.head.appendChild(css);
    document.body.appendChild(pas);
    pas.querySelector('button').addEventListener('click', function () { uloz(tu); pas.remove(); });
    pas.querySelector('a').addEventListener('click', function () { uloz(chce); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pridaj);
  else pridaj();
})();
