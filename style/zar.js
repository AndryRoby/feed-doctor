/* Žiara: živé svetlo v pozadí úvodu. Jeden shader, žiadna knižnica, 0 cudzích domén.
 *
 * Prečo vlastný a nie unicorn.studio: ten sa načítava z cudzieho CDN, čo naša
 * CSP zakazuje, a na každej stránke tvrdíme, že sa nič neposiela tretím stranám.
 * Odmerané 6. 9. 2026 (ops/design/pohyb-dokaz.mjs): unicorn.studio beží na
 * siedmich WebGL plátnach plus prehrávané videá a mení 38 % plochy za snímku.
 * Toto je jedno plátno, jeden fragment shader, asi 5 kB, a mení sa tak pomaly,
 * že to čítanie neruší.
 *
 * Zodpovednosť voči návštevníkovi je tu dôležitejšia než efekt, preto:
 *   - `prefers-reduced-motion: reduce` vykreslí JEDEN snímok a slučka sa nespustí;
 *   - keď úvod odscrolluje z obrazu, slučka sa zastaví (IntersectionObserver);
 *   - keď je karta prehliadača skrytá, slučka sa zastaví (visibilitychange);
 *   - kreslíme najviac 30-krát za sekundu, nie 60, rozdiel nie je vidieť
 *     a spotreba je polovičná;
 *   - na úzkych obrazovkách kreslíme na polovičnom rozlíšení, lebo telefón
 *     má hustý displej a shader by zbytočne počítal štvornásobok bodov;
 *   - keď WebGL nie je (staré zariadenie, vypnutá akcelerácia, šetrič energie),
 *     plátno sa odstráni a ostane CSS prechod pod ním, ktorý vyzerá dobre sám.
 * Plátno je `aria-hidden` a `pointer-events:none`, takže do obsluhy nezasahuje.
 *
 * Použitie: <canvas class="zar-plocha" aria-hidden="true"></canvas> v úvode
 * a <script src="/style/zar.js" defer></script>.
 */
