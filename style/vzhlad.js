/* Jedno miesto, ktoré sa stará o príchody obsahu na celom webe.
 *
 * Prečo tu a nie v každej stránke: keď to robila každá stránka sama, stačilo,
 * aby sa jej skript nespustil (napríklad kvôli CSP), a návštevník videl prázdne
 * sekcie. Presne to sa stalo 6. 9. 2026. Toto je externý súbor, ktorý CSP dovolí,
 * načíta sa v hlavičke s defer (od 3. 10. 2026: bez defer stál pred CSP meta a zdržal
 * CSS aj písmo o celé jedno stiahnutie, na pomalom mobile asi 1 s do prvého vykreslenia;
 * ops/druhy-ucet/STAV-118.md), funguje aj bez defer, a robí tri veci v poradí dôležitosti:
 *   1. prihlási, že JavaScript beží, takže sa obsah vôbec smie skrývať
 *   2. čokoľvek je pri načítaní v obraze, odhalí okamžite
 *   3. pri scrollovaní odhalí zvyšok, nezávisle od skriptov jednotlivých stránok
 * Ak čokoľvek z toho zlyhá, obsah ostáva viditeľný. Nikdy naopak.
 */
document.documentElement.classList.add('js');

/* CSS mimo prvej obrazovky (3. 10. 2026, ops/druhy-ucet/STAV-118b.md).
 *
 * Stránka s kritickým CSS priamo v hlave má plné súbory zapísané ako
 *   <link rel="stylesheet" media="print" data-async data-href="/style/paper.css?v=…">
 * (bez href, takže sa nesťahujú) a v <noscript> ako obyčajné odkazy. Tento blok ich začne sťahovať až po
 * prvom vykreslení, aby na pomalom mobile nesúperili s HTML a písmom, a zapne ich všetky naraz, keď sú
 * stiahnuté: jeden prepočet štýlov, nie jeden za každý súbor. Odkaz s href a media="print" (bez data-href)
 * sa len prepne. Inline onload sa nepoužíva (CSP).
 * Keď sú štýly zapnuté, <html> dostane triedu `css` a dokument udalosť `arling:css`; skripty, ktoré merajú
 * rozloženie (galéria /motion/), na ňu čakajú. Stránka bez odložených štýlov ju dostane hneď.
 * Stránka otvorená s kotvou alebo už odrolovaná nečaká na vykreslenie: jej prvá obrazovka nie je tá,
 * ktorú kritické CSS pozná. Po zapnutí sa kotva nastaví znova, lebo výšky nad ňou sa zmenili. */
(function () {
  var root = document.documentElement;
  var odkazy = Array.prototype.slice.call(document.querySelectorAll('link[data-async]'));
  function hotovo() {
    root.classList.add('css');
    try { document.dispatchEvent(new Event('arling:css')); } catch (e) {}
  }
  if (!odkazy.length) { hotovo(); return; }
  var caka = odkazy.length, spustene = false, hybal = false;
  function pouzivatel() { hybal = true; }
  ['wheel', 'touchmove', 'keydown', 'pointerdown'].forEach(function (typ) {
    window.addEventListener(typ, pouzivatel, { passive: true, once: true });
  });
  function zapni() {
    odkazy.forEach(function (l) { l.media = 'all'; });
    hotovo();
    if (hybal || location.hash.length < 2) return;
    try {
      var ciel = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (ciel) ciel.scrollIntoView();
    } catch (e) {}
  }
  function nacitaj() {
    if (spustene) return;
    spustene = true;
    odkazy.forEach(function (l) {
      var bol = false;
      function jeden() { if (bol) return; bol = true; if (--caka === 0) zapni(); }
      l.addEventListener('load', jeden);
      l.addEventListener('error', jeden);
      var adresa = l.getAttribute('data-href');
      if (adresa) l.href = adresa;
      else if (l.sheet) jeden();
    });
  }
  // Odrolovanie sa nečíta z pageYOffset (vynútilo by rozloženie celej stránky uprostred skriptu): po obnovení
  // alebo návrate späť prehliadač polohu vracia, pri bežnom príchode bez kotvy je stránka hore.
  var prichod = '';
  try { prichod = performance.getEntriesByType('navigation')[0].type; } catch (e) {}
  var hned = location.hash.length > 1 || prichod === 'reload' || prichod === 'back_forward' || document.visibilityState === 'hidden';
  var typy = window.PerformanceObserver && PerformanceObserver.supportedEntryTypes;
  if (hned || !typy || typy.indexOf('paint') < 0) { nacitaj(); return; }
  try {
    new PerformanceObserver(function (zoznam, po) {
      if (!zoznam.getEntriesByName('first-contentful-paint').length) return;
      po.disconnect();
      nacitaj();
    }).observe({ type: 'paint', buffered: true });
  } catch (e) { nacitaj(); return; }
  // Poistky: karta na pozadí sa nevykreslí vôbec, a ak by záznam o vykreslení neprišiel, štýly nesmú chýbať.
  document.addEventListener('visibilitychange', nacitaj);
  setTimeout(nacitaj, 3000);
})();

