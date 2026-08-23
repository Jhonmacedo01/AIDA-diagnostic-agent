// ============================================
// AIDA - Aplicacao Frontend
// ============================================

const API_BASE = '/api';

// Referencias DOM
const moduleSelect = document.getElementById('moduleSelect');
const hexInput = document.getElementById('hexInput');
const decodeBtn = document.getElementById('decodeBtn');
const clearBtn = document.getElementById('clearBtn');
const pasteBtn = document.getElementById('pasteBtn');
const helperText = document.getElementById('helperText');
const placeholder = document.getElementById('placeholder');
const resultContent = document.getElementById('resultContent');
const resultSummary = document.getElementById('resultSummary');
const resultTableBody = document.getElementById('resultTableBody');
const conversionStrip = document.getElementById('conversionStrip');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
const clearAllBtn = document.getElementById('clearAllBtn');
const atlasContent = document.getElementById('atlasContent');
const themeToggle = document.getElementById('themeToggle');
const themeIconMoon = document.getElementById('themeIconMoon');
const themeIconSun = document.getElementById('themeIconSun');
const faviconLink = document.getElementById('faviconLink');
const contextChip = document.getElementById('contextChip');
const contextChipText = document.getElementById('contextChipText');
const navLinks = document.querySelectorAll('.nav-link');
const modeRow = document.getElementById('modeRow');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');

// ===== MODULOS =====
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

// ===== MODULOS DE COMUNICACAO =====
// Usados para reconhecer, no chat, quando o "cartao" selecionado no
// decodificador e um modulo de comunicacao (PROFIBUS, IEC 61850,
// EtherNet/IP), e destacar isso para o tecnico.
const COMMUNICATION_MODULES = new Set(['CI801', 'CI854', 'CI868', 'CI873']);

// ===== TEMA =====
const FAVICONS = { dark: 'assets/favicon.svg', light: 'assets/favicon-light.svg' };
function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  if (faviconLink) {
    faviconLink.setAttribute('href', FAVICONS[theme] || FAVICONS.dark);
  }
}
function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  setTheme(current === 'dark' ? 'light' : 'dark');
}
const savedTheme = localStorage.getItem('theme') || 'dark';
setTheme(savedTheme);
themeToggle.addEventListener('click', toggleTheme);

// ===== STATUS DA API =====
async function checkStatus() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    const data = await res.json();
    const online = res.ok && data.api === 'configured';
    statusDot.classList.toggle('offline', !online);
    statusText.textContent = online ? 'Online' : 'Sem chave de API';
  } catch {
    statusDot.classList.add('offline');
    statusText.textContent = 'Offline';
  }
}
checkStatus();

// ===== POPULAR SELECT DE MODULOS =====
function populateModuleSelect() {
  const groups = {
    'Analogicos, entrada': ['AI810', 'AI820', 'AI845'],
    'Analogicos, saida': ['AO810', 'AO820'],
    'Digitais, entrada': ['DI810', 'DI820'],
    'Digitais, saida': ['DO810', 'DO820'],
    'Comunicacao': ['CI801', 'CI854', 'CI868', 'CI873']
  };
  let html = '';
  for (const [label, modules] of Object.entries(groups)) {
    html += `<optgroup label="${label}">`;
    for (const mod of modules) {
      html += `<option value="${mod}">${MODULE_NAMES[mod]}</option>`;
    }
    html += `</optgroup>`;
  }
  moduleSelect.innerHTML = html;
}
populateModuleSelect();

// ===== NAVEGACAO =====
navLinks.forEach(link => {
  link.addEventListener('click', (e) => {
    navLinks.forEach(l => l.classList.remove('active'));
    link.classList.add('active');
    const target = document.querySelector(link.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const id = entry.target.getAttribute('id');
      navLinks.forEach(l => l.classList.toggle('active', l.dataset.section === id));
    }
  });
}, { rootMargin: '-40% 0px -50% 0px' });
document.querySelectorAll('.panel-section').forEach(section => sectionObserver.observe(section));

