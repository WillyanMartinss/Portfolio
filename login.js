const { sign, same } = require('./_lib');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  const { user, pass } = req.body || {};
  if (!process.env.ADMIN_USER || !process.env.ADMIN_PASS) return res.status(500).json({ error: 'Configure ADMIN_USER e ADMIN_PASS' });
  if (same(user, process.env.ADMIN_USER) && same(pass, process.env.ADMIN_PASS)) return res.json({ token: sign() });
  setTimeout(() => res.status(401).json({ error: 'Login inválido' }), 600);
};
