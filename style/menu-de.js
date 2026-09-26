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
 "firmy": "<p>Firmen und Buchhaltung</p><ul><li><a href=\"https://arling.sk/efaktura/de/\"><b>E-Rechnung</b><span>Prüfen, Vorschau und XML erstellen</span></a></li><li><a href=\"https://arling.sk/kontrola-suboru/de/\"><b>SEPA-Dateiprüfung</b><span>Adressen und Fehler, bevor die Bank sie sieht</span></a></li><li><a href=\"https://arling.sk/proof/de/\"><b>Proof</b><span>Kundenfreigabe vor dem Druck</span></a></li><li><a href=\"https://arling.sk/renewals/de/\"><b>Renewals</b><span>Lieferantendokumente und Fristen</span></a></li><li><a href=\"https://arling.sk/sanktionslisten/\"><b>Sanktionslisten-Check<em class=\"site-nove\">Neu</em></b><span>Partnerliste gegen die EU-Sanktionsliste prüfen</span></a></li></ul><a class=\"site-col-all\" href=\"https://arling.sk/vsetko/de/#firmy\" aria-label=\"Alle in dieser Gruppe: Firmen und Buchhaltung (12)\" data-umami-event=\"shell_menu_group\" data-umami-event-target=\"firmy\"><span class=\"site-dlho\">Alle in dieser Gruppe</span><span class=\"site-kratko\">Alle</span><b>12</b><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M5 12h13M13 6l6 6-6 6\"/></svg></a>",
 "eshopy": "<p>Onlineshops und Websites</p><ul><li><a href=\"https://arling.sk/asistent/de/\"><b>Asistent</b><span>Verkaufsassistent für Onlineshops</span></a></li><li><a href=\"https://arling.sk/gdpr-dokumenty/de/\"><b>DSGVO-Dokumente</b><span>Für Firma oder Shop in 10 Minuten</span></a></li><li><a href=\"https://arling.sk/technologies/\"><b>Stacklog<em class=\"site-nove\">Neu</em></b><span>Worauf eine Website läuft und wann es sich änderte</span></a></li><li><a href=\"https://arling.sk/mail-doctor/\"><b>Mail Doctor</b><span>SPF, DKIM und DMARC einer Domain</span></a></li><li><a href=\"https://arling.sk/feed-doctor/de/\"><b>Feed Doctor</b><span>Produktfeed prüfen</span></a></li></ul><a class=\"site-col-all\" href=\"https://arling.sk/vsetko/de/#eshopy\" aria-label=\"Alle in dieser Gruppe: Onlineshops und Websites (6)\" data-umami-event=\"shell_menu_group\" data-umami-event-target=\"eshopy\"><span class=\"site-dlho\">Alle in dieser Gruppe</span><span class=\"site-kratko\">Alle</span><b>6</b><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M5 12h13M13 6l6 6-6 6\"/></svg></a>",
 "hry": "<p>Spiele und Rätsel <em class=\"site-sk\">EN</em></p><ul><li><a href=\"https://arling.sk/games/\"><b>Browserspiele</b><span>Ein kostenloses Logikrätsel pro Tag</span></a></li><li><a href=\"https://arling.sk/games/owls/\"><b>Owls<em class=\"site-nove\">Neu</em></b><span>Tägliches Rätsel: Tag- und Nachteulen im Gleichgewicht</span></a></li><li><a href=\"https://arling.sk/games/beavers/\"><b>Beavers</b><span>Tägliches Rätsel: eine Biberburg an jedem Baum</span></a></li><li><a href=\"https://arling.sk/games/foxes/\"><b>Foxes</b><span>Tägliches Rätsel: Füchse nach Hinweisen platzieren</span></a></li><li><a href=\"https://arling.sk/games/field-notes/\"><b>Field Notes</b><span>Wortsuche im Notizbuch eines Naturforschers</span></a></li></ul><a class=\"site-col-all\" href=\"https://arling.sk/vsetko/de/#hry\" aria-label=\"Alle in dieser Gruppe: Spiele und Rätsel (14)\" data-umami-event=\"shell_menu_group\" data-umami-event-target=\"hry\"><span class=\"site-dlho\">Alle in dieser Gruppe</span><span class=\"site-kratko\">Alle</span><b>14</b><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M5 12h13M13 6l6 6-6 6\"/></svg></a>",
 "knihy": "<p>Bücher und Geschenke <em class=\"site-sk\">EN</em></p><ul><li><a href=\"https://arling.sk/shop/\"><b>Shop</b><span>Bücher, Rätsel und Geschenke</span></a></li><li><a href=\"https://arling.sk/puzzle-books/eink-bundle/\"><b>E-Ink-Rätselpaket</b><span>3000 Rätsel in zehn Büchern</span></a></li><li><a href=\"https://arling.sk/classics/monte-cristo/drawn/\"><b>Monte Cristo in Bildern<em class=\"site-nove\">Neu</em></b><span>Szenen aus dem Roman, mit Code gezeichnet</span></a></li><li><a href=\"https://arling.sk/world/\"><b>The World in Squares</b><span>Ein Quadrat der Weltkarte mit Namen und Zeichnung</span></a></li><li><a href=\"https://arling.sk/memory-post/\"><b>Memory Post</b><span>Erinnerungen auf Papier</span></a></li></ul><a class=\"site-col-all\" href=\"https://arling.sk/vsetko/de/#knihy\" aria-label=\"Alle in dieser Gruppe: Bücher und Geschenke (9)\" data-umami-event=\"shell_menu_group\" data-umami-event-target=\"knihy\"><span class=\"site-dlho\">Alle in dieser Gruppe</span><span class=\"site-kratko\">Alle</span><b>9</b><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M5 12h13M13 6l6 6-6 6\"/></svg></a>"
};
  var pata = {
 "firmy": "<p>Firmen und Buchhaltung</p><ul><li><a href=\"https://arling.sk/efaktura/de/\">E-Rechnung</a></li><li><a href=\"https://arling.sk/kontrola-suboru/de/\">SEPA-Dateiprüfung</a></li><li><a href=\"https://arling.sk/bankove-nastroje/de/\">Banking-Werkzeuge Pro</a></li><li><a href=\"https://arling.sk/proof/de/\">Proof</a></li><li><a href=\"https://arling.sk/renewals/de/\">Renewals</a></li><li><a href=\"https://arling.sk/parovac-platieb/de/\">Zahlungsabgleich</a></li><li><a href=\"https://arling.sk/sepa-pain001-doctor/\">pain.001-Prüfung</a></li><li><a href=\"https://arling.sk/sepa-pain001-generator/\">pain.001-Generator</a></li><li><a href=\"https://arling.sk/camt053-to-excel/\">Kontoauszug nach Excel</a></li><li><a href=\"https://arling.sk/vzory-zmluv/\">Vertragsvorlagen<em class=\"site-sk\">SK</em></a></li><li><a href=\"https://arling.sk/zivotopis/de/\">Lebenslauf</a></li><li><a href=\"https://arling.sk/sanktionslisten/\">Sanktionslisten-Check</a></li></ul>",
 "eshopy": "<p>Onlineshops und Websites</p><ul><li><a href=\"https://arling.sk/asistent/de/\">Asistent</a></li><li><a href=\"https://arling.sk/gdpr-dokumenty/de/\">DSGVO-Dokumente</a></li><li><a href=\"https://arling.sk/kontrola-eshopu/\">Shop-Prüfung<em class=\"site-sk\">SK</em></a></li><li><a href=\"https://arling.sk/technologies/\">Stacklog</a></li><li><a href=\"https://arling.sk/mail-doctor/\">Mail Doctor</a></li><li><a href=\"https://arling.sk/feed-doctor/de/\">Feed Doctor</a></li></ul>",
 "hry": "<p>Spiele und Rätsel</p><ul><li><a href=\"https://arling.sk/games/\">Browserspiele</a></li><li><a href=\"https://arling.sk/games/owls/\">Owls</a></li><li><a href=\"https://arling.sk/games/beavers/\">Beavers</a></li><li><a href=\"https://arling.sk/games/foxes/\">Foxes</a></li><li><a href=\"https://arling.sk/games/field-notes/\">Field Notes</a></li><li><a href=\"https://arling.sk/shop/detective-kit/\">Detektivspiel</a></li><li><a href=\"https://arling.sk/shop/pumpkin-escape-kids/\">Kürbis-Escape-Room</a></li><li><a href=\"https://arling.sk/play/\">Spiele für Android</a></li><li><a href=\"https://arling.sk/games/village/\">Puzzle Village</a></li><li><a href=\"https://arling.sk/games/escape/lighthouse/\">Grandpa's Lighthouse</a></li><li><a href=\"https://arling.sk/puzzle-video/\">Rätselvideo</a></li><li><a href=\"https://arling.sk/puzzle-studio/\">Puzzle Studio</a></li><li><a href=\"https://arling.sk/puzzle-post/bulletin/\">Puzzle Post Bulletin</a></li><li><a href=\"https://arling.sk/puzzle-publisher/\">Verlagspaket</a></li></ul>",
 "knihy": "<p>Bücher und Geschenke</p><ul><li><a href=\"https://arling.sk/shop/\">Shop</a></li><li><a href=\"https://arling.sk/puzzle-books/eink-bundle/\">E-Ink-Rätselpaket</a></li><li><a href=\"https://arling.sk/classics/monte-cristo/drawn/\">Monte Cristo in Bildern</a></li><li><a href=\"https://arling.sk/world/\">The World in Squares</a></li><li><a href=\"https://arling.sk/puzzle-books/\">Rätselbücher</a></li><li><a href=\"https://arling.sk/classics/\">Klassiker für E-Ink</a></li><li><a href=\"https://arling.sk/morning-quiet/\">Morning Quiet</a></li><li><a href=\"https://arling.sk/puzzle-post/\">Puzzle Post</a></li><li><a href=\"https://arling.sk/memory-post/\">Memory Post</a></li></ul>"
};
  var vyvojari = "<span>Für Entwickler</span><a href=\"https://arling.sk/cors-doctor/\">CORS</a><a href=\"https://arling.sk/jwt-doctor/\">JWT</a><a href=\"https://arling.sk/cookie-samesite-doctor/\">Cookie SameSite</a><a href=\"https://arling.sk/redirect-loop-doctor/\">Redirect loop</a><a href=\"https://arling.sk/stripe-webhook-doctor/\">Stripe webhook</a><a href=\"https://arling.sk/firebase-auth-domain-doctor/\">Firebase auth</a><a href=\"https://arling.sk/google-oauth-redirect-doctor/\">Google OAuth</a><a href=\"https://arling.sk/supabase-redirect-doctor/\">Supabase redirect</a><a href=\"https://arling.sk/flutter-supabase-doctor/\">Flutter + Supabase</a><a href=\"https://arling.sk/expo-universal-links-doctor/\">Expo links</a><a href=\"https://arling.sk/expo-supabase-auth-doctor/\">Expo + Supabase</a><a href=\"https://arling.sk/api/\">Puzzle API</a><a href=\"https://arling.sk/motion/\">Motion components</a>";
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
