/* ARLing: plný katalóg v menu a päte (de). Vyrobil ops/design/menu-skript.mjs z ops/design/uvod-katalog.mjs,
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
 "eshopy": "<p>Shopify und Onlineshops</p><ul><li><a href=\"https://arling.sk/agent-ready/\"><b>Agentic Product Check<em class=\"site-nove\">Neu</em><em class=\"site-sk\">EN</em></b><span>Shopify-App für KI-Shopping, wartet auf Freigabe</span></a></li><li><a href=\"https://arling.sk/feed-doctor/agent-ready/de/\"><b>Shop-Check für KI-Agenten</b><span>Kostenlos, öffentliche Stichprobe, ohne Installation</span></a></li><li><a href=\"https://arling.sk/feed-doctor/de/\"><b>Feed Doctor</b><span>Produktfeed prüfen</span></a></li><li><a href=\"https://arling.sk/orbling/support/\"><b>Orbling<em class=\"site-sk\">EN</em></b><span>Shopify-App, Blöcke für die Produktseite, 19 USD alle 30 Tage</span></a></li></ul><a class=\"site-col-all\" href=\"https://arling.sk/vsetko/de/#eshopy\" aria-label=\"Alle in dieser Gruppe: Shopify und Onlineshops (7)\" data-umami-event=\"shell_menu_group\" data-umami-event-target=\"eshopy\"><span class=\"site-dlho\">Alle in dieser Gruppe</span><span class=\"site-kratko\">Alle</span><b>7</b><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M5 12h13M13 6l6 6-6 6\"/></svg></a>",
 "firmy": "<p>Finanzen und Verwaltung</p><ul><li><a href=\"https://arling.sk/efaktura/de/\"><b>E-Rechnung</b><span>Prüfen, Vorschau und XML erstellen</span></a></li><li><a href=\"https://arling.sk/sepa-pain001-doctor/de/\"><b>pain.001-Prüfung</b><span>Warum die Bank die Datei ablehnt</span></a></li><li><a href=\"https://arling.sk/kontrola-suboru/de/\"><b>SEPA-Dateiprüfung</b><span>Adressen und Fehler, bevor die Bank sie sieht</span></a></li><li><a href=\"https://arling.sk/camt053-to-excel/de/\"><b>Kontoauszug nach Excel</b><span>camt.053 und MT940 als Tabelle</span></a></li><li><a href=\"https://arling.sk/parovac-platieb/de/\"><b>Zahlungsabgleich</b><span>Kontoauszug gegen Rechnungen</span></a></li></ul><a class=\"site-col-all\" href=\"https://arling.sk/vsetko/de/#firmy\" aria-label=\"Alle in dieser Gruppe: Finanzen und Verwaltung (13)\" data-umami-event=\"shell_menu_group\" data-umami-event-target=\"firmy\"><span class=\"site-dlho\">Alle in dieser Gruppe</span><span class=\"site-kratko\">Alle</span><b>13</b><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M5 12h13M13 6l6 6-6 6\"/></svg></a>",
 "lab": "<p>Lab</p><ul><li><a href=\"https://arling.sk/technologies/\"><b>Stacklog<em class=\"site-sk\">EN</em></b><span>Worauf eine Website läuft und wann sich das geändert hat</span></a></li><li><a href=\"https://arling.sk/mail-doctor/\"><b>Mail Doctor<em class=\"site-sk\">EN</em></b><span>SPF, DKIM und DMARC einer Domain</span></a></li><li><a href=\"https://arling.sk/rukopis/de/\"><b>Rukopis</b><span>Findet Floskeln in Ihrem Text</span></a></li><li><a href=\"https://arling.sk/super-intelligence/\"><b>AI to SI Checker<em class=\"site-sk\">EN</em></b><span>Ersetzt AI durch SI, Gesetzestitel bleiben</span></a></li><li><a href=\"https://arling.sk/zivotopis/de/\"><b>Lebenslauf</b><span>Fertiger Lebenslauf ohne Konto</span></a></li></ul><a class=\"site-col-all\" href=\"https://arling.sk/de/lab/\" aria-label=\"Alle in dieser Gruppe: Lab (29)\" data-umami-event=\"shell_menu_group\" data-umami-event-target=\"lab\"><span class=\"site-dlho\">Alle in dieser Gruppe</span><span class=\"site-kratko\">Alle</span><b>29</b><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M5 12h13M13 6l6 6-6 6\"/></svg></a>"
};
  var pata = {
 "eshopy": "<p>Shopify und Onlineshops</p><ul><li><a href=\"https://arling.sk/agent-ready/\">Agentic Product Check<em class=\"site-sk\">EN</em></a></li><li><a href=\"https://arling.sk/feed-doctor/agent-ready/de/\">Shop-Check für KI-Agenten</a></li><li><a href=\"https://arling.sk/feed-doctor/de/\">Feed Doctor</a></li><li><a href=\"https://arling.sk/orbling/support/\">Orbling<em class=\"site-sk\">EN</em></a></li><li><a href=\"https://arling.sk/rychlost-webu/\">Website-Tempo prüfen<em class=\"site-sk\">SK</em></a></li><li><a href=\"https://arling.sk/kontrola-eshopu/\">Shop-Prüfung<em class=\"site-sk\">SK</em></a></li></ul>",
 "firmy": "<p>Finanzen und Verwaltung</p><ul><li><a href=\"https://arling.sk/efaktura/de/\">E-Rechnung</a></li><li><a href=\"https://arling.sk/sepa-pain001-doctor/de/\">pain.001-Prüfung</a></li><li><a href=\"https://arling.sk/kontrola-suboru/de/\">SEPA-Dateiprüfung</a></li><li><a href=\"https://arling.sk/camt053-to-excel/de/\">Kontoauszug nach Excel</a></li><li><a href=\"https://arling.sk/parovac-platieb/de/\">Zahlungsabgleich</a></li><li><a href=\"https://arling.sk/sepa-pain001-generator/de/\">pain.001-Generator</a></li><li><a href=\"https://arling.sk/bankove-nastroje/de/\">Banking-Werkzeuge Pro</a></li><li><a href=\"https://arling.sk/gdpr-dokumenty/de/\">DSGVO-Dokumente</a></li><li><a href=\"https://arling.sk/web/\">Schnelle Website für kleine Firmen<em class=\"site-sk\">SK</em></a></li><li><a href=\"https://arling.sk/vzory-zmluv/\">Vertragsvorlagen<em class=\"site-sk\">SK</em></a></li><li><a href=\"https://arling.sk/sanktionslisten/\">Sanktionslisten-Check</a></li><li><a href=\"https://arling.sk/proof/de/\">Proof</a></li><li><a href=\"https://arling.sk/renewals/de/\">Renewals</a></li></ul>",
 "lab": "<p>Lab</p><ul><li><a href=\"https://arling.sk/technologies/\">Stacklog<em class=\"site-sk\">EN</em></a></li><li><a href=\"https://arling.sk/mail-doctor/\">Mail Doctor<em class=\"site-sk\">EN</em></a></li><li><a href=\"https://arling.sk/rukopis/de/\">Rukopis</a></li><li><a href=\"https://arling.sk/super-intelligence/\">AI to SI Checker<em class=\"site-sk\">EN</em></a></li><li><a href=\"https://arling.sk/zivotopis/de/\">Lebenslauf</a></li><li><a href=\"https://arling.sk/de/lab/\">Alle in dieser Gruppe (29)</a></li></ul>"
};
  var vyvojari = "<span>Für Entwickler</span><a href=\"https://arling.sk/cors-doctor/\">CORS</a><a href=\"https://arling.sk/jwt-doctor/\">JWT</a><a href=\"https://arling.sk/cookie-samesite-doctor/\">Cookie SameSite</a><a href=\"https://arling.sk/redirect-loop-doctor/\">Redirect loop</a><a href=\"https://arling.sk/stripe-webhook-doctor/\">Stripe webhook</a><a href=\"https://arling.sk/firebase-auth-domain-doctor/\">Firebase auth</a><a href=\"https://arling.sk/google-oauth-redirect-doctor/\">Google OAuth</a><a href=\"https://arling.sk/supabase-redirect-doctor/\">Supabase redirect</a><a href=\"https://arling.sk/flutter-supabase-doctor/\">Flutter + Supabase</a><a href=\"https://arling.sk/expo-universal-links-doctor/\">Expo links</a><a href=\"https://arling.sk/expo-supabase-auth-doctor/\">Expo + Supabase</a><a href=\"https://arling.sk/api/\">Puzzle API</a><a href=\"https://arling.sk/motion/\">Motion components</a>";
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
