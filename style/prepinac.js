/* Prepínač jazykov do hlavičky. Spoločný pre všetky naše stránky.
 *
 * Dva zdroje, v tomto poradí:
 *   1. `hreflang` odkazy na stránke. Keď ich má, prepínač ponúkne presne tie
 *      verzie a odkáže na TÚ ISTÚ stránku v inom jazyku. To je správny stav.
 *   2. Keď ich stránka nemá, prepínač sa aj tak vykreslí, ale odkáže na
 *      domovskú stránku v danom jazyku a položku označí ako „iba domovská".
 *
 * Prečo aj ten druhý prípad: Andrej chce prepínač na každej stránke, a je to
 * správne aj z pohľadu návštevníka. Nemec, ktorý pristane na slovenskom článku,
 * musí mať kam kliknúť. Predstierať, že preklad existuje, by ale bolo horšie
 * než ho neponúknuť, preto sa taká položka správa inak a hovorí to nahlas.
 *
 * Otvára sa bez JavaScriptu (details a summary), takže funguje aj vtedy,
 * keď sa skript nenačíta; skript ho len postaví.
 */
(function () {
  'use strict';
  var NAZVY = { sk: 'Slovensky', cs: 'Česky', en: 'English', de: 'Deutsch', hu: 'Magyar', pl: 'Polski' };
  var SKRATKY = { sk: 'SK', cs: 'CS', en: 'EN', de: 'DE', hu: 'HU', pl: 'PL' };

  /* Jazyky, ktoré web naozaj má, a kde je ich domovská stránka.
     Slovenčina je v koreni, ostatné v podpriečinkoch. Keď pribudne jazyk,
     stačí ho dopísať sem a do ops/i18n/preklad.mjs. */
  var DOMOVSKE = [
    { kod: 'sk', href: 'https://arling.sk/' },
    { kod: 'en', href: 'https://arling.sk/en/' },
    { kod: 'de', href: 'https://arling.sk/de/' },
  ];

  /* Stránka, ktorá si prepínač robí sama (Asistent, bankové nástroje a ďalšie
     s vlastným i18n.js), už jeden má. Pridať druhý vedľa neho je horšie než
     nepridať žiadny: návštevník vidí dve rôzne ovládania toho istého. */
  function uzMaVlastny(bar) {
    if (bar.querySelector('.langsel')) return true;
    if (bar.querySelector('[data-lang-switch], .lang-switch, .langs, .i18n-switch')) return true;
    // vlastný prepínač býva skupina odkazov alebo tlačidiel s kódmi jazykov
    var kody = { sk: 1, cs: 1, en: 1, de: 1, hu: 1, pl: 1 };
    var zhody = 0;
    Array.prototype.forEach.call(bar.querySelectorAll('a, button'), function (el) {
      var t = (el.textContent || '').trim().toLowerCase();
      if (t.length === 2 && kody[t]) zhody++;
    });
    return zhody >= 2;
  }

  function postav() {
    var bar = document.querySelector('.bar');
    if (!bar || uzMaVlastny(bar)) return;

    var tu = (document.documentElement.getAttribute('lang') || 'sk').slice(0, 2).toLowerCase();

    // 1. verzie tejto konkrétnej stránky
    var verzie = [];
    Array.prototype.forEach.call(document.querySelectorAll('link[rel="alternate"][hreflang]'), function (l) {
      var kod = (l.getAttribute('hreflang') || '').slice(0, 2).toLowerCase();
      var href = l.getAttribute('href');
      if (!kod || kod === 'x-' || !href) return;
      if (!verzie.some(function (v) { return v.kod === kod; })) verzie.push({ kod: kod, href: href, presna: true });
    });

    // Zámerne sa NEDOPĹŇAJÚ jazyky, v ktorých táto stránka nie je.
    //
    // Predtým sa dopĺňali a položka sa označila ako „domovská". Andrej to
    // 6. 9. 2026 zhrnul presne: „prečo ma to hodí na domovskú, ono to má
    // preložiť tú stránku, na ktorej som." Má pravdu. Prepínač jazyka má
    // jednu úlohu, dať tú istú stránku v inom jazyku. Keď ju dať nevie, je
    // čestnejšie ten jazyk neponúknuť, než človeka odviesť inam.
    //
    // Dôsledok je zámerný a nepríjemný: na stránke bez prekladu prepínač
    // zmizne. To je správny tlak. Chýbajúci preklad sa má doplniť, nie
    // zakryť odkazom na domovskú stránku.

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
      a.setAttribute('hreflang', v.kod);
      a.setAttribute('data-umami-event', 'lang-' + v.kod);
      a.textContent = NAZVY[v.kod] || v.kod;
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
    document.addEventListener('click', function (e) {
      if (d.open && !d.contains(e.target)) d.open = false;
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && d.open) { d.open = false; s.focus(); }
    });

    var lang = bar.querySelector('.lang, select.lang');
    if (lang && lang.tagName === 'SELECT') lang.replaceWith(d);
    else bar.appendChild(d);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', postav);
  else postav();
})();
