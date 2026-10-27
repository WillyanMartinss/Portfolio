const crypto = require('crypto');
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOK = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function redis(cmd) {
  const r = await fetch(URL_, { method: 'POST', headers: { Authorization: 'Bearer ' + TOK }, body: JSON.stringify(cmd) });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}
const secret = () => process.env.SESSION_SECRET || process.env.ADMIN_PASS || 'troque-isto';
const mac = (p) => crypto.createHmac('sha256', secret()).update(p).digest('hex');

function sign() { const p = String(Date.now() + 7 * 864e5); return p + '.' + mac(p); }
function valid(req) {
  const t = (req.headers.authorization || '').replace('Bearer ', '');
  const [p, h] = t.split('.');
  if (!p || !h || +p < Date.now()) return false;
  const e = mac(p);
  return h.length === e.length && crypto.timingSafeEqual(Buffer.from(h), Buffer.from(e));
}
function same(a, b) {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
}
module.exports = { redis, sign, valid, same };
