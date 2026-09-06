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
 *   - kreslí sa len to plátno, ktoré je práve v obraze (IntersectionObserver);
 *   - keď je karta prehliadača skrytá, nekreslí sa nič (visibilitychange);
 *   - najviac 30 snímok za sekundu, nie 60: rozdiel nie je vidieť a spotreba
 *     je polovičná;
 *   - na úzkych obrazovkách nižšie rozlíšenie, lebo telefón má hustý displej;
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

  var tichy = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var VRCHOL = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';

  /* Spoločný základ: šum, fBm, rozptyl, paleta a stlmenie k okrajom.
     Rozptyl (dither) nie je ozdoba. Bez neho sú na tmavom prechode vidieť
     pruhy, lebo osem bitov na kanál nestačí na jemný prechod v tmavých tónoch. */
  var ZAKLAD = [
    'precision highp float;',
    'uniform vec2 rozmer;',
    'uniform float cas;',
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
    'const vec3 UHLIK  = vec3(0.42, 0.15, 0.07);',
    'const vec3 ZERAZ  = vec3(0.97, 0.40, 0.24);',
    'const vec3 JANTAR = vec3(1.00, 0.72, 0.40);',
    'const vec3 BIELA  = vec3(1.00, 0.94, 0.88);',
    // Stlmenie k okrajom. Bolo priostre: nasobilo nulou presne tam, kde vacsina
    // scen svieti, takze sest z osmich vyzeralo ako cierna plocha. Teraz je to
    // len jemne pritlmenie, nie vypnutie.
    'float utlm(vec2 uv){',
    '  float zvisle = mix(0.55, 1.0, smoothstep(1.18, -0.05, uv.y));',
    '  float okraj  = smoothstep(0.0, 0.22, uv.x) * smoothstep(1.0, 0.78, uv.x);',
    '  return zvisle * mix(0.62, 1.0, okraj);',
    '}',
    'vec4 zloz(vec3 farba, float sila, float mierka){',
    '  float a = clamp(sila * mierka, 0.0, 0.92) + rozptyl(gl_FragCoord.xy) * 0.012;',
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
    '  gl_FragColor = zloz(f, clamp(jas, 0.0, 1.4) * utlm(uv), 0.72);',
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
    '  gl_FragColor = zloz(f, (jadro * 0.9 + teplo * 0.5) * utlm(uv), 0.62);',
    '}',
  ].join('\n');

  /* prach: pole svietiacich bodov, ktoré sa unášajú a blikajú. Hĺbka bez kresby.
     Pre produktové stránky. */
  V.prach = [
    'float bod(vec2 p, float mriezka, float rychlost, float posun){',
    '  vec2 g = p * mriezka;',
    '  g.y += cas * rychlost + posun;',
    '  vec2 i = floor(g), f = fract(g);',
    '  float s = sum(i + posun);',
    '  vec2 stred = vec2(0.5) + 0.34 * vec2(sin(s * 17.0 + cas * 0.25), cos(s * 11.0 + cas * 0.19));',
    '  float velkost = mix(0.020, 0.075, fract(s * 7.3));',
    '  float blik = 0.55 + 0.45 * sin(cas * (0.25 + fract(s * 3.1) * 0.4) + s * 30.0);',
    '  return pow(velkost / (length(f - stred) + velkost), 3.2) * blik * step(0.42, s);',
    '}',
    'void main(){',
    '  vec2 uv = gl_FragCoord.xy / rozmer.xy;',
    '  vec2 p = uv; p.x *= rozmer.x / rozmer.y;',
    '  float b = bod(p, 7.0, 0.020, 0.0) * 0.9 + bod(p, 12.0, 0.032, 3.7) * 0.6 + bod(p, 19.0, 0.048, 8.1) * 0.35;',
    '  float zaves = smoothstep(0.30, 0.95, fbm(p * 1.1 + vec2(cas * 0.012, 0.0))) * 0.42;',
    '  vec3 f = mix(UHLIK, JANTAR, clamp(b * 1.1, 0.0, 1.0));',
    '  f = mix(f, BIELA, clamp(b * 0.7 - 0.45, 0.0, 1.0));',
    '  gl_FragColor = zloz(f, (b * 1.15 + zaves * 0.85) * utlm(uv), 0.92);',
    '}',
  ].join('\n');

  /* luc: jeden široký šikmý pruh svetla, ktorý veľmi pomaly prechádza plochou.
     Najpokojnejšia, takmer statická. Pre právne texty a dokumentáciu. */
  V.luc = [
    'void main(){',
    '  vec2 uv = gl_FragCoord.xy / rozmer.xy;',
    '  vec2 p = uv; p.x *= rozmer.x / rozmer.y;',
    '  float os = p.x * cos(-0.55) - p.y * sin(-0.55);',
    '  float d = abs(os - (0.15 + 0.5 * sin(cas * 0.021)));',
    '  float luc = pow(0.30 / (d + 0.30), 3.4);',
    '  float jas = luc * (0.65 + 0.5 * fbm(p * 2.4 + vec2(cas * 0.010, -cas * 0.008)));',
    '  vec3 f = mix(UHLIK, ZERAZ, clamp(jas * 1.25, 0.0, 1.0));',
    '  f = mix(f, JANTAR, clamp(jas * 0.7 - 0.30, 0.0, 1.0));',
    '  gl_FragColor = zloz(f, jas * 1.30 * utlm(uv), 0.68);',
    '}',
  ].join('\n');

  /* zoraz: zvislé závoje ako polárna žiara, len teplé. Slávnostná, pre úvody. */
  V.zoraz = [
    'void main(){',
    '  vec2 uv = gl_FragCoord.xy / rozmer.xy;',
    '  vec2 p = uv; p.x *= rozmer.x / rozmer.y;',
    '  float posun = fbm(vec2(p.x * 2.2 + cas * 0.030, cas * 0.018)) - 0.5;',
    '  float x = p.x + posun * 0.30;',
    '  float pramen = pow(0.055 / (abs(fract(x * 2.6) - 0.5) * 0.9 + 0.055), 1.9);',
    '  pramen += pow(0.038 / (abs(fract(x * 4.1 + 0.33) - 0.5) * 0.9 + 0.038), 1.7) * 0.7;',
    '  float vyska = smoothstep(0.05, 0.62, p.y) * smoothstep(1.15, 0.55, p.y);',
    '  float jas = pramen * vyska * (0.55 + 0.6 * fbm(p * 1.6 + vec2(0.0, -cas * 0.05)));',
    '  vec3 f = mix(UHLIK, ZERAZ, clamp(jas * 1.3, 0.0, 1.0));',
    '  f = mix(f, JANTAR, clamp(jas * 0.9 - 0.40, 0.0, 1.0));',
    '  f = mix(f, BIELA,  clamp(jas * 0.7 - 0.80, 0.0, 1.0));',
    '  gl_FragColor = zloz(f, jas * 1.45 * utlm(uv), 0.82);',
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
    '  gl_FragColor = zloz(c, jas * 1.30 * utlm(uv), 0.88);',
    '}',
  ].join('\n');

  /* kruhy: sústredné vlnky rozbiehajúce sa z jedného bodu. Hypnotická. */
  V.kruhy = [
    'void main(){',
    '  vec2 uv = gl_FragCoord.xy / rozmer.xy;',
    '  vec2 p = uv; p.x *= rozmer.x / rozmer.y;',
    '  vec2 stred = vec2(0.5 * rozmer.x / rozmer.y, 0.72);',
    '  float d = length(p - stred) + fbm(p * 2.0 + cas * 0.02) * 0.06;',
    '  float vlnky = sin(d * 26.0 - cas * 0.85);',
    '  float jas = pow(max(vlnky, 0.0), 3.0) * smoothstep(1.1, 0.05, d) * 0.9;',
    '  jas += pow(0.12 / (d + 0.12), 2.2) * 0.35;',
    '  vec3 f = mix(UHLIK, ZERAZ, clamp(jas * 1.35, 0.0, 1.0));',
    '  f = mix(f, JANTAR, clamp(jas * 0.8 - 0.35, 0.0, 1.0));',
    '  gl_FragColor = zloz(f, jas * 1.35 * utlm(uv), 0.80);',
    '}',
  ].join('\n');

  /* dym: hustý pomalý dym, ktorý stúpa. Najtemnejšia z ôsmich. */
  V.dym = [
    'void main(){',
    '  vec2 uv = gl_FragCoord.xy / rozmer.xy;',
    '  vec2 p = uv; p.x *= rozmer.x / rozmer.y;',
    '  vec2 s = p * 2.1 + vec2(0.0, -cas * 0.035);',
    '  float a = fbm(s);',
    '  float b = fbm(s + 1.9 * vec2(a, fbm(s + vec2(3.1, 1.7))));',
    '  float jas = smoothstep(0.36, 0.92, b) * smoothstep(0.02, 0.55, p.y) * smoothstep(1.2, 0.6, p.y);',
    '  vec3 f = mix(UHLIK, ZERAZ, clamp(jas * 1.1, 0.0, 1.0));',
    '  f = mix(f, JANTAR, clamp(jas * 0.6 - 0.35, 0.0, 1.0));',
    '  gl_FragColor = zloz(f, jas * 1.60 * utlm(uv), 0.78);',
    '}',
  ].join('\n');

  /* iskry: drobné iskry stúpajúce nahor. Jediná živšia scéna, používať
     striedmo a nikdy tam, kde sa niečo číta. */
  V.iskry = [
    'float iskra(vec2 p, float mriezka, float rychlost, float posun){',
    '  vec2 g = vec2(p.x * mriezka, p.y * mriezka + cas * rychlost + posun);',
    '  vec2 i = floor(g), f = fract(g);',
    '  float s = sum(i + posun);',
    '  if (s < 0.86) return 0.0;',
    '  vec2 stred = vec2(0.5 + 0.3 * sin(s * 40.0 + cas * 0.9), 0.5);',
    '  float d = length((f - stred) * vec2(1.0, 0.45));',
    '  return pow(0.055 / (d + 0.055), 3.0) * (0.4 + 0.6 * sin(cas * 2.0 + s * 60.0));',
    '}',
    'void main(){',
    '  vec2 uv = gl_FragCoord.xy / rozmer.xy;',
    '  vec2 p = uv; p.x *= rozmer.x / rozmer.y;',
    '  float i = iskra(p, 9.0, 0.20, 0.0) + iskra(p, 15.0, 0.31, 5.3) * 0.7;',
    '  float pec = smoothstep(0.45, 1.05, 1.0 - p.y) * 0.30 * (0.6 + 0.5 * fbm(p * 2.0 + cas * 0.03));',
    '  float jas = i * 0.9 + pec;',
    '  vec3 f = mix(UHLIK, ZERAZ, clamp(jas * 1.5, 0.0, 1.0));',
    '  f = mix(f, JANTAR, clamp(i * 1.1 - 0.20, 0.0, 1.0));',
    '  f = mix(f, BIELA,  clamp(i * 0.9 - 0.60, 0.0, 1.0));',
    '  gl_FragColor = zloz(f, jas * 1.35 * utlm(uv), 0.86);',
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
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    var s = {
      plocha: plocha, nazov: nazov, vidno: false, zaciatok: null,
      rozmer: function () {
        var r = plocha.getBoundingClientRect();
        var hustota = Math.min(window.devicePixelRatio || 1, r.width < 720 ? 1 : 1.5);
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
        gl.useProgram(program);
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        gl.uniform1f(uCas, (teraz - s.zaciatok) / 1000);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      },
    };
    s.rozmer();
    // Prvý snímok hneď. V tichom režime s posunom, lebo v čase 0 je šum
    // najplochejší a obraz by bol takmer prázdny.
    s.kresli(performance.now() + (tichy ? 9000 : 0));
    return s;
  }

  Array.prototype.forEach.call(platna, function (p) {
    var s = postavScenu(p);
    if (s) sceny.push(s);
  });
  if (!sceny.length) return;

  // ── jedna spoločná slučka pre všetky scény ────────────────────────────────
  var bezi = false;
  var posledna = 0;
  var SNIMOK = 1000 / 30;

  function jeCoKreslit() {
    if (tichy || document.hidden) return false;
    for (var i = 0; i < sceny.length; i++) if (sceny[i].vidno) return true;
    return false;
  }
  function slucka(teraz) {
    if (!bezi) return;
    if (teraz - posledna >= SNIMOK) {
      posledna = teraz;
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
    document.addEventListener('visibilitychange', function () { if (!document.hidden) spusti(); });
    spusti();
  }

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
})();
