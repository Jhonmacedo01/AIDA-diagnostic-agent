// -----------------------------------------------------------------------
// Rate limiting simples, em memoria, sem dependencias externas.
//
// Nao substitui uma solucao de producao com Redis atras de um load
// balancer com multiplas instancias, mas fecha o buraco critico de uma
// rota de IA completamente aberta a chamadas ilimitadas em um servidor
// unico. Trocar por "express-rate-limit" + um store compartilhado
// quando o backend for escalado horizontalmente.
// -----------------------------------------------------------------------

function createRateLimiter({ windowMs = 60000, max = 20, message = 'Muitas requisicoes. Aguarde e tente novamente.' } = {}) {
  const hits = new Map(); // ip -> { count, resetAt }

  // Evita crescimento indefinido do Map em processos de longa duracao.
  setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of hits.entries()) {
      if (entry.resetAt <= now) hits.delete(ip);
    }
  }, windowMs).unref();

  return function rateLimiter(req, res, next) {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const now = Date.now();
    let entry = hits.get(ip);

    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(ip, entry);
    }

    entry.count += 1;

    if (entry.count > max) {
      const retryAfterSec = Math.ceil((entry.resetAt - now) / 1000);
      res.setHeader('Retry-After', String(retryAfterSec));
      return res.status(429).json({ error: message, retryAfterSeconds: retryAfterSec });
    }

    next();
  };
}

module.exports = { createRateLimiter };