(function () {
  'use strict';

  var plocha = document.querySelector('canvas.zar-plocha');
  if (!plocha) return;

  var tichy = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var gl = null;
  try {
    gl = plocha.getContext('webgl2', { alpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' })
      || plocha.getContext('webgl', { alpha: true, antialias: false, depth: false, stencil: false });
  } catch (e) { gl = null; }
  if (!gl) { plocha.remove(); return; }

  var VRCHOL = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';

  /* Shader: dvakrát zohnutý šum (domain warping) namapovaný na našu žeravú
     paletu. Žiadny tvar, ktorý by sa dal pomenovať, len svetlo, ktoré sa
     preteká. Farby sú tie isté ako tokeny v paper.css. */
  var FRAGMENT = [
    'precision highp float;',
    'uniform vec2 rozmer;',
    'uniform float cas;',
    '',
    '// ---- sum a fBm -------------------------------------------------------',
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
    '',
    '// Jedna stuha svetla: vodorovna linka rozvlnena sumom, jas klesa so',
    '// vzdialenostou od nej. Tak vznikne ostre jadro a mekky rozptyl okolo,',
    '// co je rozdiel medzi "svieti to" a "je tam hneda skvrna".',
    'float stuha(vec2 p, float posun, float rychlost, float hrubka, float vlna){',
    '  float y = posun',
    '          + vlna * (fbm(vec2(p.x * 1.15 + cas * rychlost, posun * 7.0)) - 0.5)',
    '          + vlna * 0.45 * (fbm(vec2(p.x * 2.9 - cas * rychlost * 0.6, posun * 3.0)) - 0.5);',
    '  float d = abs(p.y - y);',
    '  float jadro = hrubka / (d + hrubka);',
    '  return pow(jadro, 2.6);',
    '}',
    '',
    '// Rozklad do vzoru pixelov. Bez neho su na tmavom prechode vidiet pruhy,',
    '// lebo osem bitov na kanal nestaci na jemny prechod v tmavych tonoch.',
    'float rozptyl(vec2 sur){',
    '  return fract(sin(dot(sur, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;',
    '}',
    '',
    'void main(){',
    '  vec2 uv = gl_FragCoord.xy / rozmer.xy;',
    '  vec2 p = uv;',
    '  p.x *= rozmer.x / rozmer.y;',
    '',
    '  // tri stuhy v roznych hlbkach, rozna rychlost robi dojem priestoru',
    '  float s1 = stuha(p, 0.62, 0.045, 0.055, 0.42);',
    '  float s2 = stuha(p, 0.48, 0.028, 0.090, 0.55);',
    '  float s3 = stuha(p, 0.74, 0.062, 0.035, 0.30);',
    '',
    '  // jemny opar, ktory stuhy spaja, aby nevyzerali ako tri ciary',
    '  float opar = fbm(p * 1.7 + vec2(cas * 0.016, -cas * 0.011));',
    '  opar = smoothstep(0.42, 0.95, opar) * 0.5;',
    '',
    '  vec3 uhlik = vec3(0.42, 0.15, 0.07);',
    '  vec3 zeraz = vec3(0.97, 0.40, 0.24);',
    '  vec3 jantar= vec3(1.00, 0.72, 0.40);',
    '  vec3 biela = vec3(1.00, 0.94, 0.88);',
    '',
    '  float jas = s1 * 0.85 + s2 * 0.55 + s3 * 0.70 + opar * 0.35;',
    '',
    '  // farba sa meni s jasom: od uhlika cez zeravu po takmer bielu v jadre',
    '  vec3 farba = mix(uhlik, zeraz, clamp(jas * 1.5, 0.0, 1.0));',
    '  farba = mix(farba, jantar, clamp(jas * 0.95 - 0.35, 0.0, 1.0));',
    '  farba = mix(farba, biela, clamp(jas * 0.8 - 0.72, 0.0, 1.0));',
    '',
    '  // svetlo je hore a v strede, k okrajom sa strati do pozadia stranky',
    '  float zhora = smoothstep(1.02, 0.02, uv.y);',
    '  float okraj = smoothstep(0.0, 0.26, uv.x) * smoothstep(1.0, 0.74, uv.x);',
    '  float sila = clamp(jas, 0.0, 1.4) * zhora * mix(0.35, 1.0, okraj);',
    '',
    '  float a = clamp(sila * 0.72, 0.0, 0.92) + rozptyl(gl_FragCoord.xy) * 0.012;',
    '  gl_FragColor = vec4(farba, clamp(a, 0.0, 1.0));',
    '}',
  ].join('\n');

  function shader(typ, zdroj) {
    var s = gl.createShader(typ);
    gl.shaderSource(s, zdroj);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) return null;
    return s;
  }

  var vs = shader(gl.VERTEX_SHADER, VRCHOL);
  var fs = shader(gl.FRAGMENT_SHADER, FRAGMENT);
  if (!vs || !fs) { plocha.remove(); return; }

  var program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { plocha.remove(); return; }
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

  function zmenRozmer() {
    var r = plocha.getBoundingClientRect();
    // Na telefóne kreslíme na polovičnom rozlíšení: shader je plynulý gradient,
    // takže rozdiel nie je vidieť, a počítania je štvrtina.
    var hustota = Math.min(window.devicePixelRatio || 1, r.width < 720 ? 1 : 1.5);
    var w = Math.max(1, Math.round(r.width * hustota));
    var h = Math.max(1, Math.round(r.height * hustota));
    if (plocha.width !== w || plocha.height !== h) {
      plocha.width = w; plocha.height = h;
      gl.viewport(0, 0, w, h);
    }
    gl.uniform2f(uRozmer, plocha.width, plocha.height);
  }

  var zaciatok = null;
  var bezi = false;
  var vidno = true;
  var poslednaKresba = 0;
  var SNIMOK = 1000 / 30;   // 30 za sekundu stačí, 60 by len hrialo batériu

  function kresli(teraz) {
    if (zaciatok === null) zaciatok = teraz;
    gl.uniform1f(uCas, (teraz - zaciatok) / 1000);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function slucka(teraz) {
    if (!bezi) return;
    if (teraz - poslednaKresba >= SNIMOK) { poslednaKresba = teraz; kresli(teraz); }
    window.requestAnimationFrame(slucka);
  }

  function spusti() {
    if (bezi || tichy || !vidno || document.hidden) return;
    bezi = true;
    window.requestAnimationFrame(slucka);
  }
  function zastav() { bezi = false; }

  zmenRozmer();
  kresli(performance.now());   // prvý snímok vždy, aj v tichom režime

  if (!tichy) {
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (z) {
        vidno = z[0].isIntersecting;
        if (vidno) spusti(); else zastav();
      }, { threshold: 0 }).observe(plocha);
    }
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) zastav(); else spusti();
    });
    spusti();
  }

  var cakaNaRozmer = false;
  window.addEventListener('resize', function () {
    if (cakaNaRozmer) return;
    cakaNaRozmer = true;
    window.requestAnimationFrame(function () {
      cakaNaRozmer = false;
      zmenRozmer();
      if (!bezi) kresli(performance.now());
    });
  }, { passive: true });
})();
