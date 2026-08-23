const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const decodeRoutes = require('./routes/decode');
const diagnoseRoutes = require('./routes/diagnose');
const atlasRoutes = require('./routes/atlas');

const app = express();
const PORT = process.env.PORT || 3000;

console.log('==============================================');
console.log('AIDA - Agente Industrial de Diagnostico ABB');
console.log('==============================================');

const hasApiKey = process.env.GROQ_API_KEY || process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;
if (!hasApiKey) {
  console.warn('[server] Nenhuma chave de API configurada.');
  console.warn('[server] Defina GROQ_API_KEY, DEEPSEEK_API_KEY ou OPENAI_API_KEY no arquivo .env');
} else {
  if (process.env.GROQ_API_KEY) console.log('[server] GROQ_API_KEY configurada');
  if (process.env.DEEPSEEK_API_KEY) console.log('[server] DEEPSEEK_API_KEY configurada');
  if (process.env.OPENAI_API_KEY) console.log('[server] OPENAI_API_KEY configurada');
}

// Middleware de log de requisicoes
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`);
  });
  next();
});

// CORS: por padrao (sem CORS_ORIGIN definido) o servico so aceita
// requisicoes same-origin, o que e seguro porque o frontend e servido
// pelo proprio Express. "*" so deve ser usado conscientemente em
// desenvolvimento; multiplas origens podem ser informadas separadas por
// virgula em CORS_ORIGIN.
const configuredOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

if (configuredOrigins.includes('*')) {
  console.warn('[server] CORS_ORIGIN="*" esta habilitado. Nao recomendado para producao.');
}

const corsOptions = {
  origin: configuredOrigins.length === 0
    ? false // same-origin apenas
    : configuredOrigins.includes('*')
      ? true
      : configuredOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));

// 256kb e generoso para mensagens de chat e codigos hexadecimais; evita
// que payloads gigantes cheguem ate o parser JSON.
app.use(express.json({ limit: '256kb' }));
app.use(express.urlencoded({ extended: true, limit: '256kb' }));

// Arquivos estaticos do frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// Rotas da API
app.use('/api/decode', decodeRoutes);
app.use('/api/diagnose', diagnoseRoutes);
app.use('/api/atlas', atlasRoutes);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    api: hasApiKey ? 'configured' : 'missing'
  });
});

// Fallback SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Tratamento de erros
app.use((err, req, res, next) => {
  console.error('[server] Erro nao tratado:', err);
  res.status(500).json({
    error: 'Erro interno do servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

app.listen(PORT, () => {
  console.log(`[server] AIDA em execucao em http://localhost:${PORT}`);
  console.log(`[server] Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[server] Status da API: ${hasApiKey ? 'configurada' : 'nao configurada'}`);
  console.log('[server] Pressione Ctrl+C para encerrar o servidor');
});
