const OpenAI = require('openai');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { buildSystemPrompt, detectMode, MODES } = require('./systemPrompt');
const { tools, executeToolCall } = require('./tools');
const { buildEvidenceFromContext } = require('./evidence');

// -----------------------------------------------------------------------
// Selecao de provedor: decidida pelo NOME da variavel de ambiente
// configurada, nunca pelo formato/prefixo da chave. Depender do prefixo
// (gsk_, sk-...) e fragil porque chaves DeepSeek podem coincidir com o
// padrao "sk-" da OpenAI e serem classificadas incorretamente.
// Prioridade quando mais de uma estiver definida: Groq > DeepSeek > OpenAI.
// -----------------------------------------------------------------------
let apiKey;
let baseURL;
let model;
let provider;

if (process.env.GROQ_API_KEY) {
  provider = 'Groq';
  apiKey = process.env.GROQ_API_KEY;
  baseURL = 'https://api.groq.com/openai/v1';
  model = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
} else if (process.env.DEEPSEEK_API_KEY) {
  provider = 'DeepSeek';
  apiKey = process.env.DEEPSEEK_API_KEY;
  baseURL = 'https://api.deepseek.com/v1';
  model = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
} else if (process.env.OPENAI_API_KEY) {
  provider = 'OpenAI';
  apiKey = process.env.OPENAI_API_KEY;
  baseURL = 'https://api.openai.com/v1';
  model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
}

if (!apiKey) {
  console.error('[agent] Nenhuma chave de API encontrada.');
  console.error('[agent] Defina GROQ_API_KEY, DEEPSEEK_API_KEY ou OPENAI_API_KEY no arquivo .env');
  process.exit(1);
}

console.log(`[agent] Provedor detectado: ${provider} (via nome da variavel de ambiente)`);
console.log(`[agent] Modelo principal: ${model}`);

// Timeout evita que uma chamada travada no provedor de IA prenda a
// conexao HTTP do cliente indefinidamente.
const REQUEST_TIMEOUT_MS = Number(process.env.AI_REQUEST_TIMEOUT_MS) || 25000;

const client = new OpenAI({ apiKey, baseURL, timeout: REQUEST_TIMEOUT_MS, maxRetries: 1 });

// Modelos alternativos, usados apenas quando o provedor e Groq
const FALLBACK_MODELS = provider === 'Groq'
  ? ['openai/gpt-oss-20b'].filter(m => m !== model)
  : [];

// MAX_TOOL_ROUNDS com folga: mesmo quando o modelo insiste em confirmar
// bit a bit via ferramentas (comportamento observado no gpt-oss-120b via
// Groq, que tende a emitir uma chamada de ferramenta por rodada), ainda
// sobra espaco para produzir a resposta final antes do teto.
const MAX_TOOL_ROUNDS = 8;

// Limites de historico controlados pelo SERVIDOR. O cliente nao decide
// quanto contexto entra no prompt: isso reduz custo, degradacao de
// performance e a superficie de prompt injection via historico forjado.
const MAX_HISTORY_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 4000;

function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter(msg => msg && typeof msg.content === 'string' && (msg.role === 'user' || msg.role === 'bot' || msg.role === 'assistant'))
    .slice(-MAX_HISTORY_MESSAGES)
    .map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: String(msg.content).slice(0, MAX_MESSAGE_LENGTH)
    }));
}

function buildMessages(systemPrompt, history, userMessage, evidence) {
  const safeHistory = sanitizeHistory(history);
  const messages = [{ role: 'system', content: systemPrompt }];

  if (evidence && evidence.text) {
    // Injetada como mensagem de sistema separada: tem precedencia sobre
    // qualquer instrucao vinda do texto do usuario ou do historico.
    messages.push({ role: 'system', content: evidence.text });
  }

  messages.push(...safeHistory);
  messages.push({ role: 'user', content: userMessage });
  return messages;
}

async function runConversation(modelName, messages) {
  const usedTools = [];
  let currentMessages = [...messages];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const isLastRound = round === MAX_TOOL_ROUNDS - 1;
    const response = await client.chat.completions.create({
      model: modelName,
      messages: currentMessages,
      tools,
      // Na ultima rodada disponivel, proibimos nova chamada de ferramenta
      // e forcamos o modelo a responder com o que ja foi apurado ate
      // aqui. Isso evita jogar fora todo o trabalho das rodadas
      // anteriores so porque o modelo insistiu em confirmar mais um bit.
      tool_choice: isLastRound ? 'none' : 'auto',
      temperature: 0.3,
      max_tokens: 2048
    });

    const choice = response.choices[0];
    const assistantMessage = choice.message;

    const toolCalls = assistantMessage.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      const content = assistantMessage.content;
      if (!content) {
        throw new Error('Resposta vazia do modelo.');
      }
      return { content, usedTools };
    }

    currentMessages.push(assistantMessage);

    for (const call of toolCalls) {
      let args = {};
      try {
        args = JSON.parse(call.function.arguments || '{}');
      } catch (err) {
        args = {};
      }
      const result = await executeToolCall(call.function.name, args);
      usedTools.push({ name: call.function.name, args, result });
      currentMessages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(result)
      });
    }
  }

  throw new Error('Numero maximo de chamadas de ferramenta excedido.');
}

async function askAgent(history, userMessage, context) {
  if (!userMessage || typeof userMessage !== 'string' || userMessage.trim().length === 0) {
    throw new Error('Mensagem do usuario e obrigatoria.');
  }

  const { mode, message } = detectMode(userMessage);
  const systemPrompt = buildSystemPrompt(mode);

  // Evidencia deterministica: se o tecnico preencheu Dword/Hex e
  // selecionou um cartao (modulo, incluindo os de comunicacao
  // CI801/CI854/CI868/CI873), decodificamos aqui, no backend, antes de
  // falar com o LLM. O agente "reconhece" o cartao porque o dado ja
  // chega pronto e confirmado, nao porque o modelo decidiu chamar uma
  // ferramenta.
  const evidence = buildEvidenceFromContext(context);

  const messages = buildMessages(systemPrompt, history, message, evidence);

  const modelsToTry = [model, ...FALLBACK_MODELS];
  let lastError = null;

  for (const modelName of modelsToTry) {
    try {
      console.log(`[agent] Tentando modelo: ${modelName}`);
      const { content, usedTools } = await runConversation(modelName, messages);
      return {
        response: content,
        mode: mode || null,
        modeLabel: mode ? MODES[mode].label : null,
        toolsUsed: usedTools.map(t => t.name),
        evidence: evidence
          ? { module: evidence.moduleType, hex: evidence.hex, isCommunicationModule: evidence.isCommunicationModule, stats: evidence.stats }
          : null
      };
    } catch (err) {
      lastError = err;
      console.warn(`[agent] Falha com modelo ${modelName}: ${err.message}`);
      const status = err.status || err.statusCode;
      if (status !== 404 && status !== 400 && status !== 401) {
        break;
      }
    }
  }

  throw new Error(`Falha na comunicacao com o servico de IA: ${lastError ? lastError.message : 'nenhum modelo disponivel'}`);
}

module.exports = { askAgent, MODES };
