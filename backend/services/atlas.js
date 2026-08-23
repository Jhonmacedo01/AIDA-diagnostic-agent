const fs = require('fs');
const path = require('path');

const modulesPath = path.join(__dirname, '../knowledge/modules.json');
const systemReferencePath = path.join(__dirname, '../knowledge/system-reference.json');
let MODULES_CACHE = null;
let cacheTimestamp = 0;
let SYSTEM_REFERENCE_CACHE = null;
let systemReferenceTimestamp = 0;
const CACHE_TTL = 60000;

function loadModules(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && MODULES_CACHE && (now - cacheTimestamp) < CACHE_TTL) {
    return MODULES_CACHE;
  }

  try {
    console.log('[atlas] Carregando modules.json');
    const raw = fs.readFileSync(modulesPath, 'utf8');
    MODULES_CACHE = JSON.parse(raw);
    cacheTimestamp = now;
    console.log(`[atlas] ${Object.keys(MODULES_CACHE).length} modulos carregados`);
    return MODULES_CACHE;
  } catch (err) {
    console.error('[atlas] Erro ao carregar modules.json:', err.message);
    MODULES_CACHE = {};
    cacheTimestamp = now;
    return MODULES_CACHE;
  }
}

function getModuleBits(moduleType) {
  if (!moduleType || typeof moduleType !== 'string') {
    return null;
  }
  const MODULES = loadModules();
  const specific = MODULES[moduleType];
  if (!specific) return null;

  const base = { ...MODULES.GENERAL, ...MODULES.EXTENDED };
  for (const [key, value] of Object.entries(specific)) {
    if (value !== null && typeof value === 'object') {
      base[key] = value;
    }
  }
  return base;
}

function getBitDefinition(moduleType, bit) {
  const bits = getModuleBits(moduleType);
  if (!bits) return null;
  const bitKey = String(bit);
  return bits[bitKey] || null;
}

function searchAtlas(moduleType, term) {
  const bits = getModuleBits(moduleType);
  if (!bits) return [];
  if (!term || typeof term !== 'string' || term.trim().length === 0) {
    return [];
  }
  const lowerTerm = term.toLowerCase().trim();
  const results = [];
  for (const [bitKey, def] of Object.entries(bits)) {
    if (!def) continue;
    const descMatch = def.desc && def.desc.toLowerCase().includes(lowerTerm);
    const ptMatch = def.pt && def.pt.toLowerCase().includes(lowerTerm);
    if (descMatch || ptMatch) {
      results.push({
        bit: parseInt(bitKey, 10),
        status: def.status || 'Unknown',
        severity: def.severity || 'Low',
        desc: def.desc || '',
        pt: def.pt || ''
      });
    }
  }
  return results.sort((a, b) => a.bit - b.bit);
}

function listModules() {
  const MODULES = loadModules();
  return Object.keys(MODULES).filter(k => k !== 'GENERAL' && k !== 'EXTENDED');
}

// ===== Referencia geral do sistema 800xA / AC 800M =====
// Base de conhecimento paralela ao atlas de bits: conceitos de arquitetura,
// topologia, redundancia, hardware do controlador, diagnostico, comunicacao
// e backup, extraidos da apostila de treinamento ABB T315C.
function loadSystemReference(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && SYSTEM_REFERENCE_CACHE && (now - systemReferenceTimestamp) < CACHE_TTL) {
    return SYSTEM_REFERENCE_CACHE;
  }
  try {
    console.log('[atlas] Carregando system-reference.json');
    const raw = fs.readFileSync(systemReferencePath, 'utf8');
    SYSTEM_REFERENCE_CACHE = JSON.parse(raw);
    systemReferenceTimestamp = now;
    return SYSTEM_REFERENCE_CACHE;
  } catch (err) {
    console.error('[atlas] Erro ao carregar system-reference.json:', err.message);
    SYSTEM_REFERENCE_CACHE = {};
    systemReferenceTimestamp = now;
    return SYSTEM_REFERENCE_CACHE;
  }
}

function listReferenceCategories() {
  const ref = loadSystemReference();
  return Object.keys(ref).map(key => ({
    key,
    title: ref[key].title || key,
    count: Array.isArray(ref[key].items) ? ref[key].items.length : 0
  }));
}

function getSystemReference(categoryKey) {
  const ref = loadSystemReference();
  if (!categoryKey) return ref;
  return ref[categoryKey] || null;
}

function searchSystemReference(term) {
  if (!term || typeof term !== 'string' || term.trim().length === 0) {
    return [];
  }
  const lowerTerm = term.toLowerCase().trim();
  const ref = loadSystemReference();
  const results = [];
  for (const [categoryKey, category] of Object.entries(ref)) {
    for (const item of category.items || []) {
      const titleMatch = item.title && item.title.toLowerCase().includes(lowerTerm);
      const textMatch = item.pt && item.pt.toLowerCase().includes(lowerTerm);
      if (titleMatch || textMatch) {
        results.push({ category: categoryKey, categoryTitle: category.title, ...item });
      }
    }
  }
  return results;
}

module.exports = {
  getModuleBits,
  getBitDefinition,
  searchAtlas,
  listModules,
  loadModules,
  loadSystemReference,
  listReferenceCategories,
  getSystemReference,
  searchSystemReference
};
