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
