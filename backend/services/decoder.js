const atlasService = require('./atlas');

function decodeHex(hexValue) {
  const clean = hexValue.replace(/^(0x|16#)/i, '').padStart(8, '0').slice(-8);
  const dec = parseInt(clean, 16);
  const bin = dec.toString(2).padStart(32, '0');
  const bits = [];
  for (let i = 0; i < bin.length; i++) {
    if (bin[i] === '1') {
      bits.push({ position: 31 - i, weight: Math.pow(2, 31 - i) });
    }
  }
  return {
    hex: clean.toUpperCase(),
    dword: `16#${clean.toUpperCase()}`,
    decimal: dec,
    binary: bin.match(/.{1,4}/g).join(' '),
    rawBinary: bin,
    bits
  };
}

function interpret(moduleType, hexValue) {
  const decoded = decodeHex(hexValue);
  const bitsDef = atlasService.getModuleBits(moduleType) || {};
  const interpreted = decoded.bits
    .map(b => {
      const entry = bitsDef[b.position] || { status: 'Unknown', severity: 'Low', desc: 'Unmapped bit', pt: 'Bit nao mapeado' };
      return { ...b, status: entry.status, severity: entry.severity, desc: entry.desc, pt: entry.pt };
    })
    .sort((a, b) => a.position - b.position);

  const stats = {
    total: interpreted.length,
    errors: interpreted.filter(x => x.status === 'Error').length,
    warnings: interpreted.filter(x => x.status === 'Warning').length,
    info: interpreted.filter(x => x.status === 'Info' || x.status === 'Event').length,
    unknown: interpreted.filter(x => x.status === 'Unknown').length
  };

  return {
    ...decoded,
    module: moduleType,
    interpreted,
    stats,
    hasError: stats.errors > 0,
    hasWarning: stats.warnings > 0
  };
}

module.exports = { decodeHex, interpret };
