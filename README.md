AIDA — Agente Industrial de Diagnóstico ABB
https://img.shields.io/badge/license-MIT-blue.svg
https://img.shields.io/badge/node-%253E%253D18.0.0-brightgreen.svg
https://img.shields.io/badge/version-2.0.0-orange.svg

AIDA é uma aplicação web para diagnóstico de módulos ABB S800 e sistemas 800xA/AC 800M. Ela combina um decodificador determinístico de códigos hexadecimais de 32 bits com um agente de IA (Groq, DeepSeek ou OpenAI) que utiliza function calling para consultar a base de conhecimento real do sistema.

📌 Sumário
Funcionalidades
Tecnologias
Instalação
Configuração
Execução
Estrutura do Projeto
API
Como funciona o Agente
Modos de Análise
Segurança
Contribuição
Licença

🧩 Funcionalidades
Decodificador de códigos hexadecimais de 32 bits para módulos ABB S800 (AI810, DI810, CI854, etc.), listando bits ativos, severidade e descrição (PT/EN).

Agente de IA com ferramentas reais — utiliza function calling para consultar o atlas de bits (decode_hex, get_bit_definition, search_atlas, etc.) e a referência do sistema 800xA (get_system_reference).

Evidência determinística — quando o frontend envia um módulo e código válidos, o backend decodifica automaticamente antes de acionar o LLM, garantindo que o agente receba os fatos confirmados.

Quatro modos de análise: /EXPERT, /CRITIC, /DEEP e /RISK alteram o comportamento do agente (nível técnico, revisão crítica, causa raiz ou avaliação de risco).

Atlas de conhecimento — interface para consultar todos os bits mapeados por módulo e a referência geral do sistema 800xA.

Interface responsiva — tema escuro por padrão, com identidade visual industrial (moldura de canto, tipografia condensada) e opção de tema claro.

🛠️ Tecnologias
Backend: Node.js, Express, CORS, dotenv, OpenAI SDK (compatível com Groq/DeepSeek).

Frontend: HTML5, CSS3 (variáveis CSS, grid, animações), JavaScript puro (fetch API).

IA: OpenAI-compatible (Groq, DeepSeek, OpenAI) com suporte a function calling.

Dados: JSON estático (modules.json e system-reference.json).

📦 Instalação
bash
npm install
cp .env.example .env

⚙️ Configuração
Edite o arquivo .env e defina apenas uma chave de API:
Variável	Descrição	Modelo padrão
GROQ_API_KEY	Chave da Groq (começa com gsk_)	openai/gpt-oss-120b
OPENAI_API_KEY	Chave da OpenAI (começa com sk-)	gpt-4o-mini
DEEPSEEK_API_KEY	Chave da DeepSeek	deepseek-chat
Cada variável de modelo pode ser sobrescrita em .env:

GROQ_MODEL

OPENAI_MODEL

DEEPSEEK_MODEL

Exemplo de .env:
# Escolha apenas uma chave
GROQ_API_KEY=gsk_...
# OPENAI_API_KEY=sk-...
# DEEPSEEK_API_KEY=sk-...

# Opcional: sobrescrever modelo padrão
# GROQ_MODEL=openai/gpt-oss-20b
# OPENAI_MODEL=gpt-4o
# DEEPSEEK_MODEL=deepseek-reasoner

🚀 Execução
npm start                # produção
npm run dev              # desenvolvimento (reinício automático)
npm run list-models      # lista modelos ativos na conta Groq configurada

O servidor sobe em http://localhost:3000 (ou na porta definida em PORT).

📁 Estrutura do Projeto:
├── backend/
│   ├── server.js               # servidor Express e arquivos estáticos
│   ├── routes/
│   │   ├── decode.js           # rota POST /api/decode
│   │   ├── diagnose.js         # rota POST /api/diagnose
│   │   └── atlas.js            # rotas GET /api/atlas/*
│   ├── services/
│   │   ├── decoder.js          # decodificação de hex e interpretação de bits
│   │   └── atlas.js            # carregamento e consulta do atlas de módulos e referência do sistema
│   ├── agent/
│   │   ├── groq.js             # cliente do modelo, loop de function calling, fallback
│   │   ├── systemPrompt.js     # prompt base e os quatro modos de análise
│   │   ├── tools.js            # definição e execução das ferramentas do agente
│   │   └── evidence.js         # camada de evidência determinística (pré-decodificação)
│   ├── middleware/
│   │   └── rateLimiter.js      # rate limiting simples em memória
│   └── knowledge/
│       ├── modules.json        # base de bits por módulo S800
│       └── system-reference.json  # referência geral do sistema 800xA/AC 800M
└── frontend/
    ├── index.html
    ├── css/
    │   └── style.css
    ├── js/
    │   └── app.js
    └── assets/
        ├── favicon.svg
        ├── favicon-light.svg
        └── (outros assets)

        📡 API:
