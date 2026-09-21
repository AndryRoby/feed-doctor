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

/* A-093: hlavička podstránok podľa úvodu v4. Bez JS je menu čisté details,
   ktoré sa otvára kliknutím. Tento blok drží jazyk značky (arling_hub_lang),
   prekladá lištu, keď aplikácia zmení <html lang>, a dáva menu rovnaké správanie
   ako na úvode. Používa vlastné triedy (site-…), preto sa neprebije s historickým
   menu-btn kódom produktových stránok. */
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

    /* Rám podľa úvodu v4 (A-093). Všetky details v hlavičke (Produkty alebo
       mobilné menu, langsel z prepinac.js, vlastný prepínač stránky) sa správajú
       rovnako ako na úvode: otvorené je vždy len jedno, zatvára sa klikom mimo,
       klávesom Escape s návratom fokusu, po kliknutí na odkaz a pri zmene šírky
       cez hranicu mobilu. Bez tohto skriptu ostáva čisté details, ktoré sa
       otvára a zatvára kliknutím. */
    function otvorene() {
      return Array.prototype.slice.call(hlavicka.querySelectorAll('details[open]'));
    }
    function zatvor(okrem) {
      otvorene().forEach(function (d) { if (d !== okrem) d.open = false; });
    }
    // toggle nebublá, vo fáze capture ho však hlavička zachytí aj pre langsel,
    // ktorý prepinac.js pridá až po tomto skripte.
    hlavicka.addEventListener('toggle', function (e) {
      var d = e.target;
      if (d && d.open) zatvor(d);
    }, true);
    hlavicka.addEventListener('click', function (e) {
      var odkaz = e.target.closest && e.target.closest('a[href]');
      var d = odkaz && odkaz.closest('details');
      if (!d || !hlavicka.contains(d)) return;
      d.open = false;
      // Ktorý odkaz z katalógu ľudia volia; Mail Doctor analytiku nenačíta, tam sa nič nepošle.
      if (d === menu) {
        try { if (window.umami && typeof window.umami.track === 'function') window.umami.track('shell_menu', { target: odkaz.getAttribute('href') }); } catch (err) {}
      }
    });
    document.addEventListener('click', function (e) {
      if (!(e.target.closest && e.target.closest('header.site-header details[open]'))) zatvor(null);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var o = otvorene()[0];
      if (!o) return;
      o.open = false;
      var s = o.querySelector('summary');
      if (s) s.focus();
    });
    // Na myši sa Produkty otvárajú prejdením: 90 ms, aby nepreblikli pri ceste
    // kurzora inam, a zatvárajú po 180 ms, aby sa dalo prejsť zo slova na panel.
    // Na mobilnej šírke a na dotyku sa menu otvára len kliknutím.
    var jemne = window.matchMedia('(hover: hover) and (pointer: fine)');
    var siroke = window.matchMedia('(min-width: 761px)');
    var cas = null, prejdenim = 0;
    menu.addEventListener('pointerenter', function () {
      if (!jemne.matches || !siroke.matches) return;
      clearTimeout(cas);
      cas = setTimeout(function () { if (!menu.open) { menu.open = true; prejdenim = Date.now(); } }, 90);
    });
    menu.addEventListener('pointerleave', function () {
      if (!jemne.matches || !siroke.matches) return;
      clearTimeout(cas);
      cas = setTimeout(function () { menu.open = false; }, 180);
    });
    // Kto na slovo Produkty zo zvyku aj klikne tesne po tom, čo sa otvorilo
    // prejdením, nemá si ho tým istým klikom zavrieť.
    prepinac.addEventListener('click', function (e) {
      if (menu.open && Date.now() - prejdenim < 450) e.preventDefault();
    });
    function poZmeneSirky() { clearTimeout(cas); zatvor(null); }
    if (siroke.addEventListener) siroke.addEventListener('change', poZmeneSirky);
    else if (siroke.addListener) siroke.addListener(poZmeneSirky);

    // Niektoré aplikácie menia jazyk za behu. Hlavička musí nasledovať ich
    // html lang, nie zasahovať do ich formulárov alebo prekladových slovníkov.
    // Poradie názvov a ciest je to isté ako NAV a CTA v ops/design/obal.mjs
    // (stráži to test). Katalóg v paneli ostáva v jazyku, v ktorom stránku
    // postavil obal; tri jeho preklady by tento súbor zväčšili na každej stránke.
    var texty = {
      sk: { menu:'Menu', produkty:'Produkty', domov:'ARLing: úvod', nav:'Hlavná navigácia', stranka:'Na tejto stránke', skip:'Prejsť na obsah', cta:'Vyskúšať Proof zadarmo', nazvy:['Nástroje','Piloty','Návody','O firme'] },
      en: { menu:'Menu', produkty:'Products', domov:'ARLing home', nav:'Main navigation', stranka:'On this page', skip:'Skip to content', cta:'Try Proof free', nazvy:['Tools','Pilots','Guides','Company'] },
      de: { menu:'Menü', produkty:'Produkte', domov:'ARLing Startseite', nav:'Hauptnavigation', stranka:'Auf dieser Seite', skip:'Zum Inhalt springen', cta:'Proof kostenlos testen', nazvy:['Werkzeuge','Piloten','Anleitungen','Unternehmen'] },
      cs: { menu:'Menu', produkty:'Produkty', domov:'ARLing: úvod', nav:'Hlavní navigace', stranka:'Na této stránce', skip:'Přejít na obsah', cta:'Vyskúšať Proof zadarmo', nazvy:['Nástroje','Piloty','Návody','O firme'] }
    };
    function jazyk() {
      var kod = (document.documentElement.lang || 'sk').slice(0,2).toLowerCase();
      var t = texty[kod] || texty.sk;
      var cast = kod === 'en' || kod === 'de' ? kod + '/' : '';
      var cesty = ['/'+cast+'#nastroje', '/'+cast+'#piloty', '/notes/'+cast, '/how-we-work/'+cast];
      var proof = kod === 'en' ? '/proof/' : kod === 'de' ? '/proof/de/' : '/proof/sk/';
      hlavicka.querySelectorAll('[data-site-nav]').forEach(function (a) {
        var i = Number(a.getAttribute('data-site-nav'));
        if (!cesty[i]) return;
        a.href = 'https://arling.sk' + cesty[i];
        a.textContent = t.nazvy[i];
      });
      hlavicka.querySelectorAll('[data-site-cta]').forEach(function (a) { a.href = 'https://arling.sk' + proof; });
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
  var meranieCaka = false, predoslaSirka = -1, predoslaVyska = -1;
  function hlavickaVyska() {
    meranieCaka = false;
    // 100vw zahŕňa aj scrollbar. Plátno potrebuje skutočnú šírku obsahu okna,
    // inak na desktope vytváralo vodorovný posun približne o polovicu scrollbaru.
    // Všetky merania pred zápismi: zmena CSS premennej nesmie vynútiť ďalší
    // layout tesne pred getBoundingClientRect. Rovnaké hodnoty nezapisujeme.
    var sirka = document.documentElement.clientWidth;
    var h = document.querySelector('header');
    var v = h ? Math.round(h.getBoundingClientRect().height) : 0;
    if (sirka !== predoslaSirka) {
      document.documentElement.style.setProperty('--sirka-okna', sirka + 'px');
      predoslaSirka = sirka;
    }
    if (v > 0 && v !== predoslaVyska) {
      document.documentElement.style.setProperty('--hlavicka', v + 'px');
      predoslaVyska = v;
    }
  }
  function naplanujMeranie() {
    if (meranieCaka) return;
    meranieCaka = true;
    window.requestAnimationFrame(hlavickaVyska);
  }
  function pripoj() {
    hlavickaVyska();
    window.addEventListener('resize', naplanujMeranie, { passive: true });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(naplanujMeranie);
    // istota pre prípad, že sa niečo dokreslí neskôr
    setTimeout(naplanujMeranie, 400);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pripoj);
  else pripoj();
})();