// ===== VALIDACAO HEX =====
function validateHex(value) {
  const clean = value.replace(/^(0x|16#)/i, '').trim();
  const ok = /^[0-9A-Fa-f]{1,8}$/.test(clean);
  if (ok) {
    helperText.textContent = 'Formato valido.';
    helperText.className = 'helper';
  } else if (value.trim() !== '') {
    helperText.textContent = 'Use ate 8 caracteres hexadecimais.';
    helperText.className = 'helper error';
  } else {
    helperText.textContent = 'Exemplo: 16#00000014';
    helperText.className = 'helper';
  }
  return ok;
}
function parseHex(value) {
  const clean = value.replace(/^(0x|16#)/i, '').trim();
  if (!/^[0-9A-Fa-f]{1,8}$/.test(clean)) return null;
  return clean.padStart(8, '0').toUpperCase();
}

// ===== DECODIFICACAO =====
async function decode() {
  const moduleKey = moduleSelect.value;
  const raw = hexInput.value;
  if (!validateHex(raw)) return;
  const hexValid = parseHex(raw);
  if (!hexValid) {
    helperText.textContent = 'Codigo invalido.';
    helperText.className = 'helper error';
    return;
  }

  decodeBtn.disabled = true;
  decodeBtn.textContent = 'Decodificando';

  try {
    const res = await fetch(`${API_BASE}/decode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ module: moduleKey, hex: hexValid })
    });
    if (!res.ok) throw new Error('Erro na decodificacao');
    const data = await res.json();

    placeholder.style.display = 'none';
    resultContent.style.display = 'block';

    const name = MODULE_NAMES[moduleKey] || moduleKey;
    const statusClass = data.hasError ? 'badge-error' : data.hasWarning ? 'badge-warn' : 'badge-ok';
    const statusLabel = data.hasError ? 'Erro detectado' : data.hasWarning ? 'Alerta detectado' : 'Operando normalmente';

    resultSummary.innerHTML = `
      <div class="summary-item"><span class="label">Modulo</span><span class="value">${name}</span></div>
      <div class="summary-item"><span class="label">Codigo</span><span class="value mono">16#${data.hex}</span></div>
      <div class="summary-item"><span class="label">Status</span><span class="badge ${statusClass}">${statusLabel}</span></div>
      <div class="summary-item"><span class="label">Bits ativos</span><span class="value">${data.interpreted.length}</span></div>
    `;

    resultTableBody.innerHTML = '';
    if (data.interpreted.length === 0) {
      resultTableBody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--text-muted);">Nenhum bit ativo neste codigo.</td></tr>`;
    } else {
      for (const bit of data.interpreted) {
        const rowClass = bit.status === 'Error' ? 'row-error' : bit.status === 'Warning' ? 'row-warning' : 'row-ok';
        const sevClass = bit.severity === 'High' ? 'severity-high' : bit.severity === 'Medium' ? 'severity-medium' : 'severity-low';
        const tr = document.createElement('tr');
        tr.className = rowClass;
        tr.innerHTML = `
          <td><span class="bit-badge">${String(bit.position).padStart(2, '0')}</span></td>
          <td><span class="${sevClass}">${bit.severity}</span></td>
          <td>${bit.status}</td>
          <td><span class="desc-pt">${bit.pt || bit.desc}</span><span class="desc-en">${bit.desc}</span></td>
        `;
        resultTableBody.appendChild(tr);
      }
    }

    conversionStrip.innerHTML = `
      <div class="conv-item"><span class="conv-label">Hex</span><span class="conv-value">${data.hex}</span></div>
      <div class="conv-item"><span class="conv-label">Dword</span><span class="conv-value">${data.dword}</span></div>
      <div class="conv-item"><span class="conv-label">Decimal</span><span class="conv-value">${data.decimal}</span></div>
      <div class="conv-item"><span class="conv-label">Binario</span><span class="conv-value">${data.binary}</span></div>
    `;

  } catch (error) {
    alert('Erro ao decodificar: ' + error.message);
  } finally {
    decodeBtn.disabled = false;
    decodeBtn.textContent = 'Decodificar';
  }
}

// ===== CONTEXTO DO DECODIFICADOR PARA O AGENTE =====
// Sempre que o modulo (cartao) e o Dword/Hexadecimal estiverem
// preenchidos e validos, o agente deve reconhecer isso automaticamente
// ao conversar, sem que o tecnico precise redigitar o codigo no chat.
// Esse estado e enviado junto de cada mensagem em sendMessage().
function getDecoderContext() {
  const moduleKey = moduleSelect.value;
  const hex = parseHex(hexInput.value);
  if (!moduleKey || !hex) return null;
  return {
    module: moduleKey,
    hex,
    dword: `16#${hex}`,
    isCommModule: COMMUNICATION_MODULES.has(moduleKey)
  };
}

function updateContextChip() {
  const ctx = getDecoderContext();
  if (!ctx) {
    contextChip.style.display = 'none';
    return;
  }
  const name = MODULE_NAMES[ctx.module] || ctx.module;
  contextChip.style.display = 'flex';
  contextChip.classList.toggle('comm', ctx.isCommModule);
  contextChipText.textContent = ctx.isCommModule
    ? `Cartao de comunicacao reconhecido: ${name} · ${ctx.dword}`
    : `Contexto reconhecido: ${name} · ${ctx.dword}`;
}

// ===== CHAT =====
let chatHistory = [];
let isProcessing = false;

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatMessage(text) {
  let safe = escapeHtml(text);
  safe = safe
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
  return safe;
}

function addMessage(role, text, options = {}) {
  const { isError = false, modeLabel = null, evidence = null } = options;
  const wrapper = document.createElement('div');
  wrapper.className = `message ${role}`;
  if (isError) wrapper.classList.add('error');

  const avatar = document.createElement('span');
  avatar.className = 'avatar';
  avatar.textContent = role === 'bot' ? 'AI' : 'VC';
  wrapper.appendChild(avatar);

  const body = document.createElement('div');
  body.className = 'message-body';

  if (modeLabel) {
    const tag = document.createElement('span');
    tag.className = 'mode-tag';
    tag.textContent = modeLabel;
    body.appendChild(tag);
  }

  if (evidence && evidence.module) {
    const tag = document.createElement('span');
    tag.className = 'mode-tag evidence-tag';
    const name = MODULE_NAMES[evidence.module] || evidence.module;
    tag.textContent = evidence.isCommunicationModule
      ? `Cartao de comunicacao decodificado: ${name} 16#${evidence.hex}`
      : `Decodificado: ${name} 16#${evidence.hex}`;
    body.appendChild(tag);
  }

  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.innerHTML = formatMessage(text);
  body.appendChild(bubble);

  const ts = document.createElement('span');
  ts.className = 'timestamp';
  ts.textContent = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  body.appendChild(ts);

  wrapper.appendChild(body);
  chatMessages.appendChild(wrapper);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function showTyping() {
  const div = document.createElement('div');
  div.className = 'typing-indicator';
  div.id = 'typingIndicator';
  div.innerHTML = '<span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span>';
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}
function hideTyping() {
  const el = document.getElementById('typingIndicator');
  if (el) el.remove();
}

async function sendMessage() {
  if (isProcessing) return;
  const message = chatInput.value.trim();
  if (!message) return;

  isProcessing = true;
  addMessage('user', message);
  chatInput.value = '';
  chatInput.disabled = true;
  sendBtn.disabled = true;

  showTyping();

  try {
    const context = getDecoderContext();
    const res = await fetch(`${API_BASE}/diagnose`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history: chatHistory, context })
    });
    if (!res.ok) throw new Error('Erro no agente');

    const data = await res.json();
    hideTyping();
    addMessage('bot', data.response, { modeLabel: data.modeLabel, evidence: data.evidence });
    chatHistory.push({ role: 'user', content: message });
    chatHistory.push({ role: 'bot', content: data.response });

  } catch (error) {
    hideTyping();
    addMessage('bot', 'Nao foi possivel obter resposta do agente: ' + error.message, { isError: true });
  } finally {
    isProcessing = false;
    chatInput.disabled = false;
    sendBtn.disabled = false;
    chatInput.focus();
  }
}

function clearChat() {
  chatMessages.innerHTML = '';
  chatHistory = [];
  isProcessing = false;
  addMessage('bot', 'Ola. Sou o AIDA, agente de diagnostico para sistemas ABB 800xA. Informe um modulo e um codigo, ou selecione um modo de analise acima.');
}

// ===== MODOS DE ANALISE =====
modeRow.querySelectorAll('.mode-chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const mode = chip.dataset.mode;
    const prefix = `/${mode} `;
    const current = chatInput.value.trim();
    const withoutPrefix = current.replace(/^\/(EXPERT|CRITIC|DEEP|RISK)\s*/i, '');
    chatInput.value = prefix + withoutPrefix;
    chatInput.focus();
    modeRow.querySelectorAll('.mode-chip').forEach(c => c.classList.toggle('active', c === chip));
  });
});

