const express = require('express');
const router = express.Router();
const { interpret } = require('../services/decoder');
const { createRateLimiter } = require('../middleware/rateLimiter');

router.use(createRateLimiter({ windowMs: 60000, max: 60, message: 'Limite de decodificacoes excedido. Aguarde um minuto.' }));

router.post('/', (req, res, next) => {
  try {
    const { module, hex } = req.body;

    if (!module || typeof module !== 'string') {
      return res.status(400).json({ error: 'Campo "module" e obrigatorio e deve ser uma string.' });
    }
    if (!hex || typeof hex !== 'string') {
      return res.status(400).json({ error: 'Campo "hex" e obrigatorio e deve ser uma string.' });
    }

    let cleanHex = hex.replace(/^(0x|16#)/i, '').replace(/\s/g, '');
    if (!/^[0-9A-Fa-f]{1,8}$/.test(cleanHex)) {
      return res.status(400).json({ error: 'Codigo hexadecimal invalido. Use ate 8 caracteres hexadecimais.' });
    }
    cleanHex = cleanHex.padStart(8, '0').toUpperCase();

    console.log(`[decode] module=${module} hex=${cleanHex}`);

    const result = interpret(module, cleanHex);
    res.json(result);
  } catch (error) {
    console.error('[decode] Erro:', error);
    next(error);
  }
});

module.exports = router;
