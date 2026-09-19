/* Jedno miesto, ktoré sa stará o príchody obsahu na celom webe.
 *
 * Prečo tu a nie v každej stránke: keď to robila každá stránka sama, stačilo,
 * aby sa jej skript nespustil (napríklad kvôli CSP), a návštevník videl prázdne
 * sekcie. Presne to sa stalo 6. 9. 2026. Toto je externý súbor, ktorý CSP dovolí,
 * načíta sa v hlavičke bez defer, a robí tri veci v poradí dôležitosti:
 *   1. prihlási, že JavaScript beží, takže sa obsah vôbec smie skrývať
 *   2. čokoľvek je pri načítaní v obraze, odhalí okamžite
 *   3. pri scrollovaní odhalí zvyšok, nezávisle od skriptov jednotlivých stránok
 * Ak čokoľvek z toho zlyhá, obsah ostáva viditeľný. Nikdy naopak.
 */
document.documentElement.classList.add('js');

/* A-090: natívne menu podstránok. Bez JS je otvorené a stále ovládateľné.
   S JS je na mobile zavreté, na desktope otvorené. Používa vlastné triedy,
   preto sa neprebije s historickým menu-btn kódom produktových stránok. */
(function () {
  'use strict';
  var klucDomova = 'arling_hub_lang';
  function platnyDomov(kod) { return kod === 'sk' || kod === 'en' || kod === 'de'; }
  function navratDomov() {
    var kod = (document.documentElement.lang || 'sk').slice(0, 2).toLowerCase();
    try {
      var ulozeny = localStorage.getItem(klucDomova);
      if (platnyDomov(ulozeny)) kod = ulozeny;
    } catch (e) {}
    var cast = kod === 'en' || kod === 'de' ? kod + '/' : '';
    var popis = kod === 'en' ? 'ARLing home' : kod === 'de' ? 'ARLing Startseite' : 'ARLing: úvod';
    // Includes the shop's custom header and future footer home links, but not
    // product links or explicit language-switch links pointing at a home page.
    document.querySelectorAll('header a.brand, footer a.brand, [data-site-home]').forEach(function (a) {
      a.href = 'https://arling.sk/' + cast;
      a.setAttribute('aria-label', popis);
    });
  }
  function explicitnyJazyk(e) {
    var vyber = e.target.closest && e.target.closest('header a[hreflang], header [data-set-lang]');
    if (!vyber) return;
    var kod = (vyber.getAttribute('hreflang') || vyber.getAttribute('data-set-lang') || '').toLowerCase();
    if (kod === 'cs') kod = 'sk';
    if (!platnyDomov(kod)) return;
    try { localStorage.setItem(klucDomova, kod); } catch (err) {}
    navratDomov();
  }
  document.addEventListener('click', explicitnyJazyk);
  window.addEventListener('pageshow', function () {
    // A home page restored from the back/forward cache does not run uvod.js
    // again. Visiting it still explicitly chooses that home language.
    if (document.body && document.body.classList.contains('uvod')) {
      var kod = (document.documentElement.lang || '').slice(0, 2).toLowerCase();
      if (platnyDomov(kod)) { try { localStorage.setItem(klucDomova, kod); } catch (e) {} }
    }
    navratDomov();
  });
  window.addEventListener('storage', function (e) { if (e.key === klucDomova) navratDomov(); });
  function pripojMenu() {
    navratDomov();
    var hlavicka = document.querySelector('header.site-header');
    if (!hlavicka) return;
    var menu = hlavicka.querySelector('details.site-menu');
    var prepinac = menu && menu.querySelector('summary');
    if (!menu || !prepinac) return;
    var uzke = window.matchMedia('(max-width: 960px)');
    function sirka() { menu.open = !uzke.matches; }
    sirka();
    if (uzke.addEventListener) uzke.addEventListener('change', sirka);
    else if (uzke.addListener) uzke.addListener(sirka);
    document.addEventListener('click', function (e) {
      if (uzke.matches && menu.open && !hlavicka.contains(e.target)) menu.open = false;
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && uzke.matches && menu.open) { menu.open = false; prepinac.focus(); }
    });
    menu.addEventListener('click', function (e) {
      var odkaz = e.target.closest && e.target.closest('a[href]');
      if (odkaz && uzke.matches) menu.open = false;
    });
    // Niektoré aplikácie menia jazyk za behu. Hlavička musí nasledovať ich
    // html lang, nie zasahovať do ich formulárov alebo prekladových slovníkov.
    var texty = {
      sk: { menu:'Menu', domov:'ARLing: úvod', nav:'Hlavná navigácia', stranka:'Na tejto stránke', skip:'Prejsť na obsah', nazvy:['Obchod','Nástroje','Hry','Články','Účet'] },
      en: { menu:'Menu', domov:'ARLing home', nav:'Main navigation', stranka:'On this page', skip:'Skip to content', nazvy:['Shop','Tools','Free puzzles','Notes','Account'] },
      de: { menu:'Menü', domov:'ARLing Startseite', nav:'Hauptnavigation', stranka:'Auf dieser Seite', skip:'Zum Inhalt springen', nazvy:['Shop','Werkzeuge','Gratis-Rätsel','Artikel','Konto'] },
      cs: { menu:'Menu', domov:'ARLing: úvod', nav:'Hlavní navigace', stranka:'Na této stránce', skip:'Přejít na obsah', nazvy:['Obchod','Nástroje','Hry','Články','Účet'] }
    };
    function jazyk() {
      var kod = (document.documentElement.lang || 'sk').slice(0,2).toLowerCase();
      var t = texty[kod] || texty.sk;
      var cast = kod === 'en' || kod === 'de' ? kod + '/' : '';
      var cesty = ['/shop/', '/'+cast+'#tools', '/games/', '/notes/'+cast, '/ucet/'+cast];
      hlavicka.querySelectorAll('[data-site-nav]').forEach(function (a) {
        var i = Number(a.getAttribute('data-site-nav'));
        a.href = 'https://arling.sk' + cesty[i];
        a.textContent = t.nazvy[i];
      });
      navratDomov();
      document.querySelectorAll('[data-site-label]').forEach(function (el) {
        var k = el.getAttribute('data-site-label');
        if (t[k]) el.textContent = t[k];
      });
      hlavicka.querySelectorAll('[data-site-aria]').forEach(function (el) {
        var k = el.getAttribute('data-site-aria');
        if (t[k]) el.setAttribute('aria-label', t[k]);
      });
    }
    jazyk();
    if (window.MutationObserver) new MutationObserver(jazyk).observe(document.documentElement, {attributes:true,attributeFilter:['lang']});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pripojMenu);
  else pripojMenu();
})();