// ===== ATLAS =====
async function loadAtlas() {
  const groups = {
    analog: ['AI810', 'AI820', 'AI845', 'AO810', 'AO820'],
    digital: ['DI810', 'DI820', 'DO810', 'DO820'],
    comms: ['CI801', 'CI854', 'CI868', 'CI873']
  };

  let html = '';
  for (const [groupKey, modules] of Object.entries(groups)) {
    html += `<div class="atlas-grid" data-group="${groupKey}">`;
    for (const mod of modules) {
      const bits = await fetchAtlasModule(mod);
      if (!bits) continue;
      const rows = Object.entries(bits)
        .filter(([, def]) => def !== null)
        .sort((a, b) => parseInt(a[0], 10) - parseInt(b[0], 10))
        .map(([bit, def]) => {
          const cls = def.status === 'Error' ? 'badge-error'
            : def.status === 'Warning' ? 'badge-warn'
            : (def.status === 'Info' || def.status === 'Event') ? 'badge-info'
            : 'badge-ok';
          return `<tr><td>${String(bit).padStart(2, '0')}</td><td><span class="status-badge ${cls}">${def.status}</span></td><td>${def.desc}</td></tr>`;
        }).join('');
      if (rows) {
        html += `
          <div class="atlas-card">
            <div class="card-header"><h4>${MODULE_NAMES[mod]}</h4><span>${Object.keys(bits).length} bits</span></div>
            <div class="card-body">
              <table class="bit-table">
                <thead><tr><th>Bit</th><th>Status</th><th>Descricao</th></tr></thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
          </div>
        `;
      }
    }
    html += `</div>`;
  }

  atlasContent.innerHTML = html;
  await loadSystemReference();
  showAtlasTab('analog');
}

