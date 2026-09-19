/* Žiara: živé svetlo v pozadí. Vlastné shadery, žiadna knižnica, 0 cudzích domén.
 *
 * Prečo vlastné a nie unicorn.studio: ten sa načítava z cudzieho CDN, čo naša
 * CSP zakazuje, a na každej stránke tvrdíme, že sa nič neposiela tretím stranám.
 * Odmerané 6. 9. 2026 (ops/design/pohyb-dokaz.mjs): unicorn.studio beží na
 * siedmich WebGL plátnach plus prehrávaných videách a mení 38 % plochy za snímku.
 * Naša najvýraznejšia scéna mení 8,8 % a stojí jeden súbor.
 *
 * Zodpovednosť voči návštevníkovi je dôležitejšia než efekt, preto:
 *   - `prefers-reduced-motion: reduce` vykreslí JEDEN snímok a slučka sa nespustí;
 *   - po načítaní stránky sa vykreslí tiež len JEDEN snímok a slučka čaká na
 *     prvú činnosť človeka, teda pohyb myšou, dotyk, scroll alebo klávesu
 *     (prečo presne, to je nižšie pri NECINNOST);
 *   - kreslí sa len to plátno, ktoré je práve v obraze (IntersectionObserver);
 *   - keď je karta prehliadača skrytá, nekreslí sa nič (visibilitychange);
 *   - 30 snímok za sekundu, kým sa človek nehýbe, a 60 len tých pár desatín
 *     sekundy, čo naozaj hýbe myšou: rozdiel vidieť presne vtedy, keď svetlo
 *     dobieha kurzor, a inokedy je to len spálená polovica výkonu;
 *   - po 20 s bez pohybu, scrollu a klávesy sa kreslenie zastaví úplne;
 *   - rozlíšenie najviac 1,5-násobok bodu, na úzkych obrazovkách 1,25:
 *     telefón má hustý displej a plná hustota hreje batériu bez zisku;
 *   - keď WebGL nie je, plátno sa odstráni a ostane CSS prechod pod ním.
 * Plátno je `aria-hidden` a `pointer-events:none`, do obsluhy nezasahuje.
 *
 * JEDNO plátno na stránku, a to do úvodu. Nie do každej sekcie: viac plátien
 * znesie len prehliadka na /pozadia/, kde sú samy osebe obsahom, a aj tam
 * kreslí vždy len to, na ktoré sa človek práve pozerá.
 *
 * Použitie:
 *   <canvas class="zar-plocha" data-zar="stuhy" aria-hidden="true"></canvas>
 *   <script src="/style/zar.js" defer></script>
 */
