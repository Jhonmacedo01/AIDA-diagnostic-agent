const express = require('express');
const router = express.Router();
const atlas = require('../services/atlas');
const { createRateLimiter } = require('../middleware/rateLimiter');

router.use(createRateLimiter({ windowMs: 60000, max: 120, message: 'Limite de consultas ao atlas excedido. Aguarde um minuto.' }));

router.get('/', (req, res) => {
  res.json({ modules: atlas.listModules() });
});

// Referencia geral 800xA / AC 800M (arquitetura, topologia, redundancia,
// hardware, diagnostico, comunicacao, backup). Rotas fixas, portanto
// precisam vir antes de "/:module" para nao serem capturadas por ele.
router.get('/system-reference', (req, res) => {
  res.json({ categories: atlas.listReferenceCategories(), reference: atlas.getSystemReference() });
});

router.get('/system-reference/search/:term', (req, res) => {
  res.json(atlas.searchSystemReference(req.params.term));
});

router.get('/system-reference/:category', (req, res) => {
  const category = atlas.getSystemReference(req.params.category);
  if (!category) {
    return res.status(404).json({ error: 'Categoria nao encontrada' });
  }
  res.json(category);
});

router.get('/:module', (req, res) => {
  const moduleType = req.params.module;
  const bits = atlas.getModuleBits(moduleType);
  if (!bits) {
    return res.status(404).json({ error: 'Modulo nao encontrado' });
  }
  res.json(bits);
});

router.get('/:module/search/:term', (req, res) => {
  const { module, term } = req.params;
  const results = atlas.searchAtlas(module, term);
  res.json(results);
});

module.exports = router;
