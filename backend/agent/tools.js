const { interpret } = require('../services/decoder');
const atlas = require('../services/atlas');

const MODULE_NAMES = {
  AI810: 'AI810: Entrada Analogica (8 canais)',
  AI820: 'AI820: Entrada Analogica (4 canais)',
  AI845: 'AI845: Entrada Analogica HART (8 canais)',
  AO810: 'AO810: Saida Analogica (8 canais)',
  AO820: 'AO820: Saida Analogica (4 canais)',
  DI810: 'DI810: Entrada Digital (16 canais)',
  DI820: 'DI820: Entrada Digital (8 canais)',
  DO810: 'DO810: Saida Digital (16 canais)',
  DO820: 'DO820: Saida Digital (8 canais)',
  CI801: 'CI801: PROFIBUS DP (Escravo)',
  CI854: 'CI854: PROFIBUS DP (Mestre)',
  CI868: 'CI868: IEC 61850',
  CI873: 'CI873: EtherNet/IP'
};

// Definicoes de ferramentas no formato de function calling compativel com OpenAI/Groq
const tools = [
  {
    type: 'function',
    function: {
      name: 'decode_hex',
      description: 'Decodifica um codigo hexadecimal de 32 bits de um modulo ABB S800 em DWORD, decimal, binario e lista de bits ativos com status, severidade e descricao.',
      parameters: {
        type: 'object',
        properties: {
          module: { type: 'string', description: 'Tipo do modulo, por exemplo AI810, DO820, CI854' },
          hex: { type: 'string', description: 'Codigo hexadecimal, por exemplo 00000014' }
        },
        required: ['module', 'hex']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_bit_definition',
      description: 'Retorna a definicao de um bit especifico de um modulo, incluindo status, severidade e descricao em ingles e portugues.',
      parameters: {
        type: 'object',
        properties: {
          module: { type: 'string' },
          bit: { type: 'integer', description: 'Posicao do bit, de 0 a 31' }
        },
        required: ['module', 'bit']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'search_atlas',
      description: 'Busca no atlas de um modulo por bits cuja descricao contenha um termo, por exemplo watchdog, profibus ou falha.',
      parameters: {
        type: 'object',
        properties: {
          module: { type: 'string' },
          term: { type: 'string' }
        },
        required: ['module', 'term']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'analyze_severity',
      description: 'Analisa a severidade geral de um codigo hexadecimal, retornando contagem de erros, alertas e eventos.',
      parameters: {
        type: 'object',
        properties: {
          module: { type: 'string' },
          hex: { type: 'string' }
        },
        required: ['module', 'hex']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_module_info',
      description: 'Retorna informacoes gerais sobre um modulo, como nome completo e total de bits mapeados.',
      parameters: {
        type: 'object',
        properties: {
          module: { type: 'string' }
        },
        required: ['module']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_modules',
      description: 'Lista todos os modulos ABB S800 disponiveis no atlas de conhecimento.',
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_system_reference',
      description: 'Consulta a referencia geral de arquitetura do sistema ABB 800xA / AC 800M (topologia de servidores, redundancia, hardware do controlador, diagnostico via SystemDiagnostics, comunicacao/OPC UA, backup). Use quando a pergunta do tecnico for sobre conceitos do sistema, e nao sobre um codigo hexadecimal de um modulo S800.',
      parameters: {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'Categoria opcional: arquitetura, topologia, redundancia, hardware, diagnostico, comunicacao ou backup. Se omitido, retorna todas as categorias.' },
          term: { type: 'string', description: 'Termo de busca opcional dentro da referencia, por exemplo CEX-Bus, backup ou redundancia.' }
        }
      }
    }
  }
];

function normalizeHex(hex) {
  if (!hex || typeof hex !== 'string') {
    throw new Error('Parametro "hex" deve ser uma string hexadecimal.');
  }
  const clean = hex.replace(/^(0x|16#)/i, '').trim();
  if (!/^[0-9A-Fa-f]{1,8}$/.test(clean)) {
    throw new Error('Parametro "hex" deve conter ate 8 caracteres hexadecimais.');
  }
  return clean.padStart(8, '0').toUpperCase();
}

const toolHandlers = {
  decode_hex: async ({ module, hex }) => {
    if (!module || typeof module !== 'string') {
      throw new Error('Parametro "module" e obrigatorio.');
    }
    const cleanHex = normalizeHex(hex);
    const result = interpret(module, cleanHex);
    return {
      module,
      hex: result.hex,
      dword: result.dword,
      decimal: result.decimal,
      binary: result.binary,
      activeBits: result.interpreted.map(b => ({
        position: b.position,
        status: b.status,
        severity: b.severity,
        desc: b.desc,
        pt: b.pt
      })),
      stats: result.stats,
      hasError: result.hasError,
      hasWarning: result.hasWarning
    };
  },

  get_bit_definition: async ({ module, bit }) => {
    if (!module || typeof module !== 'string') {
      throw new Error('Parametro "module" e obrigatorio.');
    }
    if (bit === undefined || bit === null || Number.isNaN(Number(bit)) || bit < 0 || bit > 31) {
      throw new Error('Parametro "bit" deve ser um numero entre 0 e 31.');
    }
    const def = atlas.getBitDefinition(module, Number(bit));
    if (!def) {
      return { message: 'Bit nao mapeado para este modulo.' };
    }
    return { bit: Number(bit), ...def };
  },

  search_atlas: async ({ module, term }) => {
    if (!module || typeof module !== 'string') {
      throw new Error('Parametro "module" e obrigatorio.');
    }
    if (!term || typeof term !== 'string' || term.trim().length === 0) {
      throw new Error('Parametro "term" deve ser uma string nao vazia.');
    }
    return atlas.searchAtlas(module, term);
  },

  analyze_severity: async ({ module, hex }) => {
    if (!module || typeof module !== 'string') {
      throw new Error('Parametro "module" e obrigatorio.');
    }
    const cleanHex = normalizeHex(hex);
    const result = interpret(module, cleanHex);
    return {
      module,
      hasError: result.hasError,
      hasWarning: result.hasWarning,
      stats: result.stats,
      activeBitsCount: result.interpreted.length
    };
  },

  get_module_info: async ({ module }) => {
    if (!module || typeof module !== 'string') {
      throw new Error('Parametro "module" e obrigatorio.');
    }
    const name = MODULE_NAMES[module] || module;
    const bits = atlas.getModuleBits(module);
    if (!bits) {
      return { error: 'Modulo nao encontrado no atlas.' };
    }
    return { module, name, totalBits: Object.keys(bits).length };
  },

  list_modules: async () => {
    return { modules: atlas.listModules().map(m => ({ code: m, name: MODULE_NAMES[m] || m })) };
  },

  get_system_reference: async ({ category, term } = {}) => {
    if (term && typeof term === 'string' && term.trim().length > 0) {
      const results = atlas.searchSystemReference(term);
      return { term, results };
    }
    if (category && typeof category === 'string') {
      const data = atlas.getSystemReference(category);
      if (!data) {
        return { error: 'Categoria nao encontrada.', categories: atlas.listReferenceCategories().map(c => c.key) };
      }
      return { category, ...data };
    }
    return { categories: atlas.listReferenceCategories(), reference: atlas.getSystemReference() };
  }
};

async function executeToolCall(name, args) {
  console.log(`[tools] Executando ${name}`, args);
  if (!toolHandlers[name]) {
    const msg = `Tool "${name}" nao implementada`;
    console.warn(`[tools] ${msg}`);
    return { error: msg };
  }
  try {
    return await toolHandlers[name](args || {});
  } catch (error) {
    console.error(`[tools] Erro em ${name}:`, error.message);
    return { error: error.message };
  }
}

module.exports = { tools, executeToolCall, MODULE_NAMES };