async function loadSystemReference() {
  try {
    const res = await fetch(`${API_BASE}/atlas/system-reference`);
    if (!res.ok) return;
    const data = await res.json();
    const categories = data.reference || {};

    let html = `<div class="atlas-grid ref-grid" data-group="system">`;
    for (const [key, category] of Object.entries(categories)) {
      const items = (category.items || []).map(item => `
        <div class="ref-item">
          <h5 class="ref-item-title">${item.title}</h5>
          <p class="ref-item-text">${item.pt}</p>
        </div>
      `).join('');
      html += `
        <div class="atlas-card ref-card">
          <div class="card-header"><h4>${category.title || key}</h4><span>${(category.items || []).length} itens</span></div>
          <div class="card-body ref-card-body">${items}</div>
        </div>
      `;
    }
    html += `</div>`;
    atlasContent.insertAdjacentHTML('beforeend', html);
  } catch {
    // Referencia geral e um complemento opcional; falha aqui nao deve travar o atlas de bits.
  }
}

async function fetchAtlasModule(module) {
  try {
    const res = await fetch(`${API_BASE}/atlas/${module}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function showAtlasTab(tabId) {
  document.querySelectorAll('.atlas-grid').forEach(el => { el.style.display = 'none'; });
  const target = document.querySelector(`.atlas-grid[data-group="${tabId}"]`);
  if (target) target.style.display = 'grid';
}

// ===== EVENTOS =====
decodeBtn.addEventListener('click', decode);
hexInput.addEventListener('input', () => { validateHex(hexInput.value); updateContextChip(); });
hexInput.addEventListener('keypress', e => { if (e.key === 'Enter') decode(); });
moduleSelect.addEventListener('change', updateContextChip);

clearBtn.addEventListener('click', () => {
  hexInput.value = '00000000';
  helperText.textContent = 'Exemplo: 16#00000014';
  helperText.className = 'helper';
  placeholder.style.display = 'flex';
  resultContent.style.display = 'none';
  updateContextChip();
});

pasteBtn.addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    hexInput.value = text.replace(/^(0x|16#)/i, '').trim();
    validateHex(hexInput.value);
    updateContextChip();
  } catch {
    alert('Nao foi possivel acessar a area de transferencia.');
  }
});

sendBtn.addEventListener('click', sendMessage);
chatInput.addEventListener('keypress', e => { if (e.key === 'Enter') sendMessage(); });
clearAllBtn.addEventListener('click', clearChat);

document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
    showAtlasTab(btn.dataset.tab);
  });
});

// ===== INICIALIZACAO =====
clearChat();
loadAtlas();
updateContextChip();
