/* ARLing: plný katalóg v menu a päte (cs). Vyrobil ops/design/menu-skript.mjs z ops/design/uvod-katalog.mjs,
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
 "firmy": "<p>Firmy a účetní</p><ul><li><a href=\"https://arling.sk/super-intelligence/\"><b>AI to SI Checker<em class=\"site-nove\">Nové</em><em class=\"site-sk\">EN</em></b><span>Zamění AI za SI, názvy zákonů ponechá</span></a></li><li><a href=\"https://arling.sk/rukopis/cs/\"><b>Rukopis</b><span>Najde šablonovité fráze ve vašem textu</span></a></li><li><a href=\"https://arling.sk/efaktura/cs/\"><b>E-faktura</b><span>Kontrola, náhled a tvorba XML</span></a></li><li><a href=\"https://arling.sk/kontrola-suboru/\"><b>Kontrola SEPA souboru<em class=\"site-sk\">SK</em></b><span>Adresy a chyby dřív, než je uvidí banka</span></a></li><li><a href=\"https://arling.sk/sankcny-zoznam/\"><b>Kontrola sankcí EU<em class=\"site-sk\">SK</em></b><span>Seznam partnerů proti sankčnímu seznamu EU</span></a></li></ul><a class=\"site-col-all\" href=\"https://arling.sk/vsetko/#firmy\" aria-label=\"Vše ve skupině: Firmy a účetní (14)\" data-umami-event=\"shell_menu_group\" data-umami-event-target=\"firmy\"><span class=\"site-dlho\">Vše ve skupině</span><span class=\"site-kratko\">Vše</span><b>14</b><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M5 12h13M13 6l6 6-6 6\"/></svg></a>",
 "eshopy": "<p>E-shopy a weby</p><ul><li><a href=\"https://arling.sk/asistent/shoptet/cs/\"><b>Asistent</b><span>Prodejní asistent pro e-shop na Shoptetu</span></a></li><li><a href=\"https://arling.sk/gdpr-dokumenty/cs/\"><b>GDPR dokumenty</b><span>Pro firmu a e-shop za 10 minut</span></a></li><li><a href=\"https://arling.sk/kontrola-eshopu/\"><b>Kontrola e-shopu<em class=\"site-sk\">SK</em></b><span>Odstoupení, zásady a cookies podle slovenského práva</span></a></li><li><a href=\"https://arling.sk/technologie/\"><b>Stacklog<em class=\"site-sk\">SK</em></b><span>Na čem web běží a kdy se to změnilo</span></a></li><li><a href=\"https://arling.sk/mail-doctor/\"><b>Mail Doctor<em class=\"site-sk\">EN</em></b><span>SPF, DKIM a DMARC domény</span></a></li></ul><a class=\"site-col-all\" href=\"https://arling.sk/vsetko/#eshopy\" aria-label=\"Vše ve skupině: E-shopy a weby (6)\" data-umami-event=\"shell_menu_group\" data-umami-event-target=\"eshopy\"><span class=\"site-dlho\">Vše ve skupině</span><span class=\"site-kratko\">Vše</span><b>6</b><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M5 12h13M13 6l6 6-6 6\"/></svg></a>",
 "hry": "<p>Hry a hlavolamy <em class=\"site-sk\">EN</em></p><ul><li><a href=\"https://arling.sk/shop/escape-room-kids/\"><b>Drak, který spal na klíči</b><span>Úniková hra k vytištění pro děti od 7 do 10 let, 7,90 €</span></a></li><li><a href=\"https://arling.sk/shop/escape-room-adults/\"><b>Hodinářova dílna</b><span>Úniková hra k vytištění pro dospělé, 9,90 €</span></a></li><li><a href=\"https://arling.sk/shop/murder-lantern-ball/\"><b>Murder at the Lantern Ball</b><span>Detektivka k vytištění pro dospělé a náctileté, 5,90 €</span></a></li><li><a href=\"https://arling.sk/shop/your-friends-as-witnesses/\"><b>Your friends as witnesses<em class=\"site-nove\">Nové</em></b><span>Detektivka k vytištění se jmény vašich přátel, 12,90 € na Etsy</span></a></li><li><a href=\"https://arling.sk/shop/custom-crossword/\"><b>Custom crossword</b><span>Křížovka k vytištění z vašich vlastních slov, 14,90 € na Etsy</span></a></li></ul><a class=\"site-col-all\" href=\"https://arling.sk/vsetko/#hry\" aria-label=\"Vše ve skupině: Hry a hlavolamy (22)\" data-umami-event=\"shell_menu_group\" data-umami-event-target=\"hry\"><span class=\"site-dlho\">Vše ve skupině</span><span class=\"site-kratko\">Vše</span><b>22</b><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M5 12h13M13 6l6 6-6 6\"/></svg></a>",
 "knihy": "<p>Knihy a dárky <em class=\"site-sk\">EN</em></p><ul><li><a href=\"https://arling.sk/shop/budget-2027/\"><b>Rozpočet 2027</b><span>Tabulka pro Excel a Google Sheets, 9,90 €</span></a></li><li><a href=\"https://arling.sk/shop/\"><b>Obchod</b><span>Knihy, hlavolamy a dárky</span></a></li><li><a href=\"https://arling.sk/puzzle-books/eink-bundle/\"><b>E-ink balíček hlavolamů</b><span>3000 hlavolamů v deseti knihách</span></a></li><li><a href=\"https://arling.sk/printables/\"><b>K tisku podle sezóny<em class=\"site-nove\">Nové</em></b><span>Halloween, Díkůvzdání, Vánoce a celý rok</span></a></li><li><a href=\"https://arling.sk/puzzle-books/printable-puzzle-advent-calendar-2026-48-christmas-logic/\"><b>Adventní kalendář hlavolamů 2026</b><span>24 dní, 48 hlavolamů k tisku, 4,90 €</span></a></li></ul><a class=\"site-col-all\" href=\"https://arling.sk/vsetko/#knihy\" aria-label=\"Vše ve skupině: Knihy a dárky (15)\" data-umami-event=\"shell_menu_group\" data-umami-event-target=\"knihy\"><span class=\"site-dlho\">Vše ve skupině</span><span class=\"site-kratko\">Vše</span><b>15</b><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M5 12h13M13 6l6 6-6 6\"/></svg></a>"
};
  var pata = {
 "firmy": "<p>Firmy a účetní</p><ul><li><a href=\"https://arling.sk/super-intelligence/\">AI to SI Checker<em class=\"site-sk\">EN</em></a></li><li><a href=\"https://arling.sk/rukopis/cs/\">Rukopis</a></li><li><a href=\"https://arling.sk/efaktura/cs/\">E-faktura</a></li><li><a href=\"https://arling.sk/kontrola-suboru/\">Kontrola SEPA souboru<em class=\"site-sk\">SK</em></a></li><li><a href=\"https://arling.sk/bankove-nastroje/\">Bankovní nástroje Pro<em class=\"site-sk\">SK</em></a></li><li><a href=\"https://arling.sk/proof/sk/\">Proof<em class=\"site-sk\">SK</em></a></li><li><a href=\"https://arling.sk/renewals/sk/\">Renewals<em class=\"site-sk\">SK</em></a></li><li><a href=\"https://arling.sk/parovac-platieb/\">Párování plateb<em class=\"site-sk\">SK</em></a></li><li><a href=\"https://arling.sk/sepa-pain001-doctor/\">Kontrola pain.001<em class=\"site-sk\">SK</em></a></li><li><a href=\"https://arling.sk/sepa-pain001-generator/\">Generátor pain.001<em class=\"site-sk\">SK</em></a></li><li><a href=\"https://arling.sk/camt053-to-excel/\">Výpis do Excelu<em class=\"site-sk\">SK</em></a></li><li><a href=\"https://arling.sk/vzory-zmluv/\">Vzory smluv<em class=\"site-sk\">SK</em></a></li><li><a href=\"https://arling.sk/zivotopis/\">Životopis<em class=\"site-sk\">SK</em></a></li><li><a href=\"https://arling.sk/sankcny-zoznam/\">Kontrola sankcí EU<em class=\"site-sk\">SK</em></a></li></ul>",
 "eshopy": "<p>E-shopy a weby</p><ul><li><a href=\"https://arling.sk/asistent/shoptet/cs/\">Asistent</a></li><li><a href=\"https://arling.sk/gdpr-dokumenty/cs/\">GDPR dokumenty</a></li><li><a href=\"https://arling.sk/kontrola-eshopu/\">Kontrola e-shopu<em class=\"site-sk\">SK</em></a></li><li><a href=\"https://arling.sk/technologie/\">Stacklog<em class=\"site-sk\">SK</em></a></li><li><a href=\"https://arling.sk/mail-doctor/\">Mail Doctor<em class=\"site-sk\">EN</em></a></li><li><a href=\"https://arling.sk/feed-doctor/\">Feed Doctor<em class=\"site-sk\">SK</em></a></li></ul>",
 "hry": "<p>Hry a hlavolamy <em class=\"site-sk\">EN</em></p><ul><li><a href=\"https://arling.sk/games/\">Hry v prohlížeči</a></li><li><a href=\"https://arling.sk/shop/detective-kit-2/\">Zablácené stopy</a></li><li><a href=\"https://arling.sk/shop/escape-room-kids/\">Drak, který spal na klíči</a></li><li><a href=\"https://arling.sk/shop/escape-room-adults/\">Hodinářova dílna</a></li><li><a href=\"https://arling.sk/shop/mystery-case-adults/\">Volavka z Ashgrove</a></li><li><a href=\"https://arling.sk/play/stop/\">Stop at the right frame</a></li><li><a href=\"https://arling.sk/games/owls/\">Owls</a></li><li><a href=\"https://arling.sk/games/beavers/\">Beavers</a></li><li><a href=\"https://arling.sk/games/foxes/\">Foxes</a></li><li><a href=\"https://arling.sk/games/field-notes/\">Field Notes</a></li><li><a href=\"https://arling.sk/shop/detective-kit/\">Detektivka pro děti</a></li><li><a href=\"https://arling.sk/shop/pumpkin-escape-kids/\">Dýňový jarmark</a></li><li><a href=\"https://arling.sk/shop/murder-lantern-ball/\">Murder at the Lantern Ball</a></li><li><a href=\"https://arling.sk/shop/your-friends-as-witnesses/\">Your friends as witnesses</a></li><li><a href=\"https://arling.sk/shop/custom-crossword/\">Custom crossword</a></li><li><a href=\"https://arling.sk/play/\">Hry pro Android</a></li><li><a href=\"https://arling.sk/games/village/\">Puzzle Village</a></li><li><a href=\"https://arling.sk/games/escape/lighthouse/\">Grandpa's Lighthouse</a></li><li><a href=\"https://arling.sk/puzzle-video/\">Puzzle video</a></li><li><a href=\"https://arling.sk/puzzle-studio/\">Puzzle Studio</a></li><li><a href=\"https://arling.sk/puzzle-post/bulletin/\">Puzzle Post Bulletin</a></li><li><a href=\"https://arling.sk/puzzle-publisher/\">Balíček pro vydavatele</a></li></ul>",
 "knihy": "<p>Knihy a dárky <em class=\"site-sk\">EN</em></p><ul><li><a href=\"https://arling.sk/shop/budget-2027/\">Rozpočet 2027</a></li><li><a href=\"https://arling.sk/shop/\">Obchod</a></li><li><a href=\"https://arling.sk/puzzle-books/eink-bundle/\">E-ink balíček hlavolamů</a></li><li><a href=\"https://arling.sk/classics/monte-cristo/drawn/\">Monte Cristo v obrazech</a></li><li><a href=\"https://arling.sk/world/\">The World in Squares</a></li><li><a href=\"https://arling.sk/printables/\">K tisku podle sezóny</a></li><li><a href=\"https://arling.sk/puzzle-books/\">Knihy hlavolamů</a></li><li><a href=\"https://arling.sk/puzzle-books/halloween-logic-puzzle-book/\">Halloweenské hlavolamy</a></li><li><a href=\"https://arling.sk/puzzle-books/logic-puzzle-bundle-200/\">Balíček 200 hlavolamů</a></li><li><a href=\"https://arling.sk/puzzle-books/christmas-logic-puzzle-book/\">Vánoční hlavolamy</a></li><li><a href=\"https://arling.sk/puzzle-books/printable-puzzle-advent-calendar-2026-48-christmas-logic/\">Adventní kalendář hlavolamů 2026</a></li><li><a href=\"https://arling.sk/classics/\">Klasika pro e-ink</a></li><li><a href=\"https://arling.sk/morning-quiet/\">Ranní ticho</a></li><li><a href=\"https://arling.sk/puzzle-post/\">Puzzle Post</a></li><li><a href=\"https://arling.sk/memory-post/\">Memory Post</a></li></ul>"
};
  var vyvojari = "<span>Pro vývojáře</span><a href=\"https://arling.sk/cors-doctor/\">CORS</a><a href=\"https://arling.sk/jwt-doctor/\">JWT</a><a href=\"https://arling.sk/cookie-samesite-doctor/\">Cookie SameSite</a><a href=\"https://arling.sk/redirect-loop-doctor/\">Redirect loop</a><a href=\"https://arling.sk/stripe-webhook-doctor/\">Stripe webhook</a><a href=\"https://arling.sk/firebase-auth-domain-doctor/\">Firebase auth</a><a href=\"https://arling.sk/google-oauth-redirect-doctor/\">Google OAuth</a><a href=\"https://arling.sk/supabase-redirect-doctor/\">Supabase redirect</a><a href=\"https://arling.sk/flutter-supabase-doctor/\">Flutter + Supabase</a><a href=\"https://arling.sk/expo-universal-links-doctor/\">Expo links</a><a href=\"https://arling.sk/expo-supabase-auth-doctor/\">Expo + Supabase</a><a href=\"https://arling.sk/api/\">Puzzle API</a><a href=\"https://arling.sk/motion/\">Motion components</a>";
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