/* Zväčšený text (paper v3 pokus 4): Firefox „Zväčšiť len text“ zdvojí aj písmo v px. Sonda so 100 px to prezradí
   (počítaná veľkosť nad 110 px) a trieda v3-text uvoľní tlačidlám pevnú výšku, aby sa zalomený text zmestil.
   Pri bežnej veľkosti trieda nevznikne a nič sa nemení. */
(function () {
  function zmeraj() {
    try {
      var sonda = document.createElement('i');
      sonda.style.cssText = 'position:absolute;visibility:hidden;font-size:100px';
      document.documentElement.appendChild(sonda);
      var velky = parseFloat(getComputedStyle(sonda).fontSize) > 110;
      sonda.parentNode.removeChild(sonda);
      document.documentElement.classList.toggle('v3-text', velky);
    } catch (e) {}
  }
  // Až po prvom snímku: getComputedStyle hneď pri spustení skriptu vynútil prepočet štýlov celej stránky
  // v úlohe skriptu (na /motion/ s CPU 4x 235 ms, Lighthouse 3. 10. 2026). Po snímku sú štýly hotové a sonda
  // stojí len seba. Bez requestAnimationFrame (staré prehliadače) sa meria hneď ako doteraz.
  if (window.requestAnimationFrame) window.requestAnimationFrame(function () { setTimeout(zmeraj, 0); });
  else zmeraj();
  window.addEventListener('resize', zmeraj);
})();

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
    // Z-47: keď Tab alebo Shift+Tab odvedie fokus z otvoreného details, zatvorí sa;
    // inak by na mobile fokus skočil na obsah schovaný pod panelom. Bez relatedTarget
    // (klik na miesto bez fokusu) rozhoduje klik mimo vyššie.
    hlavicka.addEventListener('focusout', function (e) {
      var d = e.target.closest && e.target.closest('details[open]');
      var kam = e.relatedTarget;
      if (d && kam && !d.contains(kam)) d.open = false;
    });
    // Na myši sa Produkty otvárajú prejdením: 90 ms, aby nepreblikli pri ceste
    // kurzora inam, a zatvárajú po 180 ms, aby sa dalo prejsť zo slova na panel.
    // Na mobilnej šírke a na dotyku sa menu otvára len kliknutím.
    var jemne = window.matchMedia('(hover: hover) and (pointer: fine)');
    // V em ako zlom hlavičky v paper.css: pri dvojnásobnom texte prejde hlavička na mobilnú už pri 1 522 px.
    var siroke = window.matchMedia('(min-width: 47.5625em)');
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
      // Andrej 21. 9.: „mám tendenciu na to kliknúť a kliknutím to vypnem“. Na myši preto klik na slovo
      // Produkty otvorené menu nikdy nezatvára; zatvára ho odchod kurzora, Escape alebo klik mimo.
      if (menu.open && jemne.matches && siroke.matches) e.preventDefault();
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
      sk: { menu:'Menu', produkty:'Produkty', domov:'ARLing: úvod', nav:'Hlavná navigácia', stranka:'Na tejto stránke', skip:'Prejsť na obsah', cta:'Skontrolovať e-faktúru zadarmo', nazvy:['Nástroje','Piloty','Návody','O firme'] },
      // „Piloten“ znamená pilotov lietadiel a „Pilots“ je nejasné (audit jazykov 29. 9. 2026); čeština má vlastné názvy.
      en: { menu:'Menu', produkty:'Products', domov:'ARLing home', nav:'Main navigation', stranka:'On this page', skip:'Skip to content', cta:'Shop', nazvy:['Tools','Pilot programs','Guides','Company'] },
      de: { menu:'Menü', produkty:'Produkte', domov:'ARLing Startseite', nav:'Hauptnavigation', stranka:'Auf dieser Seite', skip:'Zum Inhalt springen', cta:'E-Rechnung kostenlos prüfen', nazvy:['Werkzeuge','Pilotprojekte','Anleitungen','Unternehmen'] },
      cs: { menu:'Menu', produkty:'Produkty', domov:'ARLing: úvod', nav:'Hlavní navigace', stranka:'Na této stránce', skip:'Přejít na obsah', cta:'Zkontrolovat e-fakturu zdarma', nazvy:['Nástroje','Pilotní projekty','Návody','O firmě'] }
    };
    function jazyk() {
      var kod = (document.documentElement.lang || 'sk').slice(0,2).toLowerCase();
      var t = texty[kod] || texty.sk;
      var cast = kod === 'en' || kod === 'de' ? kod + '/' : '';
      // Čeština nemá úvod ani /how-we-work/cs/, ale má /notes/cs/ (obal.mjs NAV_CS).
      var cesty = ['/'+cast+'#nastroje', '/'+cast+'#piloty', '/notes/'+(kod === 'cs' ? 'cs/' : cast), '/how-we-work/'+cast];
      // Tlačidlo vedie na produkt s cenou v jazyku stránky (obal.mjs CTA, 25. 9. 2026), nie na Proof.
      var proof = kod === 'en' ? '/shop/' : kod === 'de' ? '/efaktura/de/' : kod === 'cs' ? '/efaktura/cs/' : '/efaktura/';
      hlavicka.querySelectorAll('[data-site-nav]').forEach(function (a) {
        var i = Number(a.getAttribute('data-site-nav'));
        if (!cesty[i]) return;
        a.href = 'https://arling.sk' + cesty[i];
        a.textContent = t.nazvy[i];
      });
      // Stránka produktu môže mať vlastné tlačidlo (obal.mjs CTA_STRANKY); to sa neprepisuje.
      hlavicka.querySelectorAll('[data-site-cta]').forEach(function (a) {
        if (a.getAttribute && a.getAttribute('data-site-cta') === 'vlastne') {
          // Vlastné tlačidlo stránky s prekladmi (obal.mjs ctaMapaPreStranku): prepne sa na jazyk stránky.
          var preklad = a.getAttribute('data-cta-' + kod);
          if (preklad && preklad.indexOf('|') > 0) {
            a.href = preklad.slice(0, preklad.indexOf('|'));
            a.textContent = preklad.slice(preklad.indexOf('|') + 1);
          }
          return;
        }
        a.href = 'https://arling.sk' + proof;
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

  // Bez defer sa tento súbor spustí v <head>, keď <body> ešte neexistuje.
  // Poslucháčov vieme pripojiť hneď (window existuje), ale prvé prepnutie musí
  // počkať na telo dokumentu, inak by hlavička ostala navždy priehľadná.
  // S defer je dokument už rozparsovaný a prepne sa hneď.
  window.addEventListener('scroll', naScroll, { passive: true });
  window.addEventListener('resize', naScroll, { passive: true });
  // Prvé prepnutie až po prvom snímku (requestAnimationFrame a za ním setTimeout): čítanie pageYOffset pri
  // DOMContentLoaded alebo priamo v prvom snímku vynútilo prvé rozloženie celej stránky v úlohe tohto skriptu
  // (na /motion/ 65 ms, s CPU 4x dlhá úloha). Po snímku je rozloženie hotové a čítanie nestojí nič. Stránku
  // otvorenú odrolovanú (kotva, obnovenie) medzitým prepne aj udalosť scroll. Bez requestAnimationFrame ako doteraz.
  function prve() {
    if (window.requestAnimationFrame) window.requestAnimationFrame(function () { setTimeout(prepni, 0); });
    else prepni();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', prve);
  else prve();
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
  var pisalSirku = false, pisalVysku = false;
  function hlavickaVyska() {
    meranieCaka = false;
    // 100vw zahŕňa aj scrollbar. Plátno potrebuje skutočnú šírku obsahu okna,
    // inak na desktope vytváralo vodorovný posun približne o polovicu scrollbaru.
    // Všetky merania pred zápismi: zmena CSS premennej nesmie vynútiť ďalší
    // layout tesne pred getBoundingClientRect. Rovnaké hodnoty nezapisujeme.
    var sirka = document.documentElement.clientWidth;
    var h = document.querySelector('header');
    var v = h ? Math.round(h.getBoundingClientRect().height) : 0;
    // Zápis premennej na <html> prepočíta štýly celej stránky (na /motion/ 1 500 prvkov, s CPU 4x dlhá
    // úloha 204 ms, 3. 10. 2026). Preto sa nepíše to, čo CSS už vie:
    //  - šírka sa píše, len keď sa líši od 100vw (klasický scrollbar) alebo keď ju potrebuje plátno
    //    .zar-plocha, ktorého náhradná hodnota je 100 % rodiča; ostatní ju čítajú s náhradou 100vw;
    //  - výška sa nepíše, keď rezerva pod hlavičkou (padding-top prvku main, v paper.css z --hlavicka
    //    cez :has()) už sedí so skutočnou výškou.
    if (sirka !== predoslaSirka) {
      if (pisalSirku || sirka !== window.innerWidth || document.querySelector('.zar-plocha')) {
        document.documentElement.style.setProperty('--sirka-okna', sirka + 'px');
        pisalSirku = true;
      }
      predoslaSirka = sirka;
    }
    if (v > 0 && v !== predoslaVyska) {
      var m = pisalVysku ? null : document.querySelector('main');
      var rezerva = m ? Math.round(parseFloat(getComputedStyle(m).paddingTop)) : -1;
      if (v !== rezerva) {
        document.documentElement.style.setProperty('--hlavicka', v + 'px');
        pisalVysku = true;
      }
      predoslaVyska = v;
    }
  }
  function naplanujMeranie() {
    if (meranieCaka) return;
    meranieCaka = true;
    window.requestAnimationFrame(hlavickaVyska);
  }
  function pripoj() {
    var h = document.querySelector('header');
    if (window.ResizeObserver && h) {
      // ResizeObserver hlási po rozložení, ktoré prehliadač robí tak či tak: čítanie rozmerov v ňom
      // nevynúti rozloženie uprostred skriptu, ako to robilo meranie hneď pri DOMContentLoaded.
      new ResizeObserver(hlavickaVyska).observe(h);
    } else {
      hlavickaVyska();
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(naplanujMeranie);
      // istota pre prípad, že sa niečo dokreslí neskôr
      setTimeout(naplanujMeranie, 400);
    }
    window.addEventListener('resize', naplanujMeranie, { passive: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pripoj);
  else pripoj();
})();
