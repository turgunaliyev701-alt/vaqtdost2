// POST /api/<funksiya> — sinflar uchun API (Cloudflare Pages Function + D1)
const enc = new TextEncoder();
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
const rnd = n => hex(crypto.getRandomValues(new Uint8Array(n)));
const sha = async s => hex(await crypto.subtle.digest('SHA-256', enc.encode(s)));
async function hashPw(pw, salt) {
  const k = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveBits']);
  return hex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode(salt), iterations: 100000 }, k, 256));
}
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });
const fail = (m, s = 400) => json({ message: m }, s);
const same = (a, b) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };

export async function onRequestPost({ request, env, params }) {
  let a;
  try { a = await request.json(); } catch { return fail('Noto‘g‘ri so‘rov'); }
  if (!a || typeof a !== 'object') return fail('Noto‘g‘ri so‘rov');
  const db = env.DB;
  if (!db) return fail('Baza ulanmagan (DB binding yo‘q)', 500);
  const fn = params.fn;
  const str = (v, max) => typeof v === 'string' && v.length <= max;

  if (fn === 'create_class') {
    const name = (a.p_name || '').trim(), pw = a.p_password;
    if (!str(name, 80) || !name || !str(pw, 100) || pw.length < 4) return fail('Sinf nomi yoki parol noto‘g‘ri');
    const salt = rnd(16), pwHash = await hashPw(pw, salt), key = rnd(16), ownerHash = await sha(key);
    for (let i = 0; i < 8; i++) {
      const code = 'VD-' + rnd(2).toUpperCase();
      try {
        await db.prepare('INSERT INTO classes (code,name,pw_salt,pw_hash,owner_hash) VALUES (?,?,?,?,?)')
          .bind(code, name, salt, pwHash, ownerHash).run();
        return json({ code, owner_key: key });
      } catch (e) { /* kod band bo‘lsa qayta urinamiz */ }
    }
    return fail('Kod yaratib bo‘lmadi, qayta urinib ko‘ring', 500);
  }

  if (fn === 'get_class') {
    if (!str(a.p_code, 20) || !str(a.p_password, 100)) return fail('Kod yoki parol noto‘g‘ri');
    const r = await db.prepare('SELECT name,pw_salt,pw_hash,tasks FROM classes WHERE code=?').bind(a.p_code.toUpperCase()).first();
    const h = r ? await hashPw(a.p_password, r.pw_salt) : '';
    if (!r || !same(h, r.pw_hash)) return fail('Kod yoki parol noto‘g‘ri');
    return json({ name: r.name, tasks: JSON.parse(r.tasks) });
  }

  if (fn === 'set_tasks') {
    if (!str(a.p_code, 20) || !str(a.p_owner_key, 100) || !Array.isArray(a.p_tasks)) return fail('Noto‘g‘ri so‘rov');
    const t = JSON.stringify(a.p_tasks.map(x => ({ id: String(x.id).slice(0, 40), title: String(x.title).slice(0, 200), subject: String(x.subject).slice(0, 80), due: String(x.due).slice(0, 10) })));
    if (t.length > 100000) return fail('Vazifalar juda ko‘p');
    const r = await db.prepare('UPDATE classes SET tasks=? WHERE code=? AND owner_hash=?').bind(t, a.p_code, await sha(a.p_owner_key)).run();
    if (!r.meta.changes) return fail('Ruxsat yo‘q', 403);
    return json(null);
  }

  if (fn === 'delete_class') {
    if (!str(a.p_code, 20) || !str(a.p_owner_key, 100)) return fail('Noto‘g‘ri so‘rov');
    await db.prepare('DELETE FROM classes WHERE code=? AND owner_hash=?').bind(a.p_code, await sha(a.p_owner_key)).run();
    return json(null);
  }

  return fail('Noma’lum funksiya', 404);
}
