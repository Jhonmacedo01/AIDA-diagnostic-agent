// -----------------------------------------------------------------------
// Camada de evidencia deterministica.
//
// Objetivo: quando o frontend informa que o tecnico ja preencheu um
// Dword/Hexadecimal valido e selecionou um cartao (modulo), o backend
// decodifica esse valor com o decoder real ANTES de falar com o LLM, e
// injeta o resultado como fato confirmado na conversa. Isso remove a
// decisao "devo decodificar ou nao" das maos do modelo (tool_choice
// "auto" nao garante a chamada da ferramenta) e faz o agente reconhecer
// o cartao de comunicacao (CI801/CI854/CI868/CI873) e o codigo
// preenchido de forma imediata e correta.
// -----------------------------------------------------------------------

const { interpret } = require('../services/decoder');
const atlas = require('../services/atlas');

const COMMUNICATION_MODULES = new Set(['CI801', 'CI854', 'CI868', 'CI873']);

function normalizeHexValue(hex) {
  if (!hex || typeof hex !== 'string') return null;
  const clean = hex.replace(/^(0x|16#)/i, '').trim();
  if (!/^[0-9A-Fa-f]{1,8}$/.test(clean)) return null;
  return clean.padStart(8, '0').toUpperCase();
}

function isCommunicationModule(moduleType) {
  return typeof moduleType === 'string' && COMMUNICATION_MODULES.has(moduleType.toUpperCase());
}

/**
 * Constroi um bloco de evidencia textual, determinado 100% pelo decoder e
 * pelo atlas (nunca pelo LLM), a partir do contexto enviado pelo
 * frontend: { module, hex }.
 *
 * Retorna null se nao houver contexto valido (nada a fazer).
 */
function buildEvidenceFromContext(context) {
  if (!context || typeof context !== 'object') return null;

  const moduleType = typeof context.module === 'string' ? context.module.toUpperCase() : null;
  const cleanHex = normalizeHexValue(context.hex);

  if (!moduleType || !cleanHex) return null;

  const moduleBits = atlas.getModuleBits(moduleType);
  if (!moduleBits) {
    return {
      moduleType,
      hex: cleanHex,
      isCommunicationModule: isCommunicationModule(moduleType),
      text: `EVIDENCIA CONFIRMADA (decoder deterministico, nao e opiniao do modelo):\nModulo "${moduleType}" nao encontrado no atlas de conhecimento. Nao decodifique este codigo de memoria, informe ao tecnico que o modulo nao esta mapeado.`
    };
  }

  const result = interpret(moduleType, cleanHex);
  const comm = isCommunicationModule(moduleType);

  const bitLines = result.interpreted.length
    ? result.interpreted
        .map(b => `- Bit ${String(b.position).padStart(2, '0')}: ${b.status} (${b.severity}) - ${b.pt || b.desc}`)
        .join('\n')
    : '- Nenhum bit ativo neste codigo.';

  const activeBitPositions = result.interpreted.map(b => b.position);
  const bitListLabel = activeBitPositions.length
    ? activeBitPositions.map(p => String(p).padStart(2, '0')).join(', ')
    : 'nenhum';

  const text = `EVIDENCIA CONFIRMADA (decoder deterministico, nao e opiniao do modelo):
Modulo selecionado no cartao: ${moduleType}${comm ? ' (cartao de comunicacao)' : ''}
Codigo informado: Dword ${result.dword} | Hex ${result.hex} | Decimal ${result.decimal} | Binario ${result.binary}
Bits ativos (${result.interpreted.length}):
${bitLines}
Resumo: ${result.stats.errors} erro(s), ${result.stats.warnings} alerta(s), ${result.stats.info} informativo(s), ${result.stats.unknown} nao mapeado(s).

Instrucao: os dados acima (status, severidade e descricao de cada bit, e as estatisticas de severidade) ja foram obtidos deterministicamente pelas ferramentas decode_hex e analyze_severity para o modulo ${moduleType} e o codigo ${result.dword}. NAO chame decode_hex, analyze_severity ou get_bit_definition novamente para os bits ${bitListLabel} deste mesmo modulo e codigo: isso so desperdicaria rodadas de ferramenta sem trazer informacao nova. Use os dados acima diretamente na sua analise. So chame uma ferramenta se precisar de algo que nao esta listado aqui, por exemplo detalhes de outro modulo, busca por termo no atlas, ou informacoes gerais do modulo.`;

  return {
    moduleType,
    hex: result.hex,
    isCommunicationModule: comm,
    stats: result.stats,
    text
  };
}

module.exports = { buildEvidenceFromContext, isCommunicationModule, normalizeHexValue, COMMUNICATION_MODULES };
