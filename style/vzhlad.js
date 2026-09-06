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
