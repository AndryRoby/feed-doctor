/* ARLing: plný katalóg v menu a päte (sk). Vyrobil ops/design/menu-skript.mjs z ops/design/uvod-katalog.mjs,
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
 "firmy": "<p>Firmy a účtovníci</p><ul><li><a href=\"https://arling.sk/super-intelligence/\"><b>AI to SI Checker<em class=\"site-nove\">Nové</em><em class=\"site-sk\">EN</em></b><span>Zamení AI za SI, názvy zákonov nechá</span></a></li><li><a href=\"https://arling.sk/rukopis/\"><b>Rukopis</b><span>Nájde šablónové frázy vo vašom texte</span></a></li><li><a href=\"https://arling.sk/efaktura/\"><b>E-faktúra</b><span>Kontrola, náhľad a tvorba XML</span></a></li><li><a href=\"https://arling.sk/kontrola-suboru/\"><b>Kontrola SEPA súboru</b><span>Adresy a chyby skôr, než to uvidí banka</span></a></li><li><a href=\"https://arling.sk/sankcny-zoznam/\"><b>Kontrola sankcií EÚ</b><span>Zoznam partnerov proti sankčnému zoznamu EÚ</span></a></li></ul><a class=\"site-col-all\" href=\"https://arling.sk/vsetko/#firmy\" aria-label=\"Všetko v skupine: Firmy a účtovníci (14)\" data-umami-event=\"shell_menu_group\" data-umami-event-target=\"firmy\"><span class=\"site-dlho\">Všetko v skupine</span><span class=\"site-kratko\">Všetko</span><b>14</b><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M5 12h13M13 6l6 6-6 6\"/></svg></a>",
 "eshopy": "<p>E-shopy a weby</p><ul><li><a href=\"https://arling.sk/asistent/\"><b>Asistent</b><span>Predajný asistent pre e-shop</span></a></li><li><a href=\"https://arling.sk/gdpr-dokumenty/\"><b>GDPR dokumenty</b><span>Pre firmu a e-shop za 10 minút</span></a></li><li><a href=\"https://arling.sk/kontrola-eshopu/\"><b>Kontrola e-shopu</b><span>Odstúpenie, zásady a cookies zadarmo</span></a></li><li><a href=\"https://arling.sk/technologie/\"><b>Stacklog</b><span>Na čom web beží a kedy sa to zmenilo</span></a></li><li><a href=\"https://arling.sk/mail-doctor/\"><b>Mail Doctor<em class=\"site-sk\">EN</em></b><span>SPF, DKIM a DMARC domény</span></a></li></ul><a class=\"site-col-all\" href=\"https://arling.sk/vsetko/#eshopy\" aria-label=\"Všetko v skupine: E-shopy a weby (6)\" data-umami-event=\"shell_menu_group\" data-umami-event-target=\"eshopy\"><span class=\"site-dlho\">Všetko v skupine</span><span class=\"site-kratko\">Všetko</span><b>6</b><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M5 12h13M13 6l6 6-6 6\"/></svg></a>",
 "hry": "<p>Hry a hlavolamy <em class=\"site-sk\">EN</em></p><ul><li><a href=\"https://arling.sk/shop/escape-room-kids/\"><b>Drak, ktorý spal na kľúči</b><span>Úniková hra na tlač pre deti od 7 do 10 rokov, 7,90 €</span></a></li><li><a href=\"https://arling.sk/shop/escape-room-adults/\"><b>Dielňa hodinára</b><span>Úniková hra na tlač pre dospelých, 9,90 €</span></a></li><li><a href=\"https://arling.sk/shop/murder-lantern-ball/\"><b>Murder at the Lantern Ball</b><span>Detektívka na tlač pre dospelých a tínedžerov, 5,90 €</span></a></li><li><a href=\"https://arling.sk/shop/your-friends-as-witnesses/\"><b>Your friends as witnesses<em class=\"site-nove\">Nové</em></b><span>Detektívka na tlač s menami vašich kamarátov, 12,90 € na Etsy</span></a></li><li><a href=\"https://arling.sk/shop/custom-crossword/\"><b>Custom crossword</b><span>Krížovka na tlač z vašich vlastných slov, 14,90 € na Etsy</span></a></li></ul><a class=\"site-col-all\" href=\"https://arling.sk/vsetko/#hry\" aria-label=\"Všetko v skupine: Hry a hlavolamy (22)\" data-umami-event=\"shell_menu_group\" data-umami-event-target=\"hry\"><span class=\"site-dlho\">Všetko v skupine</span><span class=\"site-kratko\">Všetko</span><b>22</b><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M5 12h13M13 6l6 6-6 6\"/></svg></a>",
 "knihy": "<p>Knihy a darčeky <em class=\"site-sk\">EN</em></p><ul><li><a href=\"https://arling.sk/shop/budget-2027/\"><b>Rozpočet 2027</b><span>Tabuľka pre Excel a Google Sheets, 9,90 €</span></a></li><li><a href=\"https://arling.sk/shop/\"><b>Obchod</b><span>Knihy, hlavolamy a darčeky</span></a></li><li><a href=\"https://arling.sk/puzzle-books/eink-bundle/\"><b>E-ink balík hlavolamov</b><span>3000 hlavolamov v desiatich knihách</span></a></li><li><a href=\"https://arling.sk/printables/\"><b>Na tlač podľa sezóny<em class=\"site-nove\">Nové</em></b><span>Halloween, Deň vďakyvzdania, Vianoce a celý rok</span></a></li><li><a href=\"https://arling.sk/puzzle-books/printable-puzzle-advent-calendar-2026-48-christmas-logic/\"><b>Adventný kalendár hlavolamov 2026</b><span>24 dní, 48 hlavolamov na tlač, 4,90 €</span></a></li></ul><a class=\"site-col-all\" href=\"https://arling.sk/vsetko/#knihy\" aria-label=\"Všetko v skupine: Knihy a darčeky (15)\" data-umami-event=\"shell_menu_group\" data-umami-event-target=\"knihy\"><span class=\"site-dlho\">Všetko v skupine</span><span class=\"site-kratko\">Všetko</span><b>15</b><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M5 12h13M13 6l6 6-6 6\"/></svg></a>"
};
  var pata = {
 "firmy": "<p>Firmy a účtovníci</p><ul><li><a href=\"https://arling.sk/super-intelligence/\">AI to SI Checker<em class=\"site-sk\">EN</em></a></li><li><a href=\"https://arling.sk/rukopis/\">Rukopis</a></li><li><a href=\"https://arling.sk/efaktura/\">E-faktúra</a></li><li><a href=\"https://arling.sk/kontrola-suboru/\">Kontrola SEPA súboru</a></li><li><a href=\"https://arling.sk/bankove-nastroje/\">Bankové nástroje Pro</a></li><li><a href=\"https://arling.sk/proof/sk/\">Proof</a></li><li><a href=\"https://arling.sk/renewals/sk/\">Renewals</a></li><li><a href=\"https://arling.sk/parovac-platieb/\">Párovač platieb</a></li><li><a href=\"https://arling.sk/sepa-pain001-doctor/\">Kontrola pain.001</a></li><li><a href=\"https://arling.sk/sepa-pain001-generator/\">Generátor pain.001</a></li><li><a href=\"https://arling.sk/camt053-to-excel/\">Výpis do Excelu</a></li><li><a href=\"https://arling.sk/vzory-zmluv/\">Vzory zmlúv</a></li><li><a href=\"https://arling.sk/zivotopis/\">Životopis</a></li><li><a href=\"https://arling.sk/sankcny-zoznam/\">Kontrola sankcií EÚ</a></li></ul>",
 "eshopy": "<p>E-shopy a weby</p><ul><li><a href=\"https://arling.sk/asistent/\">Asistent</a></li><li><a href=\"https://arling.sk/gdpr-dokumenty/\">GDPR dokumenty</a></li><li><a href=\"https://arling.sk/kontrola-eshopu/\">Kontrola e-shopu</a></li><li><a href=\"https://arling.sk/technologie/\">Stacklog</a></li><li><a href=\"https://arling.sk/mail-doctor/\">Mail Doctor<em class=\"site-sk\">EN</em></a></li><li><a href=\"https://arling.sk/feed-doctor/\">Feed Doctor</a></li></ul>",
 "hry": "<p>Hry a hlavolamy <em class=\"site-sk\">EN</em></p><ul><li><a href=\"https://arling.sk/games/\">Hry v prehliadači</a></li><li><a href=\"https://arling.sk/shop/detective-kit-2/\">Zablatené stopy</a></li><li><a href=\"https://arling.sk/shop/escape-room-kids/\">Drak, ktorý spal na kľúči</a></li><li><a href=\"https://arling.sk/shop/escape-room-adults/\">Dielňa hodinára</a></li><li><a href=\"https://arling.sk/shop/mystery-case-adults/\">Volavka z Ashgrove</a></li><li><a href=\"https://arling.sk/play/stop/\">Stop at the right frame</a></li><li><a href=\"https://arling.sk/games/owls/\">Owls</a></li><li><a href=\"https://arling.sk/games/beavers/\">Beavers</a></li><li><a href=\"https://arling.sk/games/foxes/\">Foxes</a></li><li><a href=\"https://arling.sk/games/field-notes/\">Field Notes</a></li><li><a href=\"https://arling.sk/shop/detective-kit/\">Detektívka pre deti</a></li><li><a href=\"https://arling.sk/shop/pumpkin-escape-kids/\">Tekvicový jarmok</a></li><li><a href=\"https://arling.sk/shop/murder-lantern-ball/\">Murder at the Lantern Ball</a></li><li><a href=\"https://arling.sk/shop/your-friends-as-witnesses/\">Your friends as witnesses</a></li><li><a href=\"https://arling.sk/shop/custom-crossword/\">Custom crossword</a></li><li><a href=\"https://arling.sk/play/\">Hry pre Android</a></li><li><a href=\"https://arling.sk/games/village/\">Puzzle Village</a></li><li><a href=\"https://arling.sk/games/escape/lighthouse/\">Grandpa's Lighthouse</a></li><li><a href=\"https://arling.sk/puzzle-video/\">Puzzle video</a></li><li><a href=\"https://arling.sk/puzzle-studio/\">Puzzle Studio</a></li><li><a href=\"https://arling.sk/puzzle-post/bulletin/\">Puzzle Post Bulletin</a></li><li><a href=\"https://arling.sk/puzzle-publisher/\">Balík pre vydavateľov</a></li></ul>",
 "knihy": "<p>Knihy a darčeky <em class=\"site-sk\">EN</em></p><ul><li><a href=\"https://arling.sk/shop/budget-2027/\">Rozpočet 2027</a></li><li><a href=\"https://arling.sk/shop/\">Obchod</a></li><li><a href=\"https://arling.sk/puzzle-books/eink-bundle/\">E-ink balík hlavolamov</a></li><li><a href=\"https://arling.sk/classics/monte-cristo/drawn/\">Monte Cristo v obrazoch</a></li><li><a href=\"https://arling.sk/world/\">The World in Squares</a></li><li><a href=\"https://arling.sk/printables/\">Na tlač podľa sezóny</a></li><li><a href=\"https://arling.sk/puzzle-books/\">Knihy hlavolamov</a></li><li><a href=\"https://arling.sk/puzzle-books/halloween-logic-puzzle-book/\">Halloweenske hlavolamy</a></li><li><a href=\"https://arling.sk/puzzle-books/logic-puzzle-bundle-200/\">Balík 200 hlavolamov</a></li><li><a href=\"https://arling.sk/puzzle-books/christmas-logic-puzzle-book/\">Vianočné hlavolamy</a></li><li><a href=\"https://arling.sk/puzzle-books/printable-puzzle-advent-calendar-2026-48-christmas-logic/\">Adventný kalendár hlavolamov 2026</a></li><li><a href=\"https://arling.sk/classics/\">Klasika pre e-ink</a></li><li><a href=\"https://arling.sk/morning-quiet/\">Ranné ticho</a></li><li><a href=\"https://arling.sk/puzzle-post/\">Puzzle Post</a></li><li><a href=\"https://arling.sk/memory-post/\">Memory Post</a></li></ul>"
};
  var vyvojari = "<span>Pre vývojárov</span><a href=\"https://arling.sk/cors-doctor/\">CORS</a><a href=\"https://arling.sk/jwt-doctor/\">JWT</a><a href=\"https://arling.sk/cookie-samesite-doctor/\">Cookie SameSite</a><a href=\"https://arling.sk/redirect-loop-doctor/\">Redirect loop</a><a href=\"https://arling.sk/stripe-webhook-doctor/\">Stripe webhook</a><a href=\"https://arling.sk/firebase-auth-domain-doctor/\">Firebase auth</a><a href=\"https://arling.sk/google-oauth-redirect-doctor/\">Google OAuth</a><a href=\"https://arling.sk/supabase-redirect-doctor/\">Supabase redirect</a><a href=\"https://arling.sk/flutter-supabase-doctor/\">Flutter + Supabase</a><a href=\"https://arling.sk/expo-universal-links-doctor/\">Expo links</a><a href=\"https://arling.sk/expo-supabase-auth-doctor/\">Expo + Supabase</a><a href=\"https://arling.sk/api/\">Puzzle API</a><a href=\"https://arling.sk/motion/\">Motion components</a>";
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
