/* Paper v3 (28. 9. 2026): pohyb spoločný pre celý web (ops/design/paper-v3/NAVRH.md, časť 6).
 * Samostatný súbor s defer, nie vo vzhlad.js: vzhlad.js blokuje vykreslenie v hlave a o 14 kB väčší
 * posunul prvé vykreslenie (LCP) obchodu o 350 až 600 ms (brána 28. 9., nález 3, dokazy-p2/lcp-*.json).
 * Obal (ops/design/obal.mjs) ho vkladá pred </body>, sync-paper.mjs ho kopíruje do style/. Názov nie
 * pohyb.js: style/pohyb/ v hube sú scény filmov (pohyb-web.css), s tým nemá nič spoločné.
 *   1. stlačenie tlačidla na dotyku a klávesnici (trieda v3-stlac, :active sa na mobile ukáže neskoro);
 *   2. svit karty (Magic Card z úvodu): na myši zapisuje --mx a --my, raz za snímok;
 *   3. vstup blokov: len blok bez vlastnej animácie, ktorý je ešte celý pod oknom, sa raz vynorí
 *      cez el.animate; čo už v okne je (kotva, návrat zhora), sa nikdy neskryje; vlastnosť animation
 *      sa nemení (pokus 1 cez CSS triedu spúšťal príchod .r znova, nález 1). v3-vstup je len značka;
 *   4. počítadlo pre data-pocitadlo (nikdy ceny).
 * Vypnuté: znížený pohyb; zapnutý počas otvorenej stránky zastaví vstupy, svit aj počítadlá (tie ukážu
 * konečný text) a nič sa nezapne do nového načítania (pokus 3). Ďalej body.efv4 (experiment do 2. 10.),
 * body.uvod a body[data-v3-bez]. Každá časť sa vzdá, keď chýba API. Testy: ops/design/vzhlad-v3.test.mjs. */
