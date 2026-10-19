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
 "eshopy": "<p>Shopify and online shops</p><ul><li><a href=\"https://arling.sk/agent-ready/\"><b>Agentic Product Check<em class=\"site-nove\">New</em></b><span>Shopify app for AI shopping readiness, awaiting approval</span></a></li><li><a href=\"https://arling.sk/feed-doctor/agent-ready/\"><b>Store check for AI agents</b><span>Free, a public sample, nothing to install</span></a></li><li><a href=\"https://arling.sk/feed-doctor/en/\"><b>Feed Doctor</b><span>Product feed check</span></a></li><li><a href=\"https://arling.sk/orbling/support/\"><b>Orbling</b><span>Shopify app, product page blocks, 19 USD every 30 days</span></a></li></ul><a class=\"site-col-all\" href=\"https://arling.sk/vsetko/en/#eshopy\" aria-label=\"All in this group: Shopify and online shops (7)\" data-umami-event=\"shell_menu_group\" data-umami-event-target=\"eshopy\"><span class=\"site-dlho\">All in this group</span><span class=\"site-kratko\">All</span><b>7</b><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M5 12h13M13 6l6 6-6 6\"/></svg></a>",
 "firmy": "<p>Finance and paperwork</p><ul><li><a href=\"https://arling.sk/efaktura/en/\"><b>E-invoice</b><span>Check, preview and create XML</span></a></li><li><a href=\"https://arling.sk/sepa-pain001-doctor/en/\"><b>pain.001 check</b><span>Why the bank rejected the file</span></a></li><li><a href=\"https://arling.sk/kontrola-suboru/en/\"><b>SEPA file check</b><span>Addresses and errors before your bank sees them</span></a></li><li><a href=\"https://arling.sk/camt053-to-excel/en/\"><b>Statement to Excel</b><span>camt.053 and MT940 to a sheet</span></a></li><li><a href=\"https://arling.sk/parovac-platieb/en/\"><b>Payment matcher</b><span>Statement against invoices</span></a></li></ul><a class=\"site-col-all\" href=\"https://arling.sk/vsetko/en/#firmy\" aria-label=\"All in this group: Finance and paperwork (13)\" data-umami-event=\"shell_menu_group\" data-umami-event-target=\"firmy\"><span class=\"site-dlho\">All in this group</span><span class=\"site-kratko\">All</span><b>13</b><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M5 12h13M13 6l6 6-6 6\"/></svg></a>",
 "lab": "<p>Lab</p><ul><li><a href=\"https://arling.sk/technologies/\"><b>Stacklog</b><span>What a site runs on, and when it changed</span></a></li><li><a href=\"https://arling.sk/mail-doctor/\"><b>Mail Doctor</b><span>SPF, DKIM and DMARC of a domain</span></a></li><li><a href=\"https://arling.sk/rukopis/en/\"><b>Rukopis</b><span>Finds stock phrases in your writing</span></a></li><li><a href=\"https://arling.sk/super-intelligence/\"><b>AI to SI Checker</b><span>Switch AI to SI wording, keep law titles</span></a></li><li><a href=\"https://arling.sk/zivotopis/en/\"><b>CV builder</b><span>A finished CV, no account</span></a></li></ul><a class=\"site-col-all\" href=\"https://arling.sk/en/lab/\" aria-label=\"All in this group: Lab (29)\" data-umami-event=\"shell_menu_group\" data-umami-event-target=\"lab\"><span class=\"site-dlho\">All in this group</span><span class=\"site-kratko\">All</span><b>29</b><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M5 12h13M13 6l6 6-6 6\"/></svg></a>"
};
  var pata = {
 "eshopy": "<p>Shopify and online shops</p><ul><li><a href=\"https://arling.sk/agent-ready/\">Agentic Product Check</a></li><li><a href=\"https://arling.sk/feed-doctor/agent-ready/\">Store check for AI agents</a></li><li><a href=\"https://arling.sk/feed-doctor/en/\">Feed Doctor</a></li><li><a href=\"https://arling.sk/orbling/support/\">Orbling</a></li><li><a href=\"https://arling.sk/rychlost-webu/\">Website speed check<em class=\"site-sk\">SK</em></a></li><li><a href=\"https://arling.sk/kontrola-eshopu/\">Online shop check<em class=\"site-sk\">SK</em></a></li></ul>",
 "firmy": "<p>Finance and paperwork</p><ul><li><a href=\"https://arling.sk/efaktura/en/\">E-invoice</a></li><li><a href=\"https://arling.sk/sepa-pain001-doctor/en/\">pain.001 check</a></li><li><a href=\"https://arling.sk/kontrola-suboru/en/\">SEPA file check</a></li><li><a href=\"https://arling.sk/camt053-to-excel/en/\">Statement to Excel</a></li><li><a href=\"https://arling.sk/parovac-platieb/en/\">Payment matcher</a></li><li><a href=\"https://arling.sk/sepa-pain001-generator/en/\">pain.001 generator</a></li><li><a href=\"https://arling.sk/bankove-nastroje/en/\">Banking tools Pro</a></li><li><a href=\"https://arling.sk/gdpr-dokumenty/\">GDPR documents<em class=\"site-sk\">SK</em></a></li><li><a href=\"https://arling.sk/web/\">Fast website for a small business<em class=\"site-sk\">SK</em></a></li><li><a href=\"https://arling.sk/vzory-zmluv/\">Contract templates<em class=\"site-sk\">SK</em></a></li><li><a href=\"https://arling.sk/sanctions-check/\">EU sanctions check</a></li><li><a href=\"https://arling.sk/proof/\">Proof</a></li><li><a href=\"https://arling.sk/renewals/\">Renewals</a></li></ul>",
 "lab": "<p>Lab</p><ul><li><a href=\"https://arling.sk/technologies/\">Stacklog</a></li><li><a href=\"https://arling.sk/mail-doctor/\">Mail Doctor</a></li><li><a href=\"https://arling.sk/rukopis/en/\">Rukopis</a></li><li><a href=\"https://arling.sk/super-intelligence/\">AI to SI Checker</a></li><li><a href=\"https://arling.sk/zivotopis/en/\">CV builder</a></li><li><a href=\"https://arling.sk/en/lab/\">All in this group (29)</a></li></ul>"
};
  var vyvojari = "<span>For developers</span><a href=\"https://arling.sk/cors-doctor/\">CORS</a><a href=\"https://arling.sk/jwt-doctor/\">JWT</a><a href=\"https://arling.sk/cookie-samesite-doctor/\">Cookie SameSite</a><a href=\"https://arling.sk/redirect-loop-doctor/\">Redirect loop</a><a href=\"https://arling.sk/stripe-webhook-doctor/\">Stripe webhook</a><a href=\"https://arling.sk/firebase-auth-domain-doctor/\">Firebase auth</a><a href=\"https://arling.sk/google-oauth-redirect-doctor/\">Google OAuth</a><a href=\"https://arling.sk/supabase-redirect-doctor/\">Supabase redirect</a><a href=\"https://arling.sk/flutter-supabase-doctor/\">Flutter + Supabase</a><a href=\"https://arling.sk/expo-universal-links-doctor/\">Expo links</a><a href=\"https://arling.sk/expo-supabase-auth-doctor/\">Expo + Supabase</a><a href=\"https://arling.sk/api/\">Puzzle API</a><a href=\"https://arling.sk/motion/\">Motion components</a>";
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