(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function odhalPrvok(el) { el.classList.add('in'); }

  function odhalVsetko() {
    document.querySelectorAll('.r, section, .banner').forEach(odhalPrvok);
  }

  function start() {
    // úvod a nadpis nikdy nečakajú
    document.querySelectorAll('.hero, .hero .r, h1, .w').forEach(odhalPrvok);

    if (reduce || !('IntersectionObserver' in window)) { odhalVsetko(); return; }

    var io = new IntersectionObserver(function (zaznamy) {
      zaznamy.forEach(function (z) {
        if (!z.isIntersecting) return;
        odhalPrvok(z.target);
        // sekcia odhalí aj svoje vnútro, aby nezáležalo na poradí
        if (z.target.querySelectorAll) z.target.querySelectorAll('.r').forEach(odhalPrvok);
        io.unobserve(z.target);
      });
    }, { rootMargin: '0px 0px -5% 0px', threshold: 0.01 });

    document.querySelectorAll('.r, section, .banner').forEach(function (el) { io.observe(el); });

    // posledná poistka: po dvoch sekundách odhal všetko, čo je v obraze
    setTimeout(function () {
      var vyska = window.innerHeight || 800;
      document.querySelectorAll('.r:not(.in), section:not(.in)').forEach(function (el) {
        if (el.getBoundingClientRect().top < vyska) odhalPrvok(el);
      });
    }, 2000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();

/* Hlavička, ktorá je hore priehľadná a po odrolovaní dostane pozadie.
 *
 * Prečo trieda na <body> a nie na <header>: hlavičku niektoré stránky vykresľujú
 * inak, ale <body> je vždy jedno. Trieda `posunute` sa pridá po 12 pixeloch,
 * čo je dosť na to, aby to nepreblikávalo pri jemnom dotyku kolieska.
 *
 * Pozor na tri veci, ktoré sa tu ľahko pokazia:
 *  1. `passive: true` na poslucháčovi, inak scrollovanie na mobile trhá;
 *  2. čítanie scrollY v requestAnimationFrame, nie priamo v udalosti, aby sme
 *     nenútili prehliadač prepočítavať rozloženie pri každom pixeli;
 *  3. stav sa nastaví hneď pri načítaní, lebo stránka sa môže otvoriť
 *     odrolovaná (návrat späť, odkaz s kotvou).
 */
(function () {
  'use strict';
  var caka = false;

  function prepni() {
    caka = false;
    var telo = document.body;
    if (!telo) return;
    var y = window.pageYOffset || document.documentElement.scrollTop || 0;
    telo.classList.toggle('posunute', y > 12);
  }
  function naScroll() {
    if (caka) return;
    caka = true;
    window.requestAnimationFrame(prepni);
  }

  // Tento súbor sa načíta v <head> bez defer, takže tu <body> ešte neexistuje.
  // Poslucháčov vieme pripojiť hneď (window existuje), ale prvé prepnutie musí
  // počkať na telo dokumentu, inak by hlavička ostala navždy priehľadná.
  window.addEventListener('scroll', naScroll, { passive: true });
  window.addEventListener('resize', naScroll, { passive: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', prepni);
  else prepni();
})();

/* Skutočná výška pevnej hlavičky do premennej --hlavicka.
 *
 * Prečo sa meria a nehádže: hlavička sa na úzkej obrazovke zalamuje do dvoch
 * riadkov a v nemčine aj do troch, lebo "Wie wir arbeiten" je dlhšie než
 * "Ako pracujeme". Pevné číslo v CSS by v jednom jazyku sedelo a v druhom by
 * hlavička prekryla nadpis. Meria sa pri načítaní, pri zmene veľkosti okna
 * a keď sa dopočítajú fonty (vtedy sa výška ešte zmení).
 */
(function () {
  'use strict';
  function hlavickaVyska() {
    // 100vw zahŕňa aj scrollbar. Plátno potrebuje skutočnú šírku obsahu okna,
    // inak na desktope vytváralo vodorovný posun približne o polovicu scrollbaru.
    document.documentElement.style.setProperty('--sirka-okna', document.documentElement.clientWidth + 'px');
    var h = document.querySelector('header');
    if (!h) return;
    var v = Math.round(h.getBoundingClientRect().height);
    if (v > 0) document.documentElement.style.setProperty('--hlavicka', v + 'px');
  }
  function pripoj() {
    hlavickaVyska();
    window.addEventListener('resize', hlavickaVyska, { passive: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(hlavickaVyska);
    // istota pre prípad, že sa niečo dokreslí neskôr
    setTimeout(hlavickaVyska, 400);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pripoj);
  else pripoj();
})();
