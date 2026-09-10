/* Zdieľaný modul: účet cez e-mail (worker arling-asistent, /v1/ucet/*).
 * Jeden zdroj pre všetky naše stránky, syncuje sa ako ostatné v
 * ops/design/paper (ops/design/sync-paper.mjs). Presné správanie ciest je
 * v ops/spec-ucet.md, časť A; tento modul je len tenký klient nad nimi.
 *
 * Token sa drží v localStorage ako 'arling:ucet' = { token, email, exp }
 * a posiela sa v hlavičke Authorization: Bearer <token>. Nie cookie:
 * Safari blokuje cookies naprieč doménami (arling.sk a workers.dev).
 *
 * API: token(), prihlaseny(), posliKod(email, jazyk?), over(email, kod),
 * ja(), odhlas(), zabudni(), priradSession(session_id), hra.nacitaj(hra), hra.uloz(hra, stav).
 * Nič viac sa sem nepridáva bez zmeny ops/spec-ucet.md (časť E: čo sa nerobí).
 */
const API = 'https://arling-asistent.arling.workers.dev';
const KLUC = 'arling:ucet';

function nacitajUcet() {
  try { const s = localStorage.getItem(KLUC); return s ? JSON.parse(s) : null; } catch (e) { return null; }
}
function ulozUcet(u) { try { localStorage.setItem(KLUC, JSON.stringify(u)); } catch (e) { /* bez úložiska sa neprihlási natrvalo, ale funguje aj tak */ } }
function zmazUcet() { try { localStorage.removeItem(KLUC); } catch (e) { /* nič */ } }
// Server aj tak normalizuje, ale klient to má robiť tiež: menej prekvapení,
// keď niekto zavolá funkciu priamo s hodnotou z formulára.
function normalizujEmail(email) { return String(email || '').trim().toLowerCase(); }

/* Platný token, alebo null (a zmaže prežitý). Nič nevolá na sieť. */
export function token() {
  const u = nacitajUcet();
  if (!u || !u.token || !u.exp || Date.now() >= u.exp) { if (u) zmazUcet(); return null; }
  return u.token;
}
export function prihlaseny() { return !!token(); }

async function volaj(cesta, opts) {
  opts = opts || {};
  const hlavicky = { 'Content-Type': 'application/json' };
  if (opts.auth !== false) { const t = token(); if (t) hlavicky.Authorization = 'Bearer ' + t; }
  let r;
  try {
    r = await fetch(API + cesta, { method: opts.method || 'GET', headers: hlavicky, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined });
  } catch (e) {
    const err = new Error('siet'); err.siet = true; throw err;
  }
  let data = null;
  try { data = await r.json(); } catch (e) { /* prázdna odpoveď (napr. 204) */ }
  if (!r.ok) { const err = new Error((data && data.error) || 'chyba'); err.status = r.status; err.data = data; throw err; }
  return data;
}

/* Pošle 6-miestny kód na e-mail. jazyk voliteľne 'sk' | 'en' | 'de' (predmet mailu). */
export async function posliKod(email, jazyk) {
  return volaj('/v1/ucet/kod', { method: 'POST', auth: false, body: { email: normalizujEmail(email), jazyk } });
}
/* Overí kód, pri úspechu uloží token na 90 dní. Vráti { token, email, ucet }. */
export async function over(email, kod) {
  const d = await volaj('/v1/ucet/over', { method: 'POST', auth: false, body: { email: normalizujEmail(email), kod: String(kod || '').trim() } });
  if (d && d.token) ulozUcet({ token: d.token, email: d.email, exp: Date.now() + 90 * 24 * 3600 * 1000 });
  return d;
}
/* { email, nakupy, predplatne, portal_url }. */
export async function ja() { return volaj('/v1/ucet/ja'); }
export async function odhlas() {
  try { await volaj('/v1/ucet/odhlasit', { method: 'POST' }); } catch (e) { /* odhlásime sa lokálne aj tak */ }
  zmazUcet();
}
/* Zmaže účet (nákupy ostávajú kvôli zákonu o účtovníctve) a odhlási toto
 * zariadenie. Na rozdiel od odhlas() sa pri zlyhaní NEODHLASUJE lokálne:
 * keby mazanie na serveri zlyhalo a token by sme aj tak zahodili, človek by
 * si myslel, že účet je preč, a pritom by ešte existoval. */
export async function zabudni() {
  const d = await volaj('/v1/ucet/ja', { method: 'DELETE' });
  zmazUcet();
  return d;
}
/* Priradí zaplatenú Stripe session k prihlásenému účtu (napr. po návrate z platby). */
export async function priradSession(session_id) {
  return volaj('/v1/ucet/nakup-session', { method: 'POST', body: { session_id } });
}
/* Stav hry na pozadí: chyby siete sú tu zámerne tiché, hra bez pripojenia
 * alebo bez prihlásenia funguje ďalej normálne, len sa nesynchronizuje
 * (ops/spec-ucet.md, časť B). */
export const hra = {
  async nacitaj(nazovHry) {
    try { return await volaj('/v1/ucet/hra/' + encodeURIComponent(nazovHry)); } catch (e) { return null; }
  },
  async uloz(nazovHry, stav) {
    try { await volaj('/v1/ucet/hra/' + encodeURIComponent(nazovHry), { method: 'PUT', body: stav }); return true; } catch (e) { return false; }
  },
};