Método	Endpoint	Descrição
GET	/api/health	Verifica status da API e se há chave configurada
POST	/api/decode	Decodifica um código hexadecimal de um módulo
POST	/api/diagnose	Envia mensagem ao agente, com histórico e contexto opcional
GET	/api/atlas/system-reference	Retorna referência geral do sistema 800xA
GET	/api/atlas/system-reference/search/:term	Busca na referência geral
GET	/api/atlas/system-reference/:category	Retorna uma categoria específica da referência
GET	/api/atlas/:module	Retorna todos os bits de um módulo
GET	/api/atlas/:module/search/:term	Busca bits por termo no módulo

Exemplo de requisição /api/decode:

json
{
  "module": "CI854",
  "hex": "0000002B"
}

Exemplo de resposta:
json
{
  "hex": "0000002B",
  "dword": "16#0000002B",
  "decimal": 43,
  "binary": "0000 0000 0000 0000 0000 0000 0010 1011",
  "module": "CI854",
  "interpreted": [
    {
      "position": 0,
      "weight": 2147483648,
      "status": "Warning",
      "severity": "Medium",
      "desc": "Timeout on bus, duplicate slave address (TTO)",
      "pt": "Time-out no barramento, endereço duplicado"
    },
    ...
  ],
  "stats": { "total": 3, "errors": 0, "warnings": 3, "info": 0, "unknown": 0 },
  "hasError": false,
  "hasWarning": true
}

🤖 Como funciona o Agente:
O frontend envia mensagem, histórico e o contexto do decodificador (module, hex).

O backend verifica se há contexto válido. Se sim, executa a decodificação determinística (evidence.js) e injeta o resultado como mensagem de sistema.

O agente recebe o prompt (com modo ativo) e as mensagens.

O modelo decide chamar ferramentas (tools.js) para consultar o atlas ou a referência do sistema.

O loop de function calling executa até 8 rodadas ou até o modelo responder.

A resposta final é retornada ao frontend.

Ferramentas disponíveis
Ferramenta	Descrição
decode_hex	Decodifica um código hexadecimal de 32 bits de um módulo S800
get_bit_definition	Retorna a definição de um bit específico de um módulo
search_atlas	Busca bits cuja descrição contenha um termo
analyze_severity	Analisa severidade geral (contagem de erros, alertas, etc.)
get_module_info	Retorna informações gerais sobre um módulo
list_modules	Lista todos os módulos disponíveis no atlas
get_system_reference	Consulta a referência de arquitetura/topologia/redundância/hardware/diagnóstico/comunicação/backup do 800xA

🧠 Modos de Análise:
Comando	Descrição
/EXPERT	Resposta técnica direta, nível especialista sênior.
/CRITIC	Revisão crítica de um diagnóstico ou plano apresentado.
/DEEP	Investigação metódica de causa raiz.
/RISK	Avaliação de risco em três dimensões (pessoas, equipamento, produção).
Use-os no início da mensagem no chat, por exemplo: /EXPERT O módulo CI854 está com o código 0000002B.

🔒 Segurança:
CORS: por padrão, apenas same-origin (frontend servido pelo próprio Express). Para liberar múltiplas origens, defina CORS_ORIGIN separando por vírgula (use * apenas em desenvolvimento).

Rate limiting: implementado em memória (backend/middleware/rateLimiter.js) para as rotas de decodificação, diagnóstico e atlas.

Limites de payload: express.json({ limit: '256kb' }) evita payloads gigantes.

Sem exposição de chaves: as chaves de API ficam somente no servidor (variáveis de ambiente) e nunca são enviadas ao frontend.

🤝 Contribuição:
Contribuições são bem-vindas! Siga os passos:

Fork este repositório.

Crie uma branch para sua feature (git checkout -b feature/nova-funcionalidade).

Faça commit das suas alterações (git commit -m 'Adiciona nova funcionalidade').

Envie para a branch (git push origin feature/nova-funcionalidade).

Abra um Pull Request.

📄 Licença
Este projeto está sob a licença MIT. Veja o arquivo LICENSE para mais detalhes.

Autor: Jhon Macedo
E-mail: jhonmacedo01@gmail.com
LinkedIn: Jhon Macedo
GitHub: @Jhonmacedo01