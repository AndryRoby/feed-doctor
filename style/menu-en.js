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
 "firmy": "<p>Businesses and accountants</p><ul><li><a href=\"https://arling.sk/efaktura/en/\"><b>E-invoice</b><span>Check, preview and create XML</span></a></li><li><a href=\"https://arling.sk/kontrola-suboru/en/\"><b>SEPA file check</b><span>Addresses and errors before your bank sees them</span></a></li><li><a href=\"https://arling.sk/proof/\"><b>Proof</b><span>Customer approval before printing</span></a></li><li><a href=\"https://arling.sk/renewals/\"><b>Renewals</b><span>Supplier documents and renewal dates</span></a></li><li><a href=\"https://arling.sk/sanktionslisten/\"><b>EU sanctions check<em class=\"site-nove\">New</em></b><span>Your partner list against the EU sanctions list</span></a></li></ul><a class=\"site-col-all\" href=\"https://arling.sk/vsetko/en/#firmy\" aria-label=\"All in this group: Businesses and accountants (12)\" data-umami-event=\"shell_menu_group\" data-umami-event-target=\"firmy\"><span class=\"site-dlho\">All in this group</span><span class=\"site-kratko\">All</span><b>12</b><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M5 12h13M13 6l6 6-6 6\"/></svg></a>",
 "eshopy": "<p>Online shops and websites</p><ul><li><a href=\"https://arling.sk/asistent/en/\"><b>Asistent</b><span>Sales assistant for online shops</span></a></li><li><a href=\"https://arling.sk/technologies/\"><b>Stacklog<em class=\"site-nove\">New</em></b><span>What a site runs on, and when it changed</span></a></li><li><a href=\"https://arling.sk/mail-doctor/\"><b>Mail Doctor</b><span>SPF, DKIM and DMARC of a domain</span></a></li><li><a href=\"https://arling.sk/feed-doctor/en/\"><b>Feed Doctor</b><span>Product feed check</span></a></li></ul><a class=\"site-col-all\" href=\"https://arling.sk/vsetko/en/#eshopy\" aria-label=\"All in this group: Online shops and websites (6)\" data-umami-event=\"shell_menu_group\" data-umami-event-target=\"eshopy\"><span class=\"site-dlho\">All in this group</span><span class=\"site-kratko\">All</span><b>6</b><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M5 12h13M13 6l6 6-6 6\"/></svg></a>",
 "hry": "<p>Games and puzzles</p><ul><li><a href=\"https://arling.sk/games/\"><b>Browser games</b><span>A free daily logic puzzle</span></a></li><li><a href=\"https://arling.sk/games/owls/\"><b>Owls<em class=\"site-nove\">New</em></b><span>Daily puzzle: day and night owls in balance</span></a></li><li><a href=\"https://arling.sk/games/beavers/\"><b>Beavers</b><span>Daily puzzle: a beaver lodge beside every tree</span></a></li><li><a href=\"https://arling.sk/games/foxes/\"><b>Foxes</b><span>Daily puzzle: place the foxes from the clues</span></a></li><li><a href=\"https://arling.sk/games/field-notes/\"><b>Field Notes</b><span>A word search in a naturalist’s notebook</span></a></li></ul><a class=\"site-col-all\" href=\"https://arling.sk/vsetko/en/#hry\" aria-label=\"All in this group: Games and puzzles (14)\" data-umami-event=\"shell_menu_group\" data-umami-event-target=\"hry\"><span class=\"site-dlho\">All in this group</span><span class=\"site-kratko\">All</span><b>14</b><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M5 12h13M13 6l6 6-6 6\"/></svg></a>",
 "knihy": "<p>Books and gifts</p><ul><li><a href=\"https://arling.sk/shop/\"><b>Shop</b><span>Books, puzzles and gifts</span></a></li><li><a href=\"https://arling.sk/puzzle-books/eink-bundle/\"><b>E-ink puzzle bundle</b><span>3000 puzzles in ten books</span></a></li><li><a href=\"https://arling.sk/classics/monte-cristo/drawn/\"><b>Monte Cristo, drawn<em class=\"site-nove\">New</em></b><span>Scenes from the novel, drawn in code</span></a></li><li><a href=\"https://arling.sk/world/\"><b>The World in Squares</b><span>Buy a square of the world map, name it and draw on it</span></a></li><li><a href=\"https://arling.sk/memory-post/\"><b>Memory Post</b><span>Memories on paper</span></a></li></ul><a class=\"site-col-all\" href=\"https://arling.sk/vsetko/en/#knihy\" aria-label=\"All in this group: Books and gifts (9)\" data-umami-event=\"shell_menu_group\" data-umami-event-target=\"knihy\"><span class=\"site-dlho\">All in this group</span><span class=\"site-kratko\">All</span><b>9</b><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M5 12h13M13 6l6 6-6 6\"/></svg></a>"
};
  var pata = {
 "firmy": "<p>Businesses and accountants</p><ul><li><a href=\"https://arling.sk/efaktura/en/\">E-invoice</a></li><li><a href=\"https://arling.sk/kontrola-suboru/en/\">SEPA file check</a></li><li><a href=\"https://arling.sk/bankove-nastroje/en/\">Banking tools Pro</a></li><li><a href=\"https://arling.sk/proof/\">Proof</a></li><li><a href=\"https://arling.sk/renewals/\">Renewals</a></li><li><a href=\"https://arling.sk/parovac-platieb/en/\">Payment matcher</a></li><li><a href=\"https://arling.sk/sepa-pain001-doctor/\">pain.001 check</a></li><li><a href=\"https://arling.sk/sepa-pain001-generator/\">pain.001 generator</a></li><li><a href=\"https://arling.sk/camt053-to-excel/\">Statement to Excel</a></li><li><a href=\"https://arling.sk/vzory-zmluv/\">Contract templates<em class=\"site-sk\">SK</em></a></li><li><a href=\"https://arling.sk/zivotopis/en/\">CV builder</a></li><li><a href=\"https://arling.sk/sanktionslisten/\">EU sanctions check</a></li></ul>",
 "eshopy": "<p>Online shops and websites</p><ul><li><a href=\"https://arling.sk/asistent/en/\">Asistent</a></li><li><a href=\"https://arling.sk/gdpr-dokumenty/\">GDPR documents<em class=\"site-sk\">SK</em></a></li><li><a href=\"https://arling.sk/kontrola-eshopu/\">Online shop check<em class=\"site-sk\">SK</em></a></li><li><a href=\"https://arling.sk/technologies/\">Stacklog</a></li><li><a href=\"https://arling.sk/mail-doctor/\">Mail Doctor</a></li><li><a href=\"https://arling.sk/feed-doctor/en/\">Feed Doctor</a></li></ul>",
 "hry": "<p>Games and puzzles</p><ul><li><a href=\"https://arling.sk/games/\">Browser games</a></li><li><a href=\"https://arling.sk/games/owls/\">Owls</a></li><li><a href=\"https://arling.sk/games/beavers/\">Beavers</a></li><li><a href=\"https://arling.sk/games/foxes/\">Foxes</a></li><li><a href=\"https://arling.sk/games/field-notes/\">Field Notes</a></li><li><a href=\"https://arling.sk/shop/detective-kit/\">Detective kit</a></li><li><a href=\"https://arling.sk/shop/pumpkin-escape-kids/\">The Pumpkin Fair Mix-Up</a></li><li><a href=\"https://arling.sk/play/\">Games for Android</a></li><li><a href=\"https://arling.sk/games/village/\">Puzzle Village</a></li><li><a href=\"https://arling.sk/games/escape/lighthouse/\">Grandpa's Lighthouse</a></li><li><a href=\"https://arling.sk/puzzle-video/\">Puzzle video maker</a></li><li><a href=\"https://arling.sk/puzzle-studio/\">Puzzle Studio</a></li><li><a href=\"https://arling.sk/puzzle-post/bulletin/\">Puzzle Post Bulletin</a></li><li><a href=\"https://arling.sk/puzzle-publisher/\">Publisher pack</a></li></ul>",
 "knihy": "<p>Books and gifts</p><ul><li><a href=\"https://arling.sk/shop/\">Shop</a></li><li><a href=\"https://arling.sk/puzzle-books/eink-bundle/\">E-ink puzzle bundle</a></li><li><a href=\"https://arling.sk/classics/monte-cristo/drawn/\">Monte Cristo, drawn</a></li><li><a href=\"https://arling.sk/world/\">The World in Squares</a></li><li><a href=\"https://arling.sk/puzzle-books/\">Puzzle books</a></li><li><a href=\"https://arling.sk/classics/\">Classics for e-ink</a></li><li><a href=\"https://arling.sk/morning-quiet/\">Morning Quiet</a></li><li><a href=\"https://arling.sk/puzzle-post/\">Puzzle Post</a></li><li><a href=\"https://arling.sk/memory-post/\">Memory Post</a></li></ul>"
};
  var vyvojari = "<span>For developers</span><a href=\"https://arling.sk/cors-doctor/\">CORS</a><a href=\"https://arling.sk/jwt-doctor/\">JWT</a><a href=\"https://arling.sk/cookie-samesite-doctor/\">Cookie SameSite</a><a href=\"https://arling.sk/redirect-loop-doctor/\">Redirect loop</a><a href=\"https://arling.sk/stripe-webhook-doctor/\">Stripe webhook</a><a href=\"https://arling.sk/firebase-auth-domain-doctor/\">Firebase auth</a><a href=\"https://arling.sk/google-oauth-redirect-doctor/\">Google OAuth</a><a href=\"https://arling.sk/supabase-redirect-doctor/\">Supabase redirect</a><a href=\"https://arling.sk/flutter-supabase-doctor/\">Flutter + Supabase</a><a href=\"https://arling.sk/expo-universal-links-doctor/\">Expo links</a><a href=\"https://arling.sk/expo-supabase-auth-doctor/\">Expo + Supabase</a><a href=\"https://arling.sk/api/\">Puzzle API</a><a href=\"https://arling.sk/motion/\">Motion components</a>";
  var pocet = "54";
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
  function spusti() {
    var d = document.querySelector('header.site-header details.site-menu');
    if (menuPouziva(d) && typeof d.addEventListener === 'function') {
      var cakaj = function () {
        if (d.open) return;
        d.removeEventListener('toggle', cakaj);
        naplnMenu();
      };
      d.addEventListener('toggle', cakaj);
    } else naplnMenu();
    var stlpce = document.querySelector('footer.site-footer .site-foot-cols');
    if (!stlpce) return;
    if (podObrazom(stlpce)) { rozvinPatu(stlpce); return; }
    // Päta je v obraze (krátka stránka alebo obsah, ktorý kreslí až JS). Rozvinie sa neskôr,
    // až keď ju obsah odsunie pod spodný okraj obrazovky, teda znova bez viditeľného posunu.
    var IO = window.IntersectionObserver;
    if (typeof IO !== 'function') return;
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
