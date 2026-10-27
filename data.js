const { redis, valid } = require('./_lib');
const DEFAULT = {
  profile: { name: 'Seu Nome', title: 'Desenvolvedor', bio: 'Escreva aqui quem você é. Faça login (rodapé) para editar.', github: '', phone: '' },
  resume: { text: 'Seu currículo aqui…', link: '' },
  projects: []
};
module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      const raw = await redis(['GET', 'portfolio']);
      res.setHeader('Cache-Control', 'no-store');
      return res.json(raw ? JSON.parse(raw) : DEFAULT);
    }
    if (req.method === 'POST') {
      if (!valid(req)) return res.status(401).json({ error: 'Não autorizado' });
      const d = req.body;
      if (!d || !d.profile || !Array.isArray(d.projects)) return res.status(400).json({ error: 'Dados inválidos' });
      await redis(['SET', 'portfolio', JSON.stringify(d)]);
      return res.json({ ok: true });
    }
    res.status(405).end();
  } catch (e) {
    res.status(500).json({ error: String(e.message || e), fallback: DEFAULT });
  }
};