(function () {
  'use strict';

  var platna = document.querySelectorAll('canvas.zar-plocha');
  if (!platna.length) return;

  /* Myš a scroll. Jeden spoločný stav pre všetky plátna na stránke: keby si
     ho každé plátno počítalo samo, pri troch scénach by sme tri razy počúvali
     tú istú udalosť. Hodnoty sa iba zapisujú, dotahujú sa až v kresli().
     Pri dotykovom zariadení myš nie je, tam ostane 0.5 a scéna sa hýbe sama. */
  var MYS = { x: 0.5, y: 0.5, p: 0, z: 0, cx: 0.5, cy: 0.5, cp: 0, cz: 0 };
  /* Kedy naposledy človek naozaj pohol myšou. Podľa toho sa prepína 60 a 30
     snímok za sekundu: plynulosť má zmysel len vtedy, keď svetlo dobieha
     kurzor. Kým myš stojí, scéna sa hýbe tak pomaly, že 30 aj 24 vyzerá
     rovnako, a polovica snímok je ušetrená práca. */
  var poslednyPohyb = -1e9;
  /* Hover na prvku s data-zar-zrychli zrychli tok. Jediny bod, kde UI
     hovori scene, co sa deje, a je zamerne maly.
     forEach sa volá cez Array.prototype: NodeList.prototype.forEach nemá
     Safari 9 ani IE, a tam by to zhodilo celý súbor ešte pred detekciou
     WebGL, takže by sa neukázal ani CSS prechod. */
  var zrychlovace = document.querySelectorAll('[data-zar-zrychli]');
  Array.prototype.forEach.call(zrychlovace, function (el) {
    el.addEventListener('pointerenter', function () { MYS.cz = 1; });
    el.addEventListener('pointerleave', function () { MYS.cz = 0; });
    el.addEventListener('focus', function () { MYS.cz = 1; });
    el.addEventListener('blur', function () { MYS.cz = 0; });
  });
  var jemny = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
  if (jemny) {
    window.addEventListener('pointermove', function (e) {
      MYS.cx = e.clientX / Math.max(1, window.innerWidth);
      MYS.cy = 1 - e.clientY / Math.max(1, window.innerHeight);
      poslednyPohyb = performance.now();
    }, { passive: true });
  }
  window.addEventListener('scroll', function () {
    var v = document.documentElement.scrollHeight - window.innerHeight;
    MYS.cp = v > 0 ? Math.min(1, window.scrollY / v) : 0;
  }, { passive: true });

  /* Dotahovanie k cielu: 8 percent rozdielu za snimok. Pri 30 snimkoch za
     sekundu je to asi tretina sekundy na dobehnutie, co je akurat na to, aby
     to posobilo zivo a nie trhane.
     Do 11. 9. 2026 to bolo vnutri kresli(), teda raz za KAZDE platno. Na
     prehliadke /pozadia/ s desiatimi platnami sa hodnota dotiahla desatkrat
     za snimok, cize svetlo tam dobiehalo myS desatkrat rychlejsie nez na
     hube. Teraz sa to pocita raz za snimok, v slucke. */
  function dotiahni() {
    MYS.x += (MYS.cx - MYS.x) * 0.08;
    MYS.y += (MYS.cy - MYS.y) * 0.08;
    MYS.p += (MYS.cp - MYS.p) * 0.08;
    MYS.z += (MYS.cz - MYS.z) * 0.10;
  }


  var tichy = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Perióda času v shaderi v sekundách. Pozri kresli().
  var PERIODA = 600;
  var VRCHOL = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';

  /* Spoločný základ: šum, fBm, rozptyl, paleta a stlmenie k okrajom.
     Rozptyl (dither) nie je ozdoba. Bez neho sú na tmavom prechode vidieť
     pruhy, lebo osem bitov na kanál nestačí na jemný prechod v tmavých tónoch. */
  // Strop krycej sily shaderu. Mení sa spolu s meraním kontrastu, nie od oka.
  var STROP = '0.66';

  var ZAKLAD = [
    'precision highp float;',
    'uniform vec2 rozmer;',
    'uniform float cas;',
    // Poloha myši v rozsahu 0 az 1 a poloha scrollu, obe uz vyhladene.
    // Scena sa nimi ma len jemne prihnut, nie skakat: preto sa hodnoty
    // dotahuju postupne v kresli() a nie priamo z udalosti.
    'uniform vec2 mys;',
    'uniform float posun;',
    'uniform float zrych;',
    'float sum(vec2 v){ return fract(sin(dot(v, vec2(127.1, 311.7))) * 43758.5453123); }',
    'float hladky(vec2 v){',
    '  vec2 i = floor(v), f = fract(v);',
    '  vec2 u = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(sum(i), sum(i + vec2(1,0)), u.x),',
    '             mix(sum(i + vec2(0,1)), sum(i + vec2(1,1)), u.x), u.y);',
    '}',
    'float fbm(vec2 v){',
    '  float h = 0.0, a = 0.5;',
    '  for (int i = 0; i < 5; i++) { h += a * hladky(v); v = v * 2.03 + 17.3; a *= 0.5; }',
    '  return h;',
    '}',
    'float rozptyl(vec2 s){ return fract(sin(dot(s, vec2(12.9898, 78.233))) * 43758.5453) - 0.5; }',
    // Lacný šum bez sínusu. sum() vyššie volá sin() na každý bod mriežky,
    // čo je na starších integrovaných kartách najdrahšia inštrukcia v celom
    // shaderi. Táto verzia robí to isté tromi násobeniami a dvoma fract:
    // odmerané 11. 9. 2026 na scéne "papier" je s ňou snímok 2,6-krát
    // rýchlejší než s sum(). Staré scény ju zámerne nepoužívajú, aby sa
    // nezmenilo, ako vyzerajú; je tu pre novú sadu.
    'float sumP(vec2 v){',
    '  vec3 q = fract(vec3(v.xyx) * 0.1031);',
    '  q += dot(q, q.yzx + 33.33);',
    '  return fract((q.x + q.y) * q.z);',
    '}',
    'float hladkyP(vec2 v){',
    '  vec2 i = floor(v), f = fract(v);',
    '  vec2 u = f * f * (3.0 - 2.0 * f);',
    '  return mix(mix(sumP(i), sumP(i + vec2(1,0)), u.x),',
    '             mix(sumP(i + vec2(0,1)), sumP(i + vec2(1,1)), u.x), u.y);',
    '}',
    // Tri oktávy, nie päť. Štvrtá a piata oktáva sú na plátne, ktoré je
    // pod textom a rozmazané maskou, pod hranicou viditeľnosti, a stoja
    // 40 percent času snímku. Výsledok sa násobí, aby držal rozsah 0 až 1.
    'float fbmP(vec2 v){',
    '  float h = 0.0, a = 0.5;',
    '  for (int i = 0; i < 3; i++) { h += a * hladkyP(v); v = v * 2.07 + 11.7; a *= 0.5; }',
    '  return h * 1.143;',
    '}',
    // Paleta. Andrej ju zadal 6. 9. 2026 v hodnotách pre CSS, tu sú tie isté
    // prevedene do rozsahu 0 az 1: #FF6A00, #FF3B1F, #FF9F3D.
    // UHLIK je tlmene jadro, z ktoreho sa mieša smerom k svetlu.
    'const vec3 UHLIK  = vec3(0.38, 0.11, 0.04);',
    'const vec3 ZERAZ  = vec3(1.00, 0.231, 0.122);',  // #FF3B1F signal
    'const vec3 OHEN   = vec3(1.00, 0.416, 0.000);',  // #FF6A00 primary
    'const vec3 JANTAR = vec3(1.00, 0.624, 0.239);',  // #FF9F3D accent
    'const vec3 BIELA  = vec3(1.00, 0.96, 0.92);',
    // Stlmenie k okrajom. Bolo priostre: nasobilo nulou presne tam, kde vacsina
    // scen svieti, takze sest z osmich vyzeralo ako cierna plocha. Teraz je to
    // len jemne pritlmenie, nie vypnutie.
    'float utlm(vec2 uv){',
    '  float zvisle = mix(0.30, 1.0, smoothstep(1.02, 0.10, uv.y));',
    '  float okraj  = smoothstep(0.0, 0.22, uv.x) * smoothstep(1.0, 0.78, uv.x);',
    '  return zvisle * mix(0.62, 1.0, okraj);',
    '}',
    'vec4 zloz(vec3 farba, float sila, float mierka){',
    // Strop krycej sily. Nie je odhadnuty od oka: meria sa cez
    // ops/design/kontrast.mjs, ktory odfoti stranku s priehladnymi pismenami
    // a zisti, ako svetly je najsvetlejsi bod pozadia presne pod textom.
    // Drzana hranica je bezny text 6.0 a velky text 4.5 podla WCAG, teda nad
    // normou 4.5 a 3.0. Ked sa strop zdvihne, meranie sa musi zopakovat.
    '  float a = clamp(sila * mierka, 0.0, ' + STROP + ');',
    '  // Rozptyl len tam, kde uz nejake svetlo je. Ked sa pridaval aj do',
    '  // uplnej tmy, videl ho clovek ako zrnenie na prazdnej ploche.',
    '  // Rozptyl musi byt aj v tmavych tonoch, prave tam su pruhy najhorsie.',
    '  // Osem bitov na kanal nestaci na jemny prechod pri nizkych hodnotach.',
    '  a += rozptyl(gl_FragCoord.xy) * 0.016;',
    '  return vec4(farba, clamp(a, 0.0, 1.0));',
    '}',
    '',
  ].join('\n');

  var V = {};

  /* stuhy: tri vodorovné pásy svetla rozvlnené šumom, každý inou rýchlosťou.
     Ostré jadro, mäkký rozptyl. Najvýraznejšia, pre domovskú stránku. */
  V.stuhy = [
    'float stuha(vec2 p, float posun, float rychlost, float hrubka, float vlna){',
    '  float y = posun',
    '          + vlna * (fbm(vec2(p.x * 1.15 + cas * rychlost, posun * 7.0)) - 0.5)',
    '          + vlna * 0.45 * (fbm(vec2(p.x * 2.9 - cas * rychlost * 0.6, posun * 3.0)) - 0.5);',
    '  return pow(hrubka / (abs(p.y - y) + hrubka), 2.6);',
    '}',
    'void main(){',
    '  vec2 uv = gl_FragCoord.xy / rozmer.xy;',
    '  vec2 p = uv; p.x *= rozmer.x / rozmer.y;',
    '  float s1 = stuha(p, 0.62, 0.045, 0.055, 0.42);',
    '  float s2 = stuha(p, 0.48, 0.028, 0.090, 0.55);',
    '  float s3 = stuha(p, 0.74, 0.062, 0.035, 0.30);',
    '  float opar = smoothstep(0.42, 0.95, fbm(p * 1.7 + vec2(cas * 0.016, -cas * 0.011))) * 0.5;',
    '  float jas = s1 * 0.85 + s2 * 0.55 + s3 * 0.70 + opar * 0.35;',
    '  vec3 f = mix(UHLIK, ZERAZ, clamp(jas * 1.5, 0.0, 1.0));',
    '  f = mix(f, JANTAR, clamp(jas * 0.95 - 0.35, 0.0, 1.0));',
    '  f = mix(f, BIELA,  clamp(jas * 0.80 - 0.72, 0.0, 1.0));',
    '  gl_FragColor = zloz(f, clamp(jas, 0.0, 1.0) * utlm(uv), 0.30);',
    '}',
  ].join('\n');

  /* vlny: hladký prelievaný prechod cez dvojité zohnutie súradníc.
     Pokojná, bez kresby. Pre stránky, kde je veľa textu. */
  V.vlny = [
    'void main(){',
    '  vec2 uv = gl_FragCoord.xy / rozmer.xy;',
    '  vec2 p = uv; p.x *= rozmer.x / rozmer.y;',
    '  float t = cas * 0.045;',
    '  vec2 q = vec2(fbm(p * 1.3 + vec2(0.0, t)), fbm(p * 1.3 + vec2(5.2, 1.3 - t)));',
    '  vec2 r = vec2(fbm(p * 1.3 + 2.4 * q + vec2(1.7, 9.2) + 0.18 * t),',
    '                fbm(p * 1.3 + 2.4 * q + vec2(8.3, 2.8) - 0.15 * t));',
    '  float jadro = clamp(length(q) * 1.15 - 0.34, 0.0, 1.0);',
    '  float teplo = clamp(r.x * 1.05 - 0.30, 0.0, 1.0);',
    '  vec3 f = mix(UHLIK, ZERAZ, jadro);',
    '  f = mix(f, JANTAR, teplo * 0.8);',
    '  gl_FragColor = zloz(f, (jadro * 0.9 + teplo * 0.5) * utlm(uv), 0.34);',
    '}',
  ].join('\n');

  /* ─────────────────── scény podľa Andrejovho výberu, 6. 9. 2026 ───────────────────
     Vybral si: particle flow, wireframe mesh, dark particles, smoke flow, light streaks.
     Sú písané tak, aby boli výrazne svetlejšie než pôvodná sada, a pritom aby text
     nad nimi držal kontrast. Overuje sa to meraním, nie okom. */

  /* papier: tmavý list papiera a jedno teplé svetlo, ktoré ide cezeň.
   *
   * Andrej 11. 9. 2026: „krajšie a efektnejšie a efektívnejšie WebGL".
   * Predchodca na úvode hubu (particle flow, nižšie ako `castice`) sypal
   * po celej ploche oranžové bodky vrátane miesta pod nadpisom. Namerané
   * 11. 9. 2026: v najhoršom bode pod nadpisom kontrast 4,76 a pod riadkom
   * „Vyberte si svoj problém" 2,20. Vyzeralo to ako konfety, nie ako značka.
   *
   * Táto scéna je postavená opačne: NIČ sa nehýbe rýchlo, nič nebliká a celá
   * kresba je jedno gesto. Dve vrstvy pomalého šumu (druhá je prehnutá prvou,
   * z čoho vznikne vlákno papiera), jeden zdroj svetla, ktorý dobieha myš,
   * a jemné zrno, ktoré stojí v obraze, lebo papier sa nehýbe.
   *
   * Svetlo má pokojové miesto vysoko vpravo, nad nadpisom, a myš ním smie
   * hýbať len v páse, ktorý sa nadpisu nedotkne. Preto drží kontrast aj
   * v najhoršom bode, nielen v priemere.
   *
   * Farby: základ ostáva tmavý (#0b0a09 pod plátnom), oranžová #f2643c len
   * ako svetlo, krémová #f6f4ef len v stopách v jadre. Žiadna dúha.
   */
  V.papier = [
    'const vec3 KREM = vec3(0.965, 0.957, 0.937);',  // #f6f4ef
    // Kde svetlo vôbec smie byť. Hore plno, dole potichu (dole CSS maska
    // plátno aj tak vytráca), vľavo menej, lebo odtiaľ sa začína čítať.
    'float papierTvar(vec2 uv){',
    // Dole potichu: tam CSS maska plátno aj tak vytráca.
    '  float zdola = smoothstep(-0.06, 0.52, uv.y);',
    // Hore tiež potichu, inak svetlo presvitá cez priehľadnú hlavičku
    // a odkazy v nej stoja na svetlom podklade.
    '  float zhora = smoothstep(1.02, 0.78, uv.y);',
    // Vľavo menej, lebo odtiaľ sa začína čítať.
    '  float vodorovne = mix(0.30, 1.0, smoothstep(0.04, 0.76, uv.x));',
    // Pravý horný roh patrí hlavičke: navigácia a výber jazyka. Rozbalená
    // ponuka jazykov má polopriehľadné pozadie (var(--card) je rgba .55),
    // takže svetlo spod nej sa číta ako podklad textu. Odmerané 11. 9. 2026
    // cez ops/design/kontrast.mjs: bez tejto clony mal riadok „English"
    // kontrast 3,19, čo je pod normou 4,5; s ňou je nad cieľom 7.
    '  float clona = 1.0 - 0.62 * smoothstep(0.58, 0.84, uv.y) * smoothstep(0.66, 0.88, uv.x);',
    '  return mix(0.20, 1.0, zdola) * zhora * vodorovne * clona;',
    '}',
    'void main(){',
    '  vec2 uv = gl_FragCoord.xy / rozmer.xy;',
    '  float pomer = rozmer.x / rozmer.y;',
    '  vec2 p = vec2((uv.x - 0.5) * pomer, uv.y - 0.5);',
    // Pomaly. Jeden obeh šumu trvá vyše minúty, takže pri letmom pohľade
    // scéna stojí a pri dlhšom sa nenápadne mení. To je celý zámer.
    '  float t = cas * 0.013;',
    // Šum roztiahnutý do šírky: papier má smer vlákien, nie náhodné škvrny.
    '  float n1 = fbmP(p * vec2(0.85, 1.90) + vec2(t, -t * 0.50));',
    '  float zavoj = fbmP(p * vec2(1.35, 3.10) + vec2(n1 * 1.25 - t * 0.30, n1 * 0.90 + 3.7));',
    // Jeden zdroj svetla. mys je už vyhladená v dotiahni(), takže svetlo
    // kurzor dobieha asi tretinu sekundy a nikdy neskáče.
    '  vec2 stred = vec2(0.66 + (mys.x - 0.5) * 0.30, 0.78 + (mys.y - 0.5) * 0.16);',
    '  vec2 zdroj = vec2((stred.x - 0.5) * pomer, stred.y - 0.5);',
    // Široké a nízke, aby to bolo svetlo rezajúce cez papier, nie gulička.
    // Na úzkom plátne (telefón) je zvislá zložka stiahnutá viac: text je
    // tam od svetla rovnako ďaleko v pomere k výške, ale zaberá skoro celú
    // šírku, takže sa mu svetlo nemá ako vyhnúť do strany. Bez toho vyšiel
    // 11. 9. 2026 na 390 px kontrast nadpisu v najhoršom bode 6,77.
    '  float uzke = max(0.0, 1.20 - pomer) * 0.90;',
    '  vec2 r = (p - zdroj) * vec2(0.58, 1.85 + uzke);',
    '  float d = length(r) + (zavoj - 0.5) * 0.20;',
    '  float halo = exp(-max(d, 0.0) * 2.05);',
    '  float jadro = exp(-d * d * 20.0);',
    '  float svit = halo * 0.70 + jadro * 0.48;',
    // Pomalý dych, aby scéna nikdy nestála ani vtedy, keď myš nie je.
    '  svit *= 0.90 + 0.10 * sin(cas * 0.085);',
    // Vlákna papiera svetlo lámu: kde je papier hustejší, prejde menej.
    '  svit *= 0.45 + 0.85 * zavoj;',
    '  float tvar = papierTvar(uv);',
    '  svit *= tvar;',
    // Zrno papiera. Stojí v obraze, nie v scéne, lebo papier sa nehýbe.
    // Násobí sa, takže v tme nie je vidieť a nevznikne z neho šumiaca plocha.
    '  svit *= 1.0 + (sumP(floor(gl_FragCoord.xy * 0.8) + 11.3) - 0.5) * 0.20;',
    '  svit = clamp(svit, 0.0, 1.0);',
    // Krivka krycej sily. Prvý pokus 11. 9. 2026 kryl lineárne a aj najslabší
    // chvost svetla mal dosť sily na to, aby z neho bola hnedá škvrna cez pol
    // úvodu. Mocnina chvost stlmí a jadro nechá.
    '  float alfa = pow(svit, 1.70);',
    '  float stopa = clamp(jadro * (0.30 + 0.70 * zavoj) * tvar, 0.0, 1.0);',
    '  vec3 f = mix(UHLIK, OHEN, clamp(svit * 1.70, 0.0, 1.0));',
    '  f = mix(f, JANTAR, clamp(svit * 1.15 - 0.38, 0.0, 1.0));',
    '  f = mix(f, KREM, clamp(stopa * 0.85 - 0.36, 0.0, 1.0));',
    '  gl_FragColor = zloz(f, alfa, 0.64);',
    '}',
  ].join('\n');

  /* castice: particle flow. Pole svetelných bodov, ktoré tečie po smere zo šumu.
     Body sa nekreslia z bufferu, ale počítajú sa priamo v pixeli: pre každý pixel
     sa pozrieme na deväť okolitých buniek mriežky a v každej je jedna častica.
     Je to lacnejšie než skutočný časticový systém a nepotrebuje to knižnicu.
     Do 11. 9. 2026 sa volala `tok` a bola na úvode hubu; pozri V.papier. */
  V.castice = [
    'void main(){',
    '  vec2 uv = gl_FragCoord.xy / rozmer.xy;',
    '  vec2 p = uv; p.x *= rozmer.x / rozmer.y;',
    // jeden fbm na pixel určí smer toku, častice sa potom posúvajú po ňom
    '  float smerUhol = fbm(p * 0.85 + vec2(cas * 0.010, -cas * 0.006)) * 6.2831 + (mys.x - 0.5) * 0.9;',
    '  vec2 smer = vec2(cos(smerUhol), sin(smerUhol));',
    '  float jas = 0.0;',
    '  float ostry = 0.0;',
    '  for (int i = 0; i < 2; i++) {',
    '    float vrstva = float(i);',
    '    float husto = 17.0 + vrstva * 13.0;',
    '    vec2 q = (p - smer * (cas * 0.022 + vrstva * 0.004)) * husto;',
    '    vec2 b = floor(q);',
    '    for (int dy = -1; dy <= 1; dy++) {',
    '      for (int dx = -1; dx <= 1; dx++) {',
    '        vec2 c = b + vec2(float(dx), float(dy));',
    '        float h  = sum(c + vrstva * 41.3);',
    '        float h2 = sum(c + vrstva * 13.1 + 7.7);',
    '        vec2 stred = c + vec2(h, h2);',
    '        float d = length(q - stred);',
    '        float sila = 0.3 + 0.7 * h;',
    '        jas   += (0.0070 / (d * d + 0.0020)) * sila;',
    '        ostry += (0.0026 / (d * d + 0.00026)) * sila;',
    '      }',
    '    }',
    '  }',
    // tok je hustejší v strede pásu, ktorý ide zľava dole doprava hore
    '  float pas = 1.0 - smoothstep(0.0, 0.34, abs((uv.y - 0.13) - (uv.x - 0.5) * 0.20));',
    '  jas *= 0.22 + 1.05 * pas;',
    '  ostry *= 0.15 + 1.30 * pas;',
    '  vec3 f = mix(UHLIK, ZERAZ, clamp(jas * 1.5, 0.0, 1.0));',
    '  f = mix(f, OHEN,   clamp(jas * 1.05 - 0.22, 0.0, 1.0));',
    '  f = mix(f, JANTAR, clamp(ostry * 0.9 - 0.10, 0.0, 1.0));',
    '  f = mix(f, BIELA,  clamp(ostry * 0.7 - 0.55, 0.0, 1.0));',
    '  gl_FragColor = zloz(f, clamp(jas + ostry * 0.8, 0.0, 1.4) * utlm(uv), 0.38);',
    '}',
  ].join('\n');

  /* `tok` ukazuje na `papier`.
     Úvod hubu nesie data-zar="tok" priamo v index.html a ten súbor sa v tomto
     kroku nesmel otvoriť (visia na ňom hashe v CSP). Preto sa meno presmeruje
     tu. Keď sa index.html a /pozadia/ prepíšu na data-zar="papier", tento
     riadok môže zmiznúť a `tok` sa môže vrátiť na `castice` alebo odísť. */
  V.tok = V.papier;

  /* mriezka: wireframe mesh. Mriežka v perspektíve, ktorá sa vlní ako krajina
     a uteká k horizontu. Čiary sa smerom do diaľky zahusťujú, preto sa hrúbka
     čiary škáluje hĺbkou, inak by sa pri horizonte zliali do plochy. */
  V.mriezka = [
    'void main(){',
    '  vec2 uv = gl_FragCoord.xy / rozmer.xy;',
    '  float horizont = 0.68;',
    '  float podHorizontom = horizont - uv.y;',
    // pod horizontom je zem, nad ním nič; smoothstep drží mäkký prechod
    '  float zem = smoothstep(0.0, 0.03, podHorizontom);',
    '  float hlbka = 0.14 / max(podHorizontom, 0.004);',
    '  vec2 p = vec2((uv.x - 0.5 + (mys.x - 0.5) * 0.10) * hlbka * 2.2, hlbka - cas * 0.30 - posun * 6.0);',
    '  float vyska = (fbm(p * 0.32 + vec2(0.0, cas * 0.02)) - 0.5) * 0.9;',
    '  vec2 g = p + vec2(0.0, vyska * 0.5);',
    '  vec2 f2 = abs(fract(g) - 0.5);',
    // hrúbka čiary rastie s hĺbkou, aby sa vzdialené čiary nezliali
    '  float hrubka = 0.020 + 0.055 / (1.0 + hlbka * 0.55);',
    '  float ciara = 1.0 - smoothstep(0.0, hrubka, min(f2.x, f2.y));',
    '  float uzol  = 1.0 - smoothstep(0.0, hrubka * 2.2, length(f2));',
    // hrebene krajiny svietia viac než údolia
    '  float hreben = smoothstep(-0.05, 0.42, vyska);',
    '  float dohlad = smoothstep(9.0, 0.6, hlbka);',
    '  float jas = (ciara * 0.85 + uzol * 0.9) * (0.30 + 0.85 * hreben) * dohlad * zem;',
    '  vec3 f = mix(UHLIK, ZERAZ, clamp(jas * 1.6, 0.0, 1.0));',
    '  f = mix(f, OHEN,   clamp(jas * 1.2 - 0.30, 0.0, 1.0));',
    '  f = mix(f, JANTAR, clamp(uzol * hreben * dohlad * 1.3 - 0.35, 0.0, 1.0));',
    // slabá žiara pri horizonte, aby scéna nekončila ostrou hranou
    '  float zaria = smoothstep(0.10, 0.0, abs(podHorizontom)) * 0.35;',
    '  f = mix(f, OHEN, zaria);',
    '  gl_FragColor = zloz(f, clamp(jas + zaria * 0.7, 0.0, 1.3) * utlm(uv), 0.44);',
    '}',
  ].join('\n');

  /* iskry: dark particles. Prevažne tmavá plocha, po ktorej stúpajú ojedinelé
     žeravé body. Najtmavšia zo sady, takže znesie najviac textu nad sebou. */
  V.iskry = [
    'void main(){',
    '  vec2 uv = gl_FragCoord.xy / rozmer.xy;',
    '  vec2 p = uv; p.x *= rozmer.x / rozmer.y;',
    '  float jas = 0.0;',
    '  float jadro = 0.0;',
    '  for (int i = 0; i < 3; i++) {',
    '    float vrstva = float(i);',
    '    float husto = 6.0 + vrstva * 5.0;',
    '    float rychlost = 0.030 + vrstva * 0.016;',
    '    vec2 q = (p + vec2(0.0, -cas * rychlost)) * husto;',
    '    vec2 b = floor(q);',
    '    for (int dy = -1; dy <= 1; dy++) {',
    '      for (int dx = -1; dx <= 1; dx++) {',
    '        vec2 c = b + vec2(float(dx), float(dy));',
    '        float h  = sum(c + vrstva * 27.4);',
    '        float h2 = sum(c + vrstva * 9.3 + 3.1);',
    // iskrí len časť buniek, inak by to bola rovnomerná mriežka bodiek
    '        float ziva = step(0.62, h2);',
    '        vec2 stred = c + vec2(h, h2) + vec2(sin(cas * 0.5 + h * 20.0) * 0.12, 0.0);',
    '        float d = length(q - stred);',
    '        float blik = 0.45 + 0.55 * sin(cas * (0.6 + h) + h2 * 30.0);',
    '        jas   += (0.010 / (d * d + 0.0030)) * ziva * blik;',
    '        jadro += (0.0022 / (d * d + 0.00022)) * ziva * blik;',
    '      }',
    '    }',
    '  }',
    // teplý opar pri spodnej hrane, akoby zdroj žiaru bol pod obrazom
    '  float opar = smoothstep(0.55, -0.05, uv.y) * 0.22 * (0.6 + 0.4 * fbm(p * 1.6 + vec2(cas * 0.02, 0.0)));',
    '  vec3 f = mix(UHLIK, ZERAZ, clamp((jas + opar) * 1.7, 0.0, 1.0));',
    '  f = mix(f, OHEN,   clamp(jadro * 1.1 - 0.06, 0.0, 1.0));',
    '  f = mix(f, JANTAR, clamp(jadro * 0.9 - 0.42, 0.0, 1.0));',
    '  f = mix(f, BIELA,  clamp(jadro * 0.6 - 0.80, 0.0, 1.0));',
    '  gl_FragColor = zloz(f, clamp(jas + jadro * 0.8 + opar, 0.0, 1.3) * utlm(uv), 0.46);',
    '}',
  ].join('\n');

  /* dym: smoke flow. Stuhy hustého dymu presvietené zospodu. Nie je to
     fotorealistický dym, na to by bolo treba objemové vzorkovanie; je to
     dvojnásobne skrútený fbm, čo dá podobný pocit za zlomok ceny. */
  V.dym = [
    'void main(){',
    '  vec2 uv = gl_FragCoord.xy / rozmer.xy;',
    '  vec2 p = uv; p.x *= rozmer.x / rozmer.y;',
    // prvé skrútenie: kam sa má pole ohnúť
    '  vec2 q = vec2(fbm(p * 1.1 + vec2(0.0, cas * 0.026)),',
    '                fbm(p * 1.1 + vec2(4.7, -cas * 0.021) + 3.2));',
    // druhé skrútenie: až toto dá dymu jeho charakteristické chvosty
    '  vec2 r = vec2(fbm(p * 1.5 + 3.4 * q + vec2(1.7, 9.2) + cas * 0.014),',
    '                fbm(p * 1.5 + 3.4 * q + vec2(8.3, 2.8) - cas * 0.011));',
    '  float hustota = fbm(p * 1.9 + 2.6 * r);',
    // stuha: úzky pás okolo diagonály, kde je dym najhustejší
    '  float os = (uv.y - 0.42 - (mys.y - 0.5) * 0.10) - (uv.x - 0.5) * 0.42 + (r.x - 0.5) * 0.30;',
    '  float stuha = exp(-abs(os) * 5.2);',
    '  float jas = pow(clamp(hustota, 0.0, 1.0), 1.5) * stuha;',
    // presvietenie: tam, kde je dym tenší, presvitá viac svetla
    '  float presvit = pow(stuha, 2.6) * smoothstep(0.30, 0.85, hustota);',
    '  vec3 f = mix(UHLIK, ZERAZ, clamp(jas * 2.0, 0.0, 1.0));',
    '  f = mix(f, OHEN,   clamp(jas * 1.5 - 0.25, 0.0, 1.0));',
    '  f = mix(f, JANTAR, clamp(presvit * 1.4 - 0.20, 0.0, 1.0));',
    '  f = mix(f, BIELA,  clamp(presvit * 1.0 - 0.62, 0.0, 1.0));',
    '  gl_FragColor = zloz(f, clamp(jas * 1.2 + presvit * 0.8, 0.0, 1.3) * utlm(uv), 0.42);',
    '}',
  ].join('\n');

  /* pruhy: light streaks. Rýchle svetelné ťahy naprieč obrazom. Najdynamickejšia
     scéna, preto má najužší pás: mimo neho musí ostať miesto na text. */
  V.pruhy = [
    'void main(){',
    '  vec2 uv = gl_FragCoord.xy / rozmer.xy;',
    '  vec2 p = uv; p.x *= rozmer.x / rozmer.y;',
    // otočenie súradníc, aby ťahy šli šikmo
    '  float uhol = -0.42 + (mys.y - 0.5) * 0.16;',
    '  vec2 o = vec2(p.x * cos(uhol) - p.y * sin(uhol), p.x * sin(uhol) + p.y * cos(uhol));',
    '  float jas = 0.0;',
    '  float jadro = 0.0;',
    '  for (int i = 0; i < 7; i++) {',
    '    float k = float(i);',
    '    float h = sum(vec2(k * 3.7, 1.3));',
    '    float h2 = sum(vec2(k * 8.1, 5.9));',
    // každý ťah má vlastnú polohu, hrúbku a rýchlosť
    '    float poloha = 0.16 + h * 0.72 + sin(cas * (0.05 + h2 * 0.05) + k) * 0.06;',
    '    float d = abs(o.y - poloha);',
    '    float hrubka = 0.006 + h2 * 0.016;',
    '    float pas = hrubka / (d + hrubka * 0.9);',
    // pozdĺžna modulácia, aby ťah nebol rovnomerný, ale mal svetlé miesta
    '    float pozdlz = 0.35 + 0.65 * fbm(vec2(o.x * 2.6 - cas * (0.30 + h * 0.35), k * 4.0));',
    '    jas   += pow(pas, 1.6) * pozdlz * (0.5 + 0.5 * h);',
    '    jadro += pow(pas, 5.0) * pozdlz;',
    '  }',
    '  vec3 f = mix(UHLIK, ZERAZ, clamp(jas * 1.4, 0.0, 1.0));',
    '  f = mix(f, OHEN,   clamp(jas * 1.1 - 0.25, 0.0, 1.0));',
    '  f = mix(f, JANTAR, clamp(jadro * 1.2 - 0.10, 0.0, 1.0));',
    '  f = mix(f, BIELA,  clamp(jadro * 0.9 - 0.45, 0.0, 1.0));',
    '  gl_FragColor = zloz(f, clamp(jas * 0.9 + jadro * 0.7, 0.0, 1.3) * utlm(uv), 0.40);',
    '}',
  ].join('\n');

  /* horizont: tmavá pláň a za ňou obrovské mäkké svetlo, ktoré vychádza.
     Najtichšia a najprémiovejšia scéna zo sady. Znesie nad sebou najviac
     textu, lebo celá horná polovica je takmer čierna a svetlo je dole.
     Myš posúva zdroj svetla do strán, scroll ho dvíha a stmieva. */
  V.horizont = [
    'void main(){',
    '  vec2 uv = gl_FragCoord.xy / rozmer.xy;',
    '  float pomer = rozmer.x / rozmer.y;',
    '  vec2 p = vec2((uv.x - 0.5) * pomer, uv.y);',
    // hrana pláne je mierne vypuklá, ako okraj veľkého telesa
    '  float ohyb = 0.030 + 0.010 * sin(cas * 0.06);',
    '  float x2 = (uv.x - 0.5) * 2.0;',
    '  float hy = 0.30 - ohyb * (x2 * x2);',
    // zdroj svetla tesne za hranou; myš ho posúva, scroll dvíha
    '  float posunX = (mys.x - 0.5) * 0.34 * pomer;',
    '  vec2 zdroj = vec2(posunX, hy + 0.004 + posun * 0.06);',
    '  float d = length((p - zdroj) * vec2(1.0, 1.55));',
    '  float jadro = pow(0.050 / (d + 0.050), 2.7);',
    '  float halo  = pow(0.30  / (d + 0.30),  1.9) * 0.62;',
    '  float zar = jadro + halo;',
    // pomalý dych, aby scéna nikdy nestála
    '  zar *= 0.86 + 0.14 * sin(cas * 0.33);',
    // jemné závoje pred svetlom, aby to nebol čistý matematický kruh
    '  float zavoj = fbm(vec2(p.x * 2.2 + cas * 0.02, (uv.y - hy) * 3.4 - cas * 0.03));',
    '  zar *= 0.80 + 0.40 * zavoj;',
    // pláň pod hranou svetlo takmer pohltí
    '  float plan = smoothstep(hy + 0.003, hy - 0.003, uv.y);',
    '  zar *= mix(1.0, 0.10, plan);',
    // úzky lem presne na hrane, to je to, čo dáva scéne tvar
    '  float lem = exp(-abs(uv.y - hy) * 190.0) * smoothstep(1.1, 0.0, abs(p.x - zdroj.x) * 1.35);',
    '  float sila = zar + lem * 0.85;',
    '  vec3 f = mix(UHLIK, ZERAZ, clamp(sila * 1.5, 0.0, 1.0));',
    '  f = mix(f, OHEN,   clamp(sila * 1.15 - 0.20, 0.0, 1.0));',
    '  f = mix(f, JANTAR, clamp(sila * 0.95 - 0.55, 0.0, 1.0));',
    '  f = mix(f, BIELA,  clamp(sila * 0.85 - 0.95, 0.0, 1.0));',
    '  gl_FragColor = zloz(f, clamp(sila, 0.0, 1.4) * utlm(uv), 0.52);',
    '}',
  ].join('\n');

  /* sopka: čierny digitálny masív, cez ktorý tečie energia.
     Nie je to hora s lávou. Je to tmavá silueta, po ktorej steká jeden
     hlavný svetelný tok a nad ňou stúpajú iskry. Jedno gesto, nie päťdesiat
     efektov. Myš tok jemne vychýli, scroll ho zrýchli. */
  V.sopka = [
    'void main(){',
    '  vec2 uv = gl_FragCoord.xy / rozmer.xy;',
    '  float pomer = rozmer.x / rozmer.y;',
    '  vec2 p = vec2((uv.x - 0.5) * pomer, uv.y);',
    // silueta masívu: široký hrebeň zo šumu plus jeden vrchol
    '  float sum1 = fbm(vec2(uv.x * 2.1 + 4.0, 1.7));',
    '  float sum2 = fbm(vec2(uv.x * 5.4 + 9.0, 5.1));',
    '  float vrchol = 0.30 * exp(-pow((uv.x - 0.62) * 3.1, 2.0));',
    '  float hreben = 0.16 + 0.16 * sum1 + 0.06 * sum2 + vrchol;',
    '  float masiv = smoothstep(hreben + 0.006, hreben - 0.006, uv.y);',
    // hlavný tok: krivka, ktorá ide od vrcholu dolava dole
    '  float vych = (mys.x - 0.5) * 0.22;',
    '  float drahaX = 0.62 + vych - (hreben - uv.y) * 1.15;',
    '  float sirka = 0.020 + 0.075 * clamp((hreben - uv.y) * 2.2, 0.0, 1.0);',
    '  float odDrahy = abs(p.x - (drahaX - 0.5) * pomer);',
    '  float tok = sirka / (odDrahy + sirka * 0.85);',
    // tečie: pozdĺžna modulácia posúvaná časom a scrollom
    '  float rychlost = 0.16 + posun * 0.25;',
    '  float pozdlz = 0.35 + 0.65 * fbm(vec2(uv.x * 3.0, (uv.y * 4.0) + cas * rychlost));',
    '  float prud = pow(tok, 1.7) * pozdlz * masiv;',
    '  float jadroToku = pow(tok, 5.0) * pozdlz * masiv;',
    // žiara nad vrcholom, akoby z neho vychádzalo teplo
    '  float nadVrcholom = smoothstep(0.0, 0.34, uv.y - hreben) * smoothstep(0.9, 0.0, abs(uv.x - 0.62) * 2.6);',
    '  float teplo = (1.0 - nadVrcholom) * smoothstep(-0.02, 0.16, uv.y - hreben) * 0.42;',
    // iskry stúpajúce nad masívom
    '  float iskra = 0.0;',
    '  vec2 q = (p + vec2(0.0, -cas * 0.045)) * 9.0;',
    '  vec2 b = floor(q);',
    '  for (int dy = -1; dy <= 1; dy++) {',
    '    for (int dx = -1; dx <= 1; dx++) {',
    '      vec2 c = b + vec2(float(dx), float(dy));',
    '      float h = sum(c), h2 = sum(c + 6.3);',
    '      float ziva = step(0.72, h2) * (1.0 - masiv);',
    '      float dd = length(q - (c + vec2(h, h2)));',
    '      iskra += (0.0030 / (dd * dd + 0.0009)) * ziva * (0.4 + 0.6 * sin(cas * 0.8 + h * 25.0));',
    '    }',
    '  }',
    '  float sila = prud + teplo + iskra;',
    '  vec3 f = mix(UHLIK, ZERAZ, clamp(sila * 1.6, 0.0, 1.0));',
    '  f = mix(f, OHEN,   clamp(prud * 1.3 + teplo * 0.8 - 0.18, 0.0, 1.0));',
    '  f = mix(f, JANTAR, clamp(jadroToku * 1.2 + iskra * 0.8 - 0.20, 0.0, 1.0));',
    '  f = mix(f, BIELA,  clamp(jadroToku * 0.9 - 0.60, 0.0, 1.0));',
    // samotný kameň je takmer čierny, nie hnedý
    '  f = mix(f, vec3(0.02, 0.018, 0.022), masiv * (1.0 - clamp(prud * 2.2, 0.0, 1.0)) * 0.55);',
    '  gl_FragColor = zloz(f, clamp(sila + jadroToku * 0.6, 0.0, 1.4) * utlm(uv), 0.46);',
    '}',
  ].join('\n');

  /* hora: obrovska rieka castic a za nou tmava silueta masivu.

     Prve dva pokusy stavali horu ako hlavny objekt a tok ako tenku ciaru.
     Na predlohe je to obratene: rieka zabera dve tretiny plochy, svieti
     a hora je len tmavy tvar za nou. Preto sa scena kresli 2D. Raymarching
     by rieku takto ovladat nedokazal a stal by desatnasobok.

     Rieka ma tri vrstvy: siroky tlmeny opar, hustu masu castic a ostre
     jadro. Kazda ma inu rychlost, z coho vznikne dojem hlbky.

     Vlavo, kde je nadpis, sa cela scena plynulo vytrati. */
  V.hora = [
    'float osRieky(float x, float ohyb){',
    '  return 0.26 + 0.30 * x + 0.150 * sin(x * 2.6 - 0.35) + ohyb;',
    '}',
    'float hreben(float x){',
    '  float h = 0.24 + 0.13 * fbm(vec2(x * 2.4, 3.1));',
    '  h += 0.44 * exp(-pow((x - 0.72) * 3.0, 2.0));',
    '  h += 0.16 * exp(-pow((x - 0.44) * 5.0, 2.0));',
    '  h += 0.12 * exp(-pow((x - 0.94) * 4.4, 2.0));',
    '  return h;',
    '}',
    'void main(){',
    '  vec2 uv = gl_FragCoord.xy / rozmer.xy;',
    '  float pomer = rozmer.x / rozmer.y;',
    '  float ohyb = (mys.y - 0.5) * 0.10;',
    '  float rych = 0.30 + zrych * 0.85 + posun * 0.20;',
    '  float hy = hreben(uv.x);',
    '  float masiv = smoothstep(hy + 0.004, hy - 0.004, uv.y);',
    '  float nadHrebenom = smoothstep(0.0, 0.30, uv.y - hy);',
    '  vec3 farba = mix(vec3(0.075, 0.052, 0.048), vec3(0.014, 0.014, 0.019), nadHrebenom);',
    '  farba = mix(farba, vec3(0.008, 0.007, 0.010), masiv);',
    '  float os = osRieky(uv.x, ohyb);',
    '  float d = (uv.y - os);',
    '  float sirka = 0.032 + 0.085 * smoothstep(0.05, 0.95, uv.x);',
    '  float pas = exp(-pow(d / sirka, 2.0));',
    '  float opar = exp(-pow(d / (sirka * 2.0), 2.0));',
    '  opar *= 0.55 + 0.45 * fbm(vec2(uv.x * 3.0 - cas * rych * 0.35, uv.y * 4.0 + cas * 0.05));',
    '  float castice = 0.0;',
    '  float ostre = 0.0;',
    '  for (int L = 0; L < 3; L++) {',
    '    float vr = float(L);',
    '    float husto = 26.0 + vr * 20.0;',
    '    float posunV = cas * rych * (0.55 + vr * 0.35);',
    '    vec2 q = vec2((uv.x * pomer - posunV) * husto, (d / sirka) * 6.5 + vr * 11.0);',
    '    vec2 b = floor(q);',
    '    for (int dy = -1; dy <= 1; dy++) {',
    '      for (int dx = -1; dx <= 1; dx++) {',
    '        vec2 c = b + vec2(float(dx), float(dy));',
    '        float h1 = sum(c + vr * 31.7);',
    '        float h2 = sum(c + vr * 7.3 + 4.9);',
    '        float dd = length(q - (c + vec2(h1, h2)));',
    '        float s1 = 0.3 + 0.7 * h1;',
    '        castice += (0.020 / (dd * dd + 0.030)) * s1;',
    '        ostre   += (0.0026 / (dd * dd + 0.0016)) * s1;',
    '      }',
    '    }',
    '  }',
    '  castice *= pas;',
    '  ostre *= pas * pas;',
    '  float jadro = exp(-pow(d / (sirka * 0.34), 2.0));',
    '  jadro *= 0.45 + 0.55 * fbm(vec2(uv.x * 5.5 - cas * rych * 0.9, 2.0));',
    '  float sila = opar * 0.18 + castice * 0.46 + jadro * 0.80 + ostre * 0.34;',
    '  vec3 svetlo = mix(UHLIK, ZERAZ, clamp(sila * 2.2, 0.0, 1.0));',
    '  svetlo = mix(svetlo, OHEN, clamp(sila * 1.7 - 0.22, 0.0, 1.0));',
    '  svetlo = mix(svetlo, JANTAR, clamp((jadro * 1.2 + ostre * 0.9) - 0.30, 0.0, 1.0));',
    '  svetlo = mix(svetlo, BIELA, clamp((jadro * 1.1 + ostre * 0.8) - 0.78, 0.0, 1.0));',
    '  farba += svetlo * sila * 1.35;',
    '  farba += OHEN * masiv * pas * 0.22;',
    '  float miesto = 0.02 + 0.98 * smoothstep(0.34, 0.76, uv.x);',
    '  miesto *= 1.0 - 0.55 * smoothstep(0.62, 0.98, uv.y);',
    '  float alfa = clamp(sila * 2.1 + masiv * 0.80 + (1.0 - nadHrebenom) * 0.28, 0.0, 1.0) * miesto;',
    '  alfa += rozptyl(gl_FragCoord.xy) * 0.012;',
    '  gl_FragColor = vec4(farba, clamp(alfa, 0.0, 0.97));',
    '}',
  ].join('\n');



  /* siet: jemná mriežka, ktorá sa vlní ako plachta a v uzloch svieti.
     Technická, ale nie chladná. Pre nástroje a dokumentáciu. */
  V.siet = [
    'void main(){',
    '  vec2 uv = gl_FragCoord.xy / rozmer.xy;',
    '  vec2 p = uv; p.x *= rozmer.x / rozmer.y;',
    '  float vlna = (fbm(p * 1.4 + vec2(cas * 0.020, cas * 0.014)) - 0.5) * 0.22;',
    '  vec2 g = (p + vec2(vlna, vlna * 0.6)) * 15.0;',
    '  vec2 f2 = abs(fract(g) - 0.5);',
    '  float ciara = 1.0 - smoothstep(0.0, 0.055, min(f2.x, f2.y));',
    '  float uzol = 1.0 - smoothstep(0.0, 0.11, length(f2));',
    '  float zivot = smoothstep(0.35, 0.92, fbm(p * 1.1 + vec2(-cas * 0.017, cas * 0.011)));',
    '  float jas = (ciara * 0.30 + uzol * 0.95) * zivot;',
    '  vec3 c = mix(UHLIK, ZERAZ, clamp(jas * 1.4, 0.0, 1.0));',
    '  c = mix(c, JANTAR, clamp(uzol * zivot * 1.2 - 0.25, 0.0, 1.0));',
    '  gl_FragColor = zloz(c, jas * 1.0 * utlm(uv), 0.46);',
    '}',
  ].join('\n');

  window.ArlingZiara = { varianty: Object.keys(V) };

  // ── jedna scéna = jedno plátno so svojím programom ─────────────────────────
  var sceny = [];

  function postavScenu(plocha) {
    var gl = null;
    try {
      // preserveDrawingBuffer je tu nutnosť, nie prepych. Bez neho prehliadač
      // po zložení snímku plátno vymaže, takže scéna, ktorá práve nekreslí
      // (odscrollovaná, skrytá karta), zčernie. Cena je o kúsok pomalšie
      // skladanie, zisk je, že posledný snímok ostane visieť.
      var nast = { alpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: true, powerPreference: 'low-power' };
      gl = plocha.getContext('webgl2', nast) || plocha.getContext('webgl', nast);
    } catch (e) { gl = null; }
    if (!gl) { plocha.remove(); return null; }

    var nazov = (plocha.getAttribute('data-zar') || 'stuhy').toLowerCase();
    var telo = V[nazov] || V.stuhy;

    function shader(typ, zdroj) {
      var sh = gl.createShader(typ);
      gl.shaderSource(sh, zdroj);
      gl.compileShader(sh);
      return gl.getShaderParameter(sh, gl.COMPILE_STATUS) ? sh : null;
    }
    var vs = shader(gl.VERTEX_SHADER, VRCHOL);
    var fs = shader(gl.FRAGMENT_SHADER, ZAKLAD + telo);
    if (!vs || !fs) { plocha.remove(); return null; }

    var program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { plocha.remove(); return null; }
    gl.useProgram(program);

    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(program, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    var uRozmer = gl.getUniformLocation(program, 'rozmer');
    var uCas = gl.getUniformLocation(program, 'cas');
    var uMys = gl.getUniformLocation(program, 'mys');
    var uPosun = gl.getUniformLocation(program, 'posun');
    var uZrych = gl.getUniformLocation(program, 'zrych');
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    var s = {
      plocha: plocha, nazov: nazov, vidno: false, zaciatok: null,
      rozmer: function () {
        var r = plocha.getBoundingClientRect();
        // 1.25 na úzkych obrazovkách: pri 1.0 sa jemné detaily scény strácajú
        // a pozadie vyzerá ako prázdna plocha. Vyššie by už len hrialo batériu.
        var hustota = Math.min(window.devicePixelRatio || 1, r.width < 720 ? 1.25 : 1.5);
        var w = Math.max(1, Math.round(r.width * hustota));
        var h = Math.max(1, Math.round(r.height * hustota));
        if (plocha.width !== w || plocha.height !== h) {
          plocha.width = w; plocha.height = h;
          gl.viewport(0, 0, w, h);
        }
        gl.useProgram(program);
        gl.uniform2f(uRozmer, plocha.width, plocha.height);
      },
      kresli: function (teraz) {
        if (s.zaciatok === null) s.zaciatok = teraz;
        // Platno sa MUSI pred kazdym snimkom vymazat. S preserveDrawingBuffer
        // a zapnutym miesanim sa inak kazdy snimok priratal k predchadzajucemu
        // a obraz sa po niekolkych sekundach prepalil do oranzova. Na snimke
        // hned po nacitani to nebolo vidiet, na zivej stranke ano.
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        // useProgram tu je, lebo rozmer() a niektoré scény si program menia;
        // bindBuffer a vertexAttribPointer tu do 11. 9. 2026 boli tiež, a boli
        // zbytočné: každé plátno má vlastný kontext, do ktorého nikto iný
        // nesiaha, takže väzba z postavScenu() platí až do konca života
        // stránky. Sú to tri volania cez most do ovládača na každý snímok
        // a na prehliadke s desiatimi plátnami tridsať za sekundu.
        gl.useProgram(program);
        // Čas sa opakuje po PERIODA sekundách. Bez toho po hodine rástol do
        // tisícov a šum aj sin() v shaderi strácali presnosť: obraz sekal.
        gl.uniform1f(uCas, ((teraz - s.zaciatok) / 1000) % PERIODA);
        gl.uniform2f(uMys, MYS.x, MYS.y);
        gl.uniform1f(uPosun, MYS.p);
        gl.uniform1f(uZrych, MYS.z);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      },
    };
    s.rozmer();
    // Prvý snímok hneď. V tichom režime s posunom, lebo v čase 0 je šum
    // najplochejší a obraz by bol takmer prázdny.
    s.kresli(performance.now() + (tichy ? 9000 : 0));
    return s;
  }

  // Stavba scén (WebGL kontext, kompilácia shaderov, prvý snímok) sa NErobí
  // pri načítaní. Lighthouse 10. 9. 2026: bez grafickej karty to bolo 1,7 s
  // práce hlavného vlákna pred vykreslením nadpisu (LCP 3,2 s, skóre 82).
  // Scény vzniknú pri prvej činnosti človeka, najneskôr 4 s po načítaní. Kým nevzniknú, plátno je priehľadné na tmavom pozadí.
  var postavene = false;
  function postavVsetky(e) {
    if (postavene) return;
    postavene = true;
    Array.prototype.forEach.call(platna, function (p) {
      var s = postavScenu(p);
      if (s) sceny.push(s);
    });
    if (!sceny.length) return;
    poStavbe(e);
  }
  function poStavbe(e) {

  /* Každá scéna si stráži vlastnú veľkosť.
   *
   * Prečo to nestačilo merať pri vzniku a pri zmene okna: plátno sa meria skôr,
   * než sa dopočítajú fonty a dokreslí rozloženie, takže dostane inú veľkosť
   * než akú nakoniec má. Obraz sa potom roztiahne a na mobile z toho vznikli
   * obdĺžnikové seky. Na telefóne k tomu pribúda skrývanie adresného riadka,
   * ktoré mení výšku okna bez udalosti resize.
   * ResizeObserver je jediné, čo si to všimne spoľahlivo. */
  if ('ResizeObserver' in window) {
    var ro = new ResizeObserver(function (zaznamy) {
      zaznamy.forEach(function (z) {
        for (var i = 0; i < sceny.length; i++) {
          if (sceny[i].plocha !== z.target) continue;
          sceny[i].rozmer();
          // Po zmene veľkosti je obsah plátna neplatný, prekresliť hneď,
          // nečakať na ďalší snímok slučky.
          sceny[i].kresli(performance.now() + (tichy ? 9000 : 0));
        }
      });
    });
    sceny.forEach(function (s) { ro.observe(s.plocha); });
  }
  // Fonty menia výšku textu a tým aj výšku úvodu.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      sceny.forEach(function (s) { s.rozmer(); s.kresli(performance.now() + (tichy ? 9000 : 0)); });
    });
  }

  // ── jedna spoločná slučka pre všetky scény ────────────────────────────────
  var bezi = false;
  var posledna = 0;
  /* Dva stropy snímok za sekundu.
     30 je základ: scéna sa hýbe tak pomaly, že medzi 30 a 60 nie je rozdiel.
     60 platí len tých POHYB ms po poslednom pohybe myšou, lebo práve vtedy
     svetlo dobieha kurzor a 30 by bolo vidieť ako sek.
     TOLERANCIA existuje preto, že snímky obrazovky chodia po 16,67 ms:
     bez nej vyšlo 33,34 ms tesne pod hranicou, každý druhý snímok sa zahodil
     a namiesto 30 sa kreslilo 25 (odmerané 11. 9. 2026 na hube). */
  var SNIMOK_POKOJ = 1000 / 30;
  var SNIMOK_POHYB = 1000 / 60;
  var TOLERANCIA = 4;
  var POHYB = 320;
  // Po NECINNOST ms bez pohybu myši, scrollu či klávesy sa kreslenie zastaví
  // a ostane posledný snímok. Pozadie je ozdoba: nemá hriať GPU pol hodiny,
  // kým človek číta alebo odišiel od počítača. Prvý pohyb ho spustí znova.
  // Bolo 90 s, čo je pri čítaní úvodnej stránky skoro celá návšteva.
  var NECINNOST = 20000;
  var poslednaCinnost = performance.now();

  /* Slučka sa po načítaní stránky NESPUSTÍ. Rozbehne sa až prvou skutočnou
     činnosťou človeka, teda pohybom myši, dotykom, scrollom alebo klávesou.
     Do tej chvíle ostane na plátne jediný snímok z postavScenu().

     Prečo: PageSpeed 9. 9. 2026 na https://arling.sk/ nameral Performance 68,
     Total Blocking Time 19 530 ms, 34,8 s práce hlavného vlákna a 20 dlhých
     úloh. Lighthouse do stránky nikdy nič nezadá, takže mu poslednaCinnost
     ostala na čase načítania a odmeral celých 90 s animácie ako blokovanie.
     Toto pozadie je na každej našej stránke vrátane tých, kam vedú platené
     reklamy, takže to ťahá dole Quality Score aj SEO. Návštevník nestratí nič:
     statický snímok je presne ten, z ktorého slučka pokračuje, a kým sa
     človek nepohne, nemá čo vidieť. */
  var bolVstup = false;

  function jeCoKreslit() {
    if (tichy || document.hidden) return false;
    if (!bolVstup) return false;
    // Bez requestAnimationFrame sa slučka nespustí vôbec. Náhrada cez
    // setInterval by kreslila aj v skrytej karte, čo je presne to, čomu sa
    // celý tento súbor vyhýba. Ostane statický snímok z postavScenu().
    if (!window.requestAnimationFrame) return false;
    if (performance.now() - poslednaCinnost > NECINNOST) return false;
    for (var i = 0; i < sceny.length; i++) if (sceny[i].vidno) return true;
    return false;
  }
  // Žiadne nové objekty vnútri slučky: `i` a `strop` sú čísla na zásobníku,
  // kresli() nevytvára nič a uniformy sa posielajú po hodnotách. Po slučke
  // teda nezostáva odpad, ktorý by zberač pamäte musel upratať uprostred
  // scrollovania. Bola to podmienka zadania a drží.
  function slucka(teraz) {
    if (!bezi) return;
    var strop = (teraz - poslednyPohyb < POHYB) ? SNIMOK_POHYB : SNIMOK_POKOJ;
    if (teraz - posledna >= strop - TOLERANCIA) {
      // Posúva sa o CELÝ krok, nie na `teraz`. Keby sa posunul na `teraz`,
      // zvyšok nad krok sa zahodí a na obrazovke so 75 Hz vyjde z cieľových
      // 30 reálnych 25 (odmerané 11. 9. 2026 v headless Chrome).
      posledna += strop;
      // Po pauze (skrytá karta, zastavená slučka) sa nedobieha: inak by
      // sa po návrate vykreslilo naraz toľko snímok, koľko sa zameškalo.
      if (teraz - posledna > strop * 2) posledna = teraz;
      dotiahni();
      for (var i = 0; i < sceny.length; i++) if (sceny[i].vidno) sceny[i].kresli(teraz);
    }
    if (jeCoKreslit()) window.requestAnimationFrame(slucka);
    else bezi = false;
  }
  function spusti() {
    if (bezi || !jeCoKreslit()) return;
    bezi = true;
    window.requestAnimationFrame(slucka);
  }

  if (!tichy) {
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (zaznamy) {
        zaznamy.forEach(function (z) {
          for (var i = 0; i < sceny.length; i++) {
            if (sceny[i].plocha === z.target) sceny[i].vidno = z.isIntersecting;
          }
        });
        spusti();
      }, { threshold: 0 });
      sceny.forEach(function (s) { io.observe(s.plocha); });
    } else {
      sceny.forEach(function (s) { s.vidno = true; });
    }
    document.addEventListener('visibilitychange', function () { if (!document.hidden) { poslednaCinnost = performance.now(); spusti(); } });
    // Čokoľvek, čo robí človek, počíta ako činnosť: prvý raz slučku spustí,
    // potom ju drží bežať a po NECINNOST sa opäť zastaví.
    ['pointermove', 'pointerdown', 'scroll', 'keydown', 'touchstart', 'wheel'].forEach(function (u) {
      window.addEventListener(u, function (e) {
        poslednaCinnost = performance.now();
        // Klávesa scénou nehýbe, všetko ostatné áno: pri tom sa na chvíľu
        // prepne na 60 snímok. Dotykové zariadenie sem patrí tiež, lebo
        // pointermove na ňom beží, len sa z neho nečíta poloha myši.
        if (e && e.type !== 'keydown') poslednyPohyb = poslednaCinnost;
        if (!bolVstup) {
          bolVstup = true;
          // Čas scény sa počíta odznova, aby animácia plynulo pokračovala
          // z toho snímku, ktorý mal človek doteraz pred sebou. Bez toho by
          // scéna preskočila o tie sekundy, čo stránka len tak stála.
          sceny.forEach(function (s) { s.zaciatok = null; });
        }
        spusti();
      }, { passive: true });
    });
    // Tu sa slučka zámerne nespúšťa, pozri komentár pri bolVstup vyššie.
  }
  // Keď stavbu spustila činnosť človeka, tá istá udalosť rovno naštartuje
  // slučku; inak by sa čakalo na ďalší pohyb.
  if (e && e.type && !tichy) { poslednaCinnost = performance.now(); bolVstup = true; spusti(); }

  // Zmena okna: až po stavbe, lebo `bezi` a scény žijú tu. Do 10. 9. 2026
  // bol tento poslucháč mimo funkcie a pri každom resize hádzal
  // ReferenceError (audit cesty zákazníka).
  var caka = false;
  window.addEventListener('resize', function () {
    if (caka) return;
    caka = true;
    window.requestAnimationFrame(function () {
      caka = false;
      sceny.forEach(function (s) {
        s.rozmer();
        if (!bezi) s.kresli(performance.now() + (tichy ? 9000 : 0));
      });
    });
  }, { passive: true });
  }

  // Spúšťač stavby: prvá činnosť človeka, alebo nečinný čas po načítaní.
  ['pointermove', 'pointerdown', 'scroll', 'keydown', 'touchstart', 'wheel'].forEach(function (u) {
    window.addEventListener(u, postavVsetky, { passive: true, once: true });
  });
  function poNacitani() {
    // Zámerne obyčajný časovač, nie requestIdleCallback: ten by sa spustil
    // hneď po načítaní (stránka je vtedy nečinná) a meranie by to zase
    // započítalo do práce pred prvým vykreslením.
    setTimeout(postavVsetky, 4000);
  }
  if (document.readyState === 'complete') poNacitani();
  else window.addEventListener('load', poNacitani, { once: true });
})();