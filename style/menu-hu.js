/* ARLing: plný katalóg v menu a päte (hu). Vyrobil ops/design/menu-skript.mjs z ops/design/uvod-katalog.mjs,
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
 "eshopy": "<p>Shopify és webshopok <em class=\"site-sk\">EN</em></p><ul><li><a href=\"https://arling.sk/agent-ready/\"><b>Agentic Product Check<em class=\"site-nove\">Új</em></b><span>Shopify-alkalmazás AI-vásárláshoz, jóváhagyásra vár</span></a></li><li><a href=\"https://arling.sk/feed-doctor/agent-ready/\"><b>Bolt-ellenőrzés AI-ügynököknek</b><span>Ingyenes, nyilvános minta, telepítés nélkül</span></a></li><li><a href=\"https://arling.sk/feed-doctor/en/\"><b>Feed Doctor</b><span>Termékfeed ellenőrzése</span></a></li><li><a href=\"https://arling.sk/orbling/support/\"><b>Orbling</b><span>Shopify-alkalmazás, termékoldali blokkok, 30 naponként 19 USD</span></a></li></ul><a class=\"site-col-all\" href=\"https://arling.sk/vsetko/en/#eshopy\" aria-label=\"A teljes csoport: Shopify és webshopok (7)\" data-umami-event=\"shell_menu_group\" data-umami-event-target=\"eshopy\"><span class=\"site-dlho\">A teljes csoport</span><span class=\"site-kratko\">Mind</span><b>7</b><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M5 12h13M13 6l6 6-6 6\"/></svg></a>",
 "firmy": "<p>Pénzügyek és ügyintézés <em class=\"site-sk\">EN</em></p><ul><li><a href=\"https://arling.sk/efaktura/en/\"><b>E-számla</b><span>Ellenőrzés, előnézet és XML készítése</span></a></li><li><a href=\"https://arling.sk/sepa-pain001-doctor/en/\"><b>pain.001 ellenőrzés</b><span>Miért utasította el a bank a fájlt</span></a></li><li><a href=\"https://arling.sk/kontrola-suboru/en/\"><b>SEPA-fájl ellenőrzése</b><span>Címek és hibák, mielőtt a bank látná őket</span></a></li><li><a href=\"https://arling.sk/camt053-to-excel/en/\"><b>Kivonat Excelbe</b><span>camt.053 és MT940 táblázatba</span></a></li><li><a href=\"https://arling.sk/parovac-platieb/en/\"><b>Fizetéspárosító</b><span>Bankszámlakivonat összevetése a számlákkal</span></a></li></ul><a class=\"site-col-all\" href=\"https://arling.sk/vsetko/en/#firmy\" aria-label=\"A teljes csoport: Pénzügyek és ügyintézés (13)\" data-umami-event=\"shell_menu_group\" data-umami-event-target=\"firmy\"><span class=\"site-dlho\">A teljes csoport</span><span class=\"site-kratko\">Mind</span><b>13</b><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M5 12h13M13 6l6 6-6 6\"/></svg></a>",
 "lab": "<p>Lab <em class=\"site-sk\">EN</em></p><ul><li><a href=\"https://arling.sk/technologies/\"><b>Stacklog</b><span>Min fut egy weboldal, és mikor változott</span></a></li><li><a href=\"https://arling.sk/mail-doctor/\"><b>Mail Doctor</b><span>Egy domain SPF, DKIM és DMARC beállításai</span></a></li><li><a href=\"https://arling.sk/rukopis/en/\"><b>Rukopis</b><span>Megtalálja a sablonos fordulatokat a szövegében</span></a></li><li><a href=\"https://arling.sk/super-intelligence/\"><b>AI to SI Checker</b><span>Az AI szót SI-re cseréli, a törvények címét meghagyja</span></a></li><li><a href=\"https://arling.sk/zivotopis/en/\"><b>Önéletrajz</b><span>Kész önéletrajz regisztráció nélkül</span></a></li></ul><a class=\"site-col-all\" href=\"https://arling.sk/en/lab/\" aria-label=\"A teljes csoport: Lab (29)\" data-umami-event=\"shell_menu_group\" data-umami-event-target=\"lab\"><span class=\"site-dlho\">A teljes csoport</span><span class=\"site-kratko\">Mind</span><b>29</b><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M5 12h13M13 6l6 6-6 6\"/></svg></a>"
};
  var pata = {
 "eshopy": "<p>Shopify és webshopok</p><ul><li><a href=\"https://arling.sk/agent-ready/\">Agentic Product Check<em class=\"site-sk\">EN</em></a></li><li><a href=\"https://arling.sk/feed-doctor/agent-ready/\">Bolt-ellenőrzés AI-ügynököknek<em class=\"site-sk\">EN</em></a></li><li><a href=\"https://arling.sk/feed-doctor/en/\">Feed Doctor<em class=\"site-sk\">EN</em></a></li><li><a href=\"https://arling.sk/orbling/support/\">Orbling<em class=\"site-sk\">EN</em></a></li><li><a href=\"https://arling.sk/rychlost-webu/\">Weboldal sebessége<em class=\"site-sk\">SK</em></a></li><li><a href=\"https://arling.sk/kontrola-eshopu/\">Webshop-ellenőrzés<em class=\"site-sk\">SK</em></a></li></ul>",
 "firmy": "<p>Pénzügyek és ügyintézés</p><ul><li><a href=\"https://arling.sk/efaktura/en/\">E-számla<em class=\"site-sk\">EN</em></a></li><li><a href=\"https://arling.sk/sepa-pain001-doctor/en/\">pain.001 ellenőrzés<em class=\"site-sk\">EN</em></a></li><li><a href=\"https://arling.sk/kontrola-suboru/en/\">SEPA-fájl ellenőrzése<em class=\"site-sk\">EN</em></a></li><li><a href=\"https://arling.sk/camt053-to-excel/en/\">Kivonat Excelbe<em class=\"site-sk\">EN</em></a></li><li><a href=\"https://arling.sk/parovac-platieb/en/\">Fizetéspárosító<em class=\"site-sk\">EN</em></a></li><li><a href=\"https://arling.sk/sepa-pain001-generator/en/\">pain.001 generátor<em class=\"site-sk\">EN</em></a></li><li><a href=\"https://arling.sk/bankove-nastroje/en/\">Banki eszközök Pro<em class=\"site-sk\">EN</em></a></li><li><a href=\"https://arling.sk/gdpr-dokumenty/\">GDPR-dokumentumok<em class=\"site-sk\">SK</em></a></li><li><a href=\"https://arling.sk/web/\">Gyors weboldal kisvállalkozásnak<em class=\"site-sk\">SK</em></a></li><li><a href=\"https://arling.sk/vzory-zmluv/\">Szerződésminták<em class=\"site-sk\">SK</em></a></li><li><a href=\"https://arling.sk/sanctions-check/\">Uniós szankciós ellenőrzés<em class=\"site-sk\">EN</em></a></li><li><a href=\"https://arling.sk/proof/\">Proof<em class=\"site-sk\">EN</em></a></li><li><a href=\"https://arling.sk/renewals/\">Renewals<em class=\"site-sk\">EN</em></a></li></ul>",
 "lab": "<p>Lab <em class=\"site-sk\">EN</em></p><ul><li><a href=\"https://arling.sk/technologies/\">Stacklog</a></li><li><a href=\"https://arling.sk/mail-doctor/\">Mail Doctor</a></li><li><a href=\"https://arling.sk/rukopis/en/\">Rukopis</a></li><li><a href=\"https://arling.sk/super-intelligence/\">AI to SI Checker</a></li><li><a href=\"https://arling.sk/zivotopis/en/\">Önéletrajz</a></li><li><a href=\"https://arling.sk/en/lab/\">A teljes csoport (29)</a></li></ul>"
};
  var vyvojari = "<span>Fejlesztőknek</span><a href=\"https://arling.sk/cors-doctor/\">CORS</a><a href=\"https://arling.sk/jwt-doctor/\">JWT</a><a href=\"https://arling.sk/cookie-samesite-doctor/\">Cookie SameSite</a><a href=\"https://arling.sk/redirect-loop-doctor/\">Redirect loop</a><a href=\"https://arling.sk/stripe-webhook-doctor/\">Stripe webhook</a><a href=\"https://arling.sk/firebase-auth-domain-doctor/\">Firebase auth</a><a href=\"https://arling.sk/google-oauth-redirect-doctor/\">Google OAuth</a><a href=\"https://arling.sk/supabase-redirect-doctor/\">Supabase redirect</a><a href=\"https://arling.sk/flutter-supabase-doctor/\">Flutter + Supabase</a><a href=\"https://arling.sk/expo-universal-links-doctor/\">Expo links</a><a href=\"https://arling.sk/expo-supabase-auth-doctor/\">Expo + Supabase</a><a href=\"https://arling.sk/api/\">Puzzle API</a><a href=\"https://arling.sk/motion/\">Motion components</a>";
  var pocet = "78";
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
