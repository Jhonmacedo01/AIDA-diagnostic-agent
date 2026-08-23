const express = require('express');
const router = express.Router();
const { askAgent } = require('../agent/groq');
const { createRateLimiter } = require('../middleware/rateLimiter');

const MAX_MESSAGE_LENGTH = 4000;

// Limite mais restrito nesta rota especificamente, por ser a que consome
// a API de IA (custo por chamada).
const diagnoseLimiter = createRateLimiter({ windowMs: 60000, max: 15, message: 'Limite de mensagens ao agente excedido. Aguarde um minuto.' });
router.use(diagnoseLimiter);

router.post('/', async (req, res) => {
  try {
    const { message, history = [], context = null } = req.body;
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Mensagem e obrigatoria.' });
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ error: `Mensagem excede o limite de ${MAX_MESSAGE_LENGTH} caracteres.` });
    }

    // context = { module, hex } enviado pelo frontend com o estado atual
    // do decodificador (cartao selecionado + Dword/Hex preenchido).
    let safeContext = null;
    if (context && typeof context === 'object' && !Array.isArray(context)) {
      const moduleType = typeof context.module === 'string' ? context.module.slice(0, 16) : null;
      const hex = typeof context.hex === 'string' ? context.hex.slice(0, 16) : null;
      if (moduleType && hex) {
        safeContext = { module: moduleType, hex };
      }
    }

    const result = await askAgent(history, message, safeContext);
    res.json(result);
  } catch (error) {
    console.error('[diagnose] Erro:', error);
    res.status(500).json({ error: 'Erro interno no agente de diagnostico.' });
  }
});

module.exports = router;
