/* Prihlási sa, že JavaScript beží, a postrážiť, aby obsah nikdy neostal skrytý.
 *
 * Musí to byť samostatný súbor, nie vložený skript: naše stránky majú prísne CSP,
 * ktoré vložené skripty blokuje. Načítava sa v hlavičke BEZ defer, aby sa stihla
 * pred vykreslením a obsah neblikol.
 *
 * Poistka nižšie je dôležitejšia než samotná animácia: každý prvok, ktorý je pri
 * načítaní vidno, sa odhalí okamžite, nech už si stránka robí čo chce. Bez toho
 * stačí jedna chyba v skripte stránky a návštevník vidí prázdny úvod.
 */
document.documentElement.classList.add('js');

(function () {
  function odhal(vsetko) {
    var vyska = window.innerHeight || 800;
    document.querySelectorAll('.r:not(.in)').forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (vsetko || r.top < vyska * 0.98) el.classList.add('in');
    });
    document.querySelectorAll('.hero, .hero .r, h1').forEach(function (el) { el.classList.add('in'); });
  }
  function start() {
    requestAnimationFrame(function () { odhal(false); });
    // keby skript stránky zlyhal, po chvíli ukáž všetko, čo je v obraze
    setTimeout(function () { odhal(false); }, 900);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