(function () {
  'use strict';
  var ZNIZENY = '(prefers-reduced-motion: reduce)';
  function plati(dotaz) {
    try { return !!(window.matchMedia && window.matchMedia(dotaz).matches); } catch (e) { return false; }
  }

  // Stlačenie: dotyk a pero pri pointerdown, klávesnica pri Enter (odkaz aj tlačidlo) a medzerníku
  // (len tlačidlo, na odkaze medzerník roluje stránku). Myš má :active v CSS.
  function stlacenie() {
    var TLACIDLA = '.btn,header.site-header .site-cta,footer.site-footer .site-cta';
    var stlacene = null;
    function pust() { if (stlacene) stlacene.classList.remove('v3-stlac'); stlacene = null; }
    function stlac(b) {
      if (!b || b.disabled || b.getAttribute('aria-disabled') === 'true') return;
      pust();
      stlacene = b;
      b.classList.add('v3-stlac');
    }
    document.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' || !e.target || !e.target.closest) return;
      stlac(e.target.closest(TLACIDLA));
    }, { capture: true, passive: true });
    document.addEventListener('keydown', function (e) {
      if (e.repeat || (e.key !== 'Enter' && e.key !== ' ') || !e.target || !e.target.closest) return;
      var b = e.target.closest(TLACIDLA);
      if (!b || b !== e.target || (e.key === ' ' && b.tagName === 'A')) return;
      stlac(b);
    }, true);
    ['pointerup', 'pointercancel', 'dragstart', 'keyup', 'focusout'].forEach(function (t) {
      document.addEventListener(t, pust, { capture: true, passive: true });
    });
    window.addEventListener('blur', pust);
  }

  // Znížený pohyb zapnutý počas otvorenej stránky (pokus 3, nález 3 brány): každá časť sa sem zapíše
  // funkciou, ktorá ju zastaví; zastavVsetko ich spustí raz a nič sa už nezapne až do nového načítania.
  var vypnute = false, zastavenia = [];
  function priZnizenom(fn) { if (vypnute) fn(); else zastavenia.push(fn); }
  function zastavVsetko() {
    if (vypnute) return;
    vypnute = true;
    zastavenia.splice(0).forEach(function (fn) { try { fn(); } catch (e) {} });
  }

  function svitKariet() {
    // Obdĺžnik karty sa meria raz pri vstupe kurzora a znova až po rolovaní alebo zmene veľkosti, nie v každom snímku:
    // getBoundingClientRect po zápise --mx vynúti prepočet rozloženia (pokus 4, dokazy-p4/pohyb-svit.json).
    var karta = null, r = null, x = 0, y = 0, caka = false;
    // Stráž plynulosti: prekreslenie okraja so svitom stojí vo Firefoxe bez GPU 5 až 20 ms na snímok. Hodinky merajú
    // snímky počas pohybu po karte; keď v okne 20 snímok prídu 2 dlhšie ako 24 ms, svit sa odvtedy zapisuje len každý
    // 3. snímok zastane rozsvietený na mieste (do nového načítania); riedky režim sa od 28. 9. nepoužíva. Plynulosť má prednosť.
    var krok = 1, poradie = 0, hodiny = 0, predosly = 0, snimok = 0, dlhych = 0, posledny = 0;
    function hodinky(t) {
      if (predosly) { snimok++; if (t - predosly > 24) dlhych++; }
      predosly = t;
      // Reaguje hneď po druhom dlhom snímku v okne 20 snímok, nie až na konci okna (inak by zhluk dlhých
      // snímok pri prechode stredom veľkej karty trval až 8 snímok, dokazy-p4/pohyb-svit-parove-*.json).
      if (dlhych >= 2) {
        // Brána pokus 4 (28. 9.): riedky zápis každý 3. snímok pôsobil trhane (asi 20 zmien za sekundu),
        // preto pri prvom zistení pomalosti svit hneď zastane rozsvietený na mieste.
        krok = 0;
        // Stopa pre meranie a ladenie (dokazy-p4/pohyb-svit.mjs): riedky alebo stoji.
        try { document.documentElement.setAttribute('data-v3-svit', krok ? 'riedky' : 'stoji'); } catch (e) {}
        snimok = 0; dlhych = 0;
      } else if (snimok >= 20) { snimok = 0; dlhych = 0; }
      if (!vypnute && krok && Date.now() - posledny < 200) hodiny = window.requestAnimationFrame(hodinky);
      else { hodiny = 0; predosly = 0; snimok = 0; dlhych = 0; }
    }
    function kresli() {
      caka = false;
      if (!karta || vypnute || !krok) return;
      // Riedky zápis: preskočený snímok si naplánuje ďalší, aby posledná poloha kurzora nikdy nezostala nezapísaná.
      if (krok > 1 && ++poradie % krok) { caka = true; window.requestAnimationFrame(kresli); return; }
      if (!r) r = karta.getBoundingClientRect();
      karta.style.setProperty('--mx', Math.round(x - r.left) + 'px');
      karta.style.setProperty('--my', Math.round(y - r.top) + 'px');
    }
    function pohyb(e) {
      if (vypnute || !krok) return;
      var k = e.target && e.target.closest ? e.target.closest('.card,.karta,[data-svit]') : null;
      if (!k) return;
      if (k !== karta) r = null;
      karta = k; x = e.clientX; y = e.clientY;
      posledny = Date.now();
      if (!hodiny) hodiny = window.requestAnimationFrame(hodinky);
      if (!caka) { caka = true; window.requestAnimationFrame(kresli); }
    }
    function zabudni() { r = null; }
    window.addEventListener('scroll', zabudni, { passive: true, capture: true });
    window.addEventListener('resize', zabudni, { passive: true });
    document.addEventListener('click', zabudni, { passive: true, capture: true });
    document.addEventListener('pointermove', pohyb, { passive: true });
    // Svit stojí: poslucháč preč, posledná karta stratí polohu (okraj sa vráti do stredu ako bez skriptu).
    priZnizenom(function () {
      if (document.removeEventListener) document.removeEventListener('pointermove', pohyb, { passive: true });
      if (window.removeEventListener) { window.removeEventListener('scroll', zabudni, { passive: true, capture: true }); window.removeEventListener('resize', zabudni, { passive: true }); document.removeEventListener('click', zabudni, { passive: true, capture: true }); }
      if (karta && karta.style && karta.style.removeProperty) { karta.style.removeProperty('--mx'); karta.style.removeProperty('--my'); }
      karta = null;
    });
  }

  // Bloky, ktoré sa smú pohnúť: priame časti sekcií a hlavného stĺpca. Nič, čo má vlastný
  // systém odhalenia (.zjav z úvodu, e-faktúry a obchodu), herná plocha, plátno, video,
  // pevné a lepiace prvky, linka .rule (má vlastnú kresbu) a všetko s data-v3-bez.
  var BLOKY = 'main section > .wrap > *, main section > :not(.wrap):not(section), main > .wrap > :not(section)';
  var NIE = '.zjav, .zjav *, [data-v3-bez], [data-v3-bez] *, .rule, script, style, template, dialog';
  var VNUTRI = 'canvas, video, iframe, .zjav, [data-v3-bez]';

  // Prvok s akoukoľvek vlastnou animáciou (príchod .r s fill both, slučka stránky, bežiaci prechod) si ju
  // nechá a vstup v3 nedostane: nič sa nevrství a nič sa nespúšťa znova. Prečo nie aj .r: vo Firefoxe
  // vstup cez el.animate na blokoch .r s ich príchodom robil na porovnaniach Asistenta (1440 px) 8 až 12
  // snímok nad 33 ms pri rolovaní, pred v3 0 až 1; po vynechaní takých blokov 0 až 1 (dokazy-p2/diagnoza-firefox.json).
  // Blok .r pod ohybom sa tak správa ako pred v3.
  function maVlastnuAnimaciu(el) {
    try { return !!(el.getAnimations && el.getAnimations().length); } catch (e) { return true; }
  }

  var oko = null, bezia = [];
  var KRIVKA = 'cubic-bezier(.16,1,.3,1)';

  // Jeden vstup: 700 ms z opacity .001 a 18 px pod miestom do stavu, ktorý má prvok sám (implicitný
  // koncový snímok, takže vlastný transform ani hover sa neprebijú). fill backwards drží začiatok len
  // počas odstupu; po dobehnutí po animácii neostane nič. Koniec počúva len túto jednu animáciu.
  function vstup(el, poradie) {
    if (!el.animate || plati(ZNIZENY)) return;
    // offset 0 je nutný: jediný snímok bez offsetu je podľa špecifikácie koncový (offset 1), blok by
    // potom zhasínal a na konci naskočil (zachytilo meranie v Chrome 28. 9.).
    var zaciatok = { opacity: 0.001, transform: 'translate3d(0,18px,0)', offset: 0 };
    var nastavenie = { duration: 700, delay: Math.min(poradie, 5) * 70, easing: KRIVKA, fill: 'backwards' };
    var a;
    try { a = el.animate([zaciatok], nastavenie); }
    catch (e) { a = el.animate([zaciatok, { opacity: 1, transform: 'none' }], nastavenie); }
    el.classList.add('v3-vstup');
    bezia.push(a);
    function koniec() {
      el.classList.remove('v3-vstup');
      var k = bezia.indexOf(a);
      if (k >= 0) bezia.splice(k, 1);
    }
    a.onfinish = koniec;
    a.oncancel = koniec;
  }

  // Znížený pohyb zapnutý počas otvorenej stránky: pozorovanie končí, bežiace vstupy sa zrušia
  // (zrušená animácia vráti prvok hneď do plného stavu).
  function zastavVstupy() {
    if (oko) { oko.disconnect(); oko = null; }
    bezia.slice().forEach(function (a) { try { a.cancel(); } catch (e) {} });
  }
  function sledujZnizeny() {
    var mq;
    try { mq = window.matchMedia && window.matchMedia(ZNIZENY); } catch (e) { return; }
    if (!mq) return;
    function zmena() { if (mq.matches) zastavVsetko(); }
    if (mq.addEventListener) mq.addEventListener('change', zmena);
    else if (mq.addListener) mq.addListener(zmena);
  }

  function vstupBlokov() {
    if (!document.body.animate) return;
    var vyska = window.innerHeight || 800;
    var kandidati = Array.prototype.slice.call(document.querySelectorAll(BLOKY), 0, 400);
    var vybrane = [];
    var mnozina = typeof Set === 'function' ? new Set() : null;
    if (!mnozina) return;
    kandidati.forEach(function (el) {
      if (el.matches(NIE) || el.querySelector(VNUTRI)) return;
      for (var o = el.parentElement; o && o.tagName !== 'MAIN'; o = o.parentElement) if (mnozina.has(o)) return;
      var r = el.getBoundingClientRect();
      if (r.height <= 0 || r.top < vyska) return;
      mnozina.add(el);
      vybrane.push(el);
    });
    vybrane = vybrane.filter(function (el) {
      var poz = window.getComputedStyle(el).position;
      return poz !== 'fixed' && poz !== 'sticky' && !maVlastnuAnimaciu(el);
    });
    if (!vybrane.length) return;
    oko = new IntersectionObserver(function (zaznamy) {
      var h = window.innerHeight || 800, i = 0;
      zaznamy.forEach(function (z) {
        if (!z.isIntersecting || !oko) return;
        // Každý blok najviac raz: po prvom zázname sa už nikdy nepozoruje.
        oko.unobserve(z.target);
        // Vstup len pre blok, ktorý je ešte celý pod spodnou hranou okna. Čo už čo i len kúskom vidno
        // (rýchly posun, kotva, návrat zhora, neskorý záznam), sa nechá tak: viditeľný text sa neskrýva.
        if (z.boundingClientRect.top < h) return;
        vstup(z.target, i++);
      });
    // Pozoruje sa o 25 % okna pod spodnou hranou: vstup sa naplánuje, kým blok ešte nie je vidieť, aj pri
    // kroku kolieska okolo 100 px a keď prehliadač doručí záznam o snímok neskôr (Firefox pri rýchlom rolovaní).
    }, { threshold: 0, rootMargin: '0px 0px 25% 0px' });
    vybrane.forEach(function (el) { oko.observe(el); });
  }

  // Počítadlo len pre počty (napr. „332 kontrol“), nikdy pre sumy: text s €, $, £ alebo Kč sa
  // nepočíta (PRINCIPY-UI-600K bod 2). Čo je pri načítaní v okne, sa nepočíta vôbec.
  function pocitadla() {
    var vyska = window.innerHeight || 800;
    var prvky = Array.prototype.filter.call(document.querySelectorAll('[data-pocitadlo]'), function (el) {
      var t = el.textContent || '';
      return /\d/.test(t) && !/[€$£]|Kč/.test(t) && el.getBoundingClientRect().top >= vyska;
    });
    if (!prvky.length) return;
    // Bežiace počítadlá: pri zníženom pohybe sa zastavia a hneď ukážu konečný text.
    var bezi = [];
    var oko = new IntersectionObserver(function (zaznamy) {
      zaznamy.forEach(function (z) {
        if (!z.isIntersecting || vypnute) return;
        oko.unobserve(z.target);
        var el = z.target, povodny = el.textContent;
        // Skupiny po troch s medzerou, alebo číslo bez oddeľovača; medzera za číslom k nemu nepatrí.
        var m = /(\d{1,3}(?:[ \u00a0\u202f]\d{3})+|\d+)([.,]\d+)?/.exec(povodny);
        if (!m) return;
        var cele = parseInt(m[1].replace(/[ \u00a0\u202f]/g, ''), 10);
        var des = m[2] ? m[2].length - 1 : 0;
        var ciel = cele + (des ? parseFloat('0.' + m[2].slice(1)) : 0);
        var oddelovac = /[ \u00a0\u202f]/.exec(m[1]);
        var ciarka = m[2] ? m[2].charAt(0) : ',';
        function formatuj(v) {
          var s = v.toFixed(des).split('.');
          if (oddelovac) s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, oddelovac[0]);
          return povodny.slice(0, m.index) + s[0] + (des ? ciarka + s[1] : '') + povodny.slice(m.index + m[0].length);
        }
        el.setAttribute('aria-label', povodny);
        var t0 = 0, beh = { hotovo: false };
        function dokonci() {
          if (beh.hotovo) return;
          beh.hotovo = true;
          el.textContent = povodny;
          el.removeAttribute('aria-label');
          var k = bezi.indexOf(beh);
          if (k >= 0) bezi.splice(k, 1);
        }
        beh.dokonci = dokonci;
        bezi.push(beh);
        function krok(t) {
          if (beh.hotovo) return;
          if (!t0) t0 = t;
          var k = Math.min(1, (t - t0) / 900);
          if (k < 1) { el.textContent = formatuj(ciel * (1 - Math.pow(1 - k, 3))); window.requestAnimationFrame(krok); }
          else dokonci();
        }
        window.requestAnimationFrame(krok);
      });
    }, { threshold: 0.6 });
    prvky.forEach(function (el) { oko.observe(el); });
    // Pozorovanie končí (nespustené počítadlá ostanú s pôvodným textom), bežiace skočia na koniec.
    priZnizenom(function () {
      oko.disconnect();
      bezi.slice().forEach(function (b) { b.dokonci(); });
    });
  }

  function pripoj() {
    var telo = document.body;
    if (!telo || !telo.classList || !telo.classList.contains('noc') || !document.querySelectorAll) return;
    try { stlacenie(); } catch (e) {}
    if (plati(ZNIZENY)) return;
    if (!window.requestAnimationFrame) return;
    // Zmena preferencie sa sleduje hneď (aj na e-faktúre a úvode, kde beží svit alebo počítadlo).
    try { sledujZnizeny(); } catch (e) {}
    try { if (plati('(hover: hover) and (pointer: fine)')) svitKariet(); } catch (e) {}
    if (!('IntersectionObserver' in window)) return;
    // E-faktúra (experiment do 2. 10.) a úvod majú vlastné odhaľovanie; data-v3-bez vypne vstup ručne.
    var bezVstupu = telo.classList.contains('efv4') || telo.classList.contains('uvod') ||
      (telo.hasAttribute && telo.hasAttribute('data-v3-bez'));
    // Polohy blokov sa merajú až po load: Firefox môže spustiť DOMContentLoaded skôr, než sa CSS
    // uplatní (meranie by videlo nenaštýlovanú stránku).
    function poNacitani() {
      if (plati(ZNIZENY)) { zastavVsetko(); return; }
      if (!bezVstupu) {
        try { vstupBlokov(); } catch (e) {}
        priZnizenom(zastavVstupy);
      }
      try { pocitadla(); } catch (e) {}
    }
    // Stránka s kritickým CSS v hlave zapína plné štýly až po prvom vykreslení (vzhlad.js, trieda css na
    // <html> a udalosť arling:css); load môže prísť skôr, a meranie by znova videlo nenaštýlovanú stránku.
    function poStyloch() {
      var caka = false;
      try {
        var root = document.documentElement;
        caka = !!document.querySelector('link[data-async]') && !(root && root.classList && root.classList.contains('css'));
      } catch (e) {}
      if (caka) document.addEventListener('arling:css', poNacitani);
      else poNacitani();
    }
    if (document.readyState === 'complete') poStyloch();
    else window.addEventListener('load', poStyloch);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', pripoj);
  else pripoj();
})();
