/* ARLing: plný katalóg v menu a päte (en). Vyrobil ops/design/menu-skript.mjs z ops/design/uvod-katalog.mjs,
   ručne needitovať. Stránka má bez JS statickú náhradu (skupiny, stránka Všetko, Firma, tlačidlo);
   tento skript do stĺpcov skupín vloží plný katalóg a k odkazu Všetko počet položiek.
   Načítava sa s defer; panel menu je zatvorený, takže vloženie do menu nič neposunie.
   Päta sa rozvinie len vtedy, keď jej stĺpce ešte nie sú v obraze (dlhá stránka): vtedy sa pohne
   len to, čo človek nevidí, a posun rozloženia (CLS) je nula. Na krátkej stránke (404, kontakt),
   kde je päta v obraze hneď, ostane statická náhrada, ktorá vedie na každú skupinu a na stránku Všetko;
   keď ju neskôr obsah kreslený v JS odsunie pod obraz, rozvinie sa tiež. Otvorené menu sa neprepisuje,
   katalóg doň príde po zatvorení. */
(function () {
  'use strict';
  var menu = {
 "firmy": "<p>Businesses and accountants</p><ul><li><a href=\"https://arling.sk/super-intelligence/\"><b>AI to SI Checker<em class=\"site-nove\">New</em></b><span>Switch AI to SI wording, keep law titles</span></a></li><li><a href=\"https://arling.sk/rukopis/en/\"><b>Rukopis</b><span>Finds stock phrases in your writing</span></a></li><li><a href=\"https://arling.sk/efaktura/en/\"><b>E-invoice</b><span>Check, preview and create XML</span></a></li><li><a href=\"https://arling.sk/kontrola-suboru/en/\"><b>SEPA file check</b><span>Addresses and errors before your bank sees them</span></a></li><li><a href=\"https://arling.sk/sanctions-check/\"><b>EU sanctions check</b><span>Your partner list against the EU sanctions list</span></a></li></ul><a class=\"site-col-all\" href=\"https://arling.sk/vsetko/en/#firmy\" aria-label=\"All in this group: Businesses and accountants (14)\" data-umami-event=\"shell_menu_group\" data-umami-event-target=\"firmy\"><span class=\"site-dlho\">All in this group</span><span class=\"site-kratko\">All</span><b>14</b><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M5 12h13M13 6l6 6-6 6\"/></svg></a>",
 "eshopy": "<p>Online shops and websites</p><ul><li><a href=\"https://arling.sk/asistent/en/\"><b>Asistent</b><span>Sales assistant for online shops</span></a></li><li><a href=\"https://arling.sk/technologies/\"><b>Stacklog<em class=\"site-nove\">New</em></b><span>What a site runs on, and when it changed</span></a></li><li><a href=\"https://arling.sk/mail-doctor/\"><b>Mail Doctor</b><span>SPF, DKIM and DMARC of a domain</span></a></li><li><a href=\"https://arling.sk/feed-doctor/en/\"><b>Feed Doctor</b><span>Product feed check</span></a></li></ul><a class=\"site-col-all\" href=\"https://arling.sk/vsetko/en/#eshopy\" aria-label=\"All in this group: Online shops and websites (6)\" data-umami-event=\"shell_menu_group\" data-umami-event-target=\"eshopy\"><span class=\"site-dlho\">All in this group</span><span class=\"site-kratko\">All</span><b>6</b><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M5 12h13M13 6l6 6-6 6\"/></svg></a>",
 "hry": "<p>Games and puzzles</p><ul><li><a href=\"https://arling.sk/shop/escape-room-kids/\"><b>The Dragon Who Slept on the Key</b><span>Printable escape room for kids 7 to 10, 7.90 €</span></a></li><li><a href=\"https://arling.sk/shop/escape-room-adults/\"><b>The Clockmaker's Workshop</b><span>Printable escape game for adults, 9.90 €</span></a></li><li><a href=\"https://arling.sk/shop/murder-lantern-ball/\"><b>Murder at the Lantern Ball</b><span>Printable murder mystery for adults and teens, 5.90 €</span></a></li><li><a href=\"https://arling.sk/shop/your-friends-as-witnesses/\"><b>Your friends as witnesses<em class=\"site-nove\">New</em></b><span>Printable murder mystery with your friends’ names, 12.90 € on Etsy</span></a></li><li><a href=\"https://arling.sk/shop/custom-crossword/\"><b>Custom crossword</b><span>Printable crossword made from your own words, 14.90 € on Etsy</span></a></li></ul><a class=\"site-col-all\" href=\"https://arling.sk/vsetko/en/#hry\" aria-label=\"All in this group: Games and puzzles (22)\" data-umami-event=\"shell_menu_group\" data-umami-event-target=\"hry\"><span class=\"site-dlho\">All in this group</span><span class=\"site-kratko\">All</span><b>22</b><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M5 12h13M13 6l6 6-6 6\"/></svg></a>",
 "knihy": "<p>Books and gifts</p><ul><li><a href=\"https://arling.sk/shop/budget-2027/\"><b>2027 Budget Spreadsheet</b><span>For Excel and Google Sheets, 9.90 €</span></a></li><li><a href=\"https://arling.sk/shop/\"><b>Shop</b><span>Books, puzzles and gifts</span></a></li><li><a href=\"https://arling.sk/puzzle-books/eink-bundle/\"><b>E-ink puzzle bundle</b><span>3000 puzzles in ten books</span></a></li><li><a href=\"https://arling.sk/printables/\"><b>Seasonal printables<em class=\"site-nove\">New</em></b><span>Halloween, Thanksgiving, Christmas and all year</span></a></li><li><a href=\"https://arling.sk/puzzle-books/printable-puzzle-advent-calendar-2026-48-christmas-logic/\"><b>Advent Puzzle Calendar 2026</b><span>24 days, 48 printable logic puzzles, 4.90 €</span></a></li></ul><a class=\"site-col-all\" href=\"https://arling.sk/vsetko/en/#knihy\" aria-label=\"All in this group: Books and gifts (15)\" data-umami-event=\"shell_menu_group\" data-umami-event-target=\"knihy\"><span class=\"site-dlho\">All in this group</span><span class=\"site-kratko\">All</span><b>15</b><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M5 12h13M13 6l6 6-6 6\"/></svg></a>"
};
  var pata = {
 "firmy": "<p>Businesses and accountants</p><ul><li><a href=\"https://arling.sk/super-intelligence/\">AI to SI Checker</a></li><li><a href=\"https://arling.sk/rukopis/en/\">Rukopis</a></li><li><a href=\"https://arling.sk/efaktura/en/\">E-invoice</a></li><li><a href=\"https://arling.sk/kontrola-suboru/en/\">SEPA file check</a></li><li><a href=\"https://arling.sk/bankove-nastroje/en/\">Banking tools Pro</a></li><li><a href=\"https://arling.sk/proof/\">Proof</a></li><li><a href=\"https://arling.sk/renewals/\">Renewals</a></li><li><a href=\"https://arling.sk/parovac-platieb/en/\">Payment matcher</a></li><li><a href=\"https://arling.sk/sepa-pain001-doctor/en/\">pain.001 check</a></li><li><a href=\"https://arling.sk/sepa-pain001-generator/en/\">pain.001 generator</a></li><li><a href=\"https://arling.sk/camt053-to-excel/en/\">Statement to Excel</a></li><li><a href=\"https://arling.sk/vzory-zmluv/\">Contract templates<em class=\"site-sk\">SK</em></a></li><li><a href=\"https://arling.sk/zivotopis/en/\">CV builder</a></li><li><a href=\"https://arling.sk/sanctions-check/\">EU sanctions check</a></li></ul>",
 "eshopy": "<p>Online shops and websites</p><ul><li><a href=\"https://arling.sk/asistent/en/\">Asistent</a></li><li><a href=\"https://arling.sk/gdpr-dokumenty/\">GDPR documents<em class=\"site-sk\">SK</em></a></li><li><a href=\"https://arling.sk/kontrola-eshopu/\">Online shop check<em class=\"site-sk\">SK</em></a></li><li><a href=\"https://arling.sk/technologies/\">Stacklog</a></li><li><a href=\"https://arling.sk/mail-doctor/\">Mail Doctor</a></li><li><a href=\"https://arling.sk/feed-doctor/en/\">Feed Doctor</a></li></ul>",
 "hry": "<p>Games and puzzles</p><ul><li><a href=\"https://arling.sk/games/\">Browser games</a></li><li><a href=\"https://arling.sk/shop/detective-kit-2/\">The Muddy Footprints</a></li><li><a href=\"https://arling.sk/shop/escape-room-kids/\">The Dragon Who Slept on the Key</a></li><li><a href=\"https://arling.sk/shop/escape-room-adults/\">The Clockmaker's Workshop</a></li><li><a href=\"https://arling.sk/shop/mystery-case-adults/\">The Ashgrove Heron</a></li><li><a href=\"https://arling.sk/play/stop/\">Stop at the right frame</a></li><li><a href=\"https://arling.sk/games/owls/\">Owls</a></li><li><a href=\"https://arling.sk/games/beavers/\">Beavers</a></li><li><a href=\"https://arling.sk/games/foxes/\">Foxes</a></li><li><a href=\"https://arling.sk/games/field-notes/\">Field Notes</a></li><li><a href=\"https://arling.sk/shop/detective-kit/\">Detective kit</a></li><li><a href=\"https://arling.sk/shop/pumpkin-escape-kids/\">The Pumpkin Fair Mix-Up</a></li><li><a href=\"https://arling.sk/shop/murder-lantern-ball/\">Murder at the Lantern Ball</a></li><li><a href=\"https://arling.sk/shop/your-friends-as-witnesses/\">Your friends as witnesses</a></li><li><a href=\"https://arling.sk/shop/custom-crossword/\">Custom crossword</a></li><li><a href=\"https://arling.sk/play/\">Games for Android</a></li><li><a href=\"https://arling.sk/games/village/\">Puzzle Village</a></li><li><a href=\"https://arling.sk/games/escape/lighthouse/\">Grandpa's Lighthouse</a></li><li><a href=\"https://arling.sk/puzzle-video/\">Puzzle video maker</a></li><li><a href=\"https://arling.sk/puzzle-studio/\">Puzzle Studio</a></li><li><a href=\"https://arling.sk/puzzle-post/bulletin/\">Puzzle Post Bulletin</a></li><li><a href=\"https://arling.sk/puzzle-publisher/\">Publisher pack</a></li></ul>",
 "knihy": "<p>Books and gifts</p><ul><li><a href=\"https://arling.sk/shop/budget-2027/\">2027 Budget Spreadsheet</a></li><li><a href=\"https://arling.sk/shop/\">Shop</a></li><li><a href=\"https://arling.sk/puzzle-books/eink-bundle/\">E-ink puzzle bundle</a></li><li><a href=\"https://arling.sk/classics/monte-cristo/drawn/\">Monte Cristo, drawn</a></li><li><a href=\"https://arling.sk/world/\">The World in Squares</a></li><li><a href=\"https://arling.sk/printables/\">Seasonal printables</a></li><li><a href=\"https://arling.sk/puzzle-books/\">Puzzle books</a></li><li><a href=\"https://arling.sk/puzzle-books/halloween-logic-puzzle-book/\">Halloween puzzle book</a></li><li><a href=\"https://arling.sk/puzzle-books/logic-puzzle-bundle-200/\">Logic puzzle bundle</a></li><li><a href=\"https://arling.sk/puzzle-books/christmas-logic-puzzle-book/\">Christmas puzzle book</a></li><li><a href=\"https://arling.sk/puzzle-books/printable-puzzle-advent-calendar-2026-48-christmas-logic/\">Advent Puzzle Calendar 2026</a></li><li><a href=\"https://arling.sk/classics/\">Classics for e-ink</a></li><li><a href=\"https://arling.sk/morning-quiet/\">Morning Quiet</a></li><li><a href=\"https://arling.sk/puzzle-post/\">Puzzle Post</a></li><li><a href=\"https://arling.sk/memory-post/\">Memory Post</a></li></ul>"
};
  var vyvojari = "<span>For developers</span><a href=\"https://arling.sk/cors-doctor/\">CORS</a><a href=\"https://arling.sk/jwt-doctor/\">JWT</a><a href=\"https://arling.sk/cookie-samesite-doctor/\">Cookie SameSite</a><a href=\"https://arling.sk/redirect-loop-doctor/\">Redirect loop</a><a href=\"https://arling.sk/stripe-webhook-doctor/\">Stripe webhook</a><a href=\"https://arling.sk/firebase-auth-domain-doctor/\">Firebase auth</a><a href=\"https://arling.sk/google-oauth-redirect-doctor/\">Google OAuth</a><a href=\"https://arling.sk/supabase-redirect-doctor/\">Supabase redirect</a><a href=\"https://arling.sk/flutter-supabase-doctor/\">Flutter + Supabase</a><a href=\"https://arling.sk/expo-universal-links-doctor/\">Expo links</a><a href=\"https://arling.sk/expo-supabase-auth-doctor/\">Expo + Supabase</a><a href=\"https://arling.sk/api/\">Puzzle API</a><a href=\"https://arling.sk/motion/\">Motion components</a>";
  var pocet = "70";
  function vloz(obsah, prvky) {
    for (var i = 0; i < prvky.length; i++) {
      var html = obsah[prvky[i].getAttribute('data-skupina')];
      if (typeof html === 'string') prvky[i].innerHTML = html;
    }
  }
  function pocitadlo(a) {
    if (!a || a.querySelector('b')) return;
    var sipka = a.querySelector('svg');
    if (sipka) sipka.insertAdjacentHTML('beforebegin', '<b>' + pocet + '</b>');
    else a.insertAdjacentHTML('beforeend', '<b>' + pocet + '</b>');
  }
  function podObrazom(prvok) {
    var vyska = window.innerHeight || document.documentElement.clientHeight || 0;
    try { return prvok.getBoundingClientRect().top >= vyska; } catch (e) { return true; }
  }
  function naplnMenu() {
    vloz(menu, document.querySelectorAll('header.site-header .site-col[data-skupina]'));
    pocitadlo(document.querySelector('header.site-header .site-all a'));
  }
  // Otvorené menu (otvorenie myšou pred dobehnutím skriptu) sa neprepisuje: obsah by sa posunul
  // a fokus by spadol na body. Plný katalóg príde, keď sa panel zatvorí (zatvorený panel nemá
  // viditeľný obsah ani fokus vo vnútri).
  function menuPouziva(d) {
    return !!(d && d.open);
  }
  function rozvinPatu(stlpce) {
    vloz(pata, stlpce.querySelectorAll('[data-skupina]'));
    pocitadlo(document.querySelector('footer.site-footer .site-all a'));
    var dev = document.querySelector('footer.site-footer [data-site-vyvojari]');
    if (dev) { dev.innerHTML = vyvojari; dev.className = 'site-dev site-dev-zoznam'; }
  }
  // Lighthouse 28. 9. 2026: synchrónne meranie päty (getBoundingClientRect) pri DOMContentLoaded
  // vynútilo prvé rozloženie celej stránky v úlohe skriptu (menu-sk.js 400 až 520 ms blokovania na
  // /notes/ a /asistent/). Preto: katalóg menu až v nečinnosti alebo pri prvom priblížení k tlačidlu
  // Menu (dotyk, myš, fokus prídu pred otvorením), päta len cez IntersectionObserver (meria prehliadač
  // pri svojom vykreslení). Bez týchto API (starý prehliadač, testy) ostáva pôvodná synchrónna cesta.
  var naplnene = false;
  function naplnRaz() { if (naplnene) return; naplnene = true; naplnMenu(); }
  function spusti() {
    var d = document.querySelector('header.site-header details.site-menu');
    if (menuPouziva(d) && typeof d.addEventListener === 'function') {
      var cakaj = function () {
        if (d.open) return;
        d.removeEventListener('toggle', cakaj);
        naplnRaz();
      };
      d.addEventListener('toggle', cakaj);
    } else if (typeof window.requestIdleCallback === 'function' && d && typeof d.addEventListener === 'function') {
      var s = d.querySelector('summary') || d;
      s.addEventListener('pointerenter', naplnRaz);
      s.addEventListener('touchstart', naplnRaz, { passive: true });
      s.addEventListener('focusin', naplnRaz);
      window.requestIdleCallback(naplnRaz, { timeout: 3000 });
    } else naplnRaz();
    var stlpce = document.querySelector('footer.site-footer .site-foot-cols');
    if (!stlpce) return;
    // Päta sa rozvinie, len keď je pod spodným okrajom obrazovky (žiadny viditeľný posun). Na krátkej
    // stránke alebo pri obsahu, ktorý kreslí až JS, sa rozvinie neskôr, keď ju obsah odsunie dole.
    var IO = window.IntersectionObserver;
    if (typeof IO !== 'function') { if (podObrazom(stlpce)) rozvinPatu(stlpce); return; }
    var pozor = new IO(function (zaznamy) {
      for (var i = 0; i < zaznamy.length; i++) {
        var z = zaznamy[i];
        var vyska = window.innerHeight || document.documentElement.clientHeight || 0;
        if (!z.isIntersecting && z.boundingClientRect.top >= vyska) {
          pozor.disconnect();
          rozvinPatu(stlpce);
          return;
        }
      }
    });
    pozor.observe(stlpce);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', spusti);
  else spusti();
})();
