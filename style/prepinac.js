/* Prepínač jazykov do hlavičky. Spoločný pre všetky naše stránky.
 *
 * Zoznam jazykov si prečíta z hreflang odkazov, ktoré na stránke naozaj sú.
 * Preto nemôže ponúknuť verziu, ktorá neexistuje, a nemôže sa rozísť so
 * skutočnosťou: keď pribudne nová jazyková verzia, stačí pridať hreflang.
 * Keď stránka žiadne alternatívy nemá, prepínač sa nevykreslí vôbec.
 *
 * Otvára sa bez JavaScriptu (detail a summary), takže funguje aj vtedy,
 * keď sa skript nenačíta; skript ho len postaví.
 *
 * Použitie:
 *   <link rel="alternate" hreflang="de" href="https://arling.sk/…/de/">
 *   <script src="/style/prepinac.js" defer></script>
 */
(function () {
  'use strict';
  var NAZVY = { sk: 'Slovensky', cs: 'Česky', en: 'English', de: 'Deutsch', hu: 'Magyar', pl: 'Polski' };
  var SKRATKY = { sk: 'SK', cs: 'CS', en: 'EN', de: 'DE', hu: 'HU', pl: 'PL' };

  function postav() {
    var bar = document.querySelector('.bar');
    if (!bar || bar.querySelector('.langsel')) return;

    var tu = (document.documentElement.getAttribute('lang') || 'sk').slice(0, 2).toLowerCase();
    var verzie = [];
    Array.prototype.forEach.call(document.querySelectorAll('link[rel="alternate"][hreflang]'), function (l) {
      var kod = (l.getAttribute('hreflang') || '').slice(0, 2).toLowerCase();
      var href = l.getAttribute('href');
      if (!kod || kod === 'x-' || !href) return;
      if (!verzie.some(function (v) { return v.kod === kod; })) verzie.push({ kod: kod, href: href });
    });
    // bez alternatív nie je čo prepínať
    if (verzie.length < 2) return;
    verzie.sort(function (a, b) { return a.kod === tu ? -1 : b.kod === tu ? 1 : a.kod.localeCompare(b.kod); });

    var d = document.createElement('details');
    d.className = 'langsel';
    var s = document.createElement('summary');
    s.setAttribute('aria-label', 'Jazyk stránky');
    s.textContent = SKRATKY[tu] || tu.toUpperCase();
    d.appendChild(s);
    var ul = document.createElement('ul');
    verzie.forEach(function (v) {
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.href = v.href;
      a.textContent = NAZVY[v.kod] || v.kod;
      a.setAttribute('hreflang', v.kod);
      a.setAttribute('data-umami-event', 'lang-' + v.kod);
      if (v.kod === tu) a.setAttribute('aria-current', 'true');
      li.appendChild(a);
      ul.appendChild(li);
    });
    d.appendChild(ul);

    // zapamätá si voľbu, aby ju ponuka jazyka (jazyk.js) viac neotravovala
    d.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[hreflang]');
      if (a) { try { localStorage.setItem('arling.jazyk', a.getAttribute('hreflang')); } catch (err) {} }
    });
    // klik mimo zatvorí
    document.addEventListener('click', function (e) {
      if (d.open && !d.contains(e.target)) d.open = false;
    });

    var lang = bar.querySelector('.lang, select.lang');
    if (lang && lang.tagName === 'SELECT') lang.replaceWith(d);
    else bar.appendChild(d);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', postav);
  else postav();
})();
