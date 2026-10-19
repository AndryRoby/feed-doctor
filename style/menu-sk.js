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
 "eshopy": "<p>Shopify a e-shopy</p><ul><li><a href=\"https://arling.sk/agent-ready/\"><b>Agentic Product Check<em class=\"site-nove\">Nové</em><em class=\"site-sk\">EN</em></b><span>Shopify appka, katalóg pre AI nakupovanie, čaká na schválenie</span></a></li><li><a href=\"https://arling.sk/feed-doctor/agent-ready/sk/\"><b>Kontrola obchodu pre AI agentov</b><span>Zadarmo, verejná vzorka bez inštalácie</span></a></li><li><a href=\"https://arling.sk/feed-doctor/\"><b>Feed Doctor</b><span>Kontrola produktového feedu</span></a></li><li><a href=\"https://arling.sk/orbling/support/\"><b>Orbling<em class=\"site-sk\">EN</em></b><span>Shopify appka, bloky stránky produktu, 19 USD za 30 dní</span></a></li><li><a href=\"https://arling.sk/rychlost-webu/\"><b>Rýchlosť webu zadarmo</b><span>Zmerajte web na mobile za pol minúty</span></a></li></ul><a class=\"site-col-all\" href=\"https://arling.sk/vsetko/#eshopy\" aria-label=\"Všetko v skupine: Shopify a e-shopy (7)\" data-umami-event=\"shell_menu_group\" data-umami-event-target=\"eshopy\"><span class=\"site-dlho\">Všetko v skupine</span><span class=\"site-kratko\">Všetko</span><b>7</b><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M5 12h13M13 6l6 6-6 6\"/></svg></a>",
 "firmy": "<p>Financie a firma</p><ul><li><a href=\"https://arling.sk/efaktura/\"><b>E-faktúra</b><span>Kontrola, náhľad a tvorba XML</span></a></li><li><a href=\"https://arling.sk/sepa-pain001-doctor/\"><b>Kontrola pain.001</b><span>Prečo banka odmietla súbor</span></a></li><li><a href=\"https://arling.sk/kontrola-suboru/\"><b>Kontrola SEPA súboru</b><span>Adresy a chyby skôr, než to uvidí banka</span></a></li><li><a href=\"https://arling.sk/camt053-to-excel/\"><b>Výpis do Excelu</b><span>camt.053 a MT940 do tabuľky</span></a></li><li><a href=\"https://arling.sk/web/\"><b>Rýchly web pre malú firmu<em class=\"site-nove\">Nové</em></b><span>Jedna stránka za 290 €, platba po schválení</span></a></li></ul><a class=\"site-col-all\" href=\"https://arling.sk/vsetko/#firmy\" aria-label=\"Všetko v skupine: Financie a firma (13)\" data-umami-event=\"shell_menu_group\" data-umami-event-target=\"firmy\"><span class=\"site-dlho\">Všetko v skupine</span><span class=\"site-kratko\">Všetko</span><b>13</b><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M5 12h13M13 6l6 6-6 6\"/></svg></a>",
 "lab": "<p>Lab</p><ul><li><a href=\"https://arling.sk/technologie/\"><b>Stacklog</b><span>Na čom web beží a kedy sa to zmenilo</span></a></li><li><a href=\"https://arling.sk/mail-doctor/\"><b>Mail Doctor<em class=\"site-sk\">EN</em></b><span>SPF, DKIM a DMARC domény</span></a></li><li><a href=\"https://arling.sk/rukopis/\"><b>Rukopis</b><span>Nájde šablónové frázy vo vašom texte</span></a></li><li><a href=\"https://arling.sk/super-intelligence/\"><b>AI to SI Checker<em class=\"site-sk\">EN</em></b><span>Zamení AI za SI, názvy zákonov nechá</span></a></li><li><a href=\"https://arling.sk/zivotopis/\"><b>Životopis</b><span>Hotové CV bez registrácie</span></a></li></ul><a class=\"site-col-all\" href=\"https://arling.sk/lab/\" aria-label=\"Všetko v skupine: Lab (29)\" data-umami-event=\"shell_menu_group\" data-umami-event-target=\"lab\"><span class=\"site-dlho\">Všetko v skupine</span><span class=\"site-kratko\">Všetko</span><b>29</b><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M5 12h13M13 6l6 6-6 6\"/></svg></a>"
};
  var pata = {
 "eshopy": "<p>Shopify a e-shopy</p><ul><li><a href=\"https://arling.sk/agent-ready/\">Agentic Product Check<em class=\"site-sk\">EN</em></a></li><li><a href=\"https://arling.sk/feed-doctor/agent-ready/sk/\">Kontrola obchodu pre AI agentov</a></li><li><a href=\"https://arling.sk/feed-doctor/\">Feed Doctor</a></li><li><a href=\"https://arling.sk/orbling/support/\">Orbling<em class=\"site-sk\">EN</em></a></li><li><a href=\"https://arling.sk/rychlost-webu/\">Rýchlosť webu zadarmo</a></li><li><a href=\"https://arling.sk/kontrola-eshopu/\">Kontrola e-shopu</a></li></ul>",
 "firmy": "<p>Financie a firma</p><ul><li><a href=\"https://arling.sk/efaktura/\">E-faktúra</a></li><li><a href=\"https://arling.sk/sepa-pain001-doctor/\">Kontrola pain.001</a></li><li><a href=\"https://arling.sk/kontrola-suboru/\">Kontrola SEPA súboru</a></li><li><a href=\"https://arling.sk/camt053-to-excel/\">Výpis do Excelu</a></li><li><a href=\"https://arling.sk/parovac-platieb/\">Párovač platieb</a></li><li><a href=\"https://arling.sk/sepa-pain001-generator/\">Generátor pain.001</a></li><li><a href=\"https://arling.sk/bankove-nastroje/\">Bankové nástroje Pro</a></li><li><a href=\"https://arling.sk/gdpr-dokumenty/\">GDPR dokumenty</a></li><li><a href=\"https://arling.sk/web/\">Rýchly web pre malú firmu</a></li><li><a href=\"https://arling.sk/vzory-zmluv/\">Vzory zmlúv</a></li><li><a href=\"https://arling.sk/sankcny-zoznam/\">Kontrola sankcií EÚ</a></li><li><a href=\"https://arling.sk/proof/sk/\">Proof</a></li><li><a href=\"https://arling.sk/renewals/sk/\">Renewals</a></li></ul>",
 "lab": "<p>Lab</p><ul><li><a href=\"https://arling.sk/technologie/\">Stacklog</a></li><li><a href=\"https://arling.sk/mail-doctor/\">Mail Doctor<em class=\"site-sk\">EN</em></a></li><li><a href=\"https://arling.sk/rukopis/\">Rukopis</a></li><li><a href=\"https://arling.sk/super-intelligence/\">AI to SI Checker<em class=\"site-sk\">EN</em></a></li><li><a href=\"https://arling.sk/zivotopis/\">Životopis</a></li><li><a href=\"https://arling.sk/lab/\">Všetko v skupine (29)</a></li></ul>"
};
  var vyvojari = "<span>Pre vývojárov</span><a href=\"https://arling.sk/cors-doctor/\">CORS</a><a href=\"https://arling.sk/jwt-doctor/\">JWT</a><a href=\"https://arling.sk/cookie-samesite-doctor/\">Cookie SameSite</a><a href=\"https://arling.sk/redirect-loop-doctor/\">Redirect loop</a><a href=\"https://arling.sk/stripe-webhook-doctor/\">Stripe webhook</a><a href=\"https://arling.sk/firebase-auth-domain-doctor/\">Firebase auth</a><a href=\"https://arling.sk/google-oauth-redirect-doctor/\">Google OAuth</a><a href=\"https://arling.sk/supabase-redirect-doctor/\">Supabase redirect</a><a href=\"https://arling.sk/flutter-supabase-doctor/\">Flutter + Supabase</a><a href=\"https://arling.sk/expo-universal-links-doctor/\">Expo links</a><a href=\"https://arling.sk/expo-supabase-auth-doctor/\">Expo + Supabase</a><a href=\"https://arling.sk/api/\">Puzzle API</a><a href=\"https://arling.sk/motion/\">Motion components</a>";
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
