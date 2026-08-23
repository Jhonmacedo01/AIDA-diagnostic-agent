const https = require('https');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const API_KEY = process.env.GROQ_API_KEY;

if (!API_KEY) {
  console.error('[list-models] GROQ_API_KEY nao definida no arquivo .env');
  process.exit(1);
}

function listModels() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.groq.com',
      path: '/openai/v1/models',
      method: 'GET',
      headers: {
        Authorization: `Bearer ${API_KEY}`
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode !== 200) {
            reject(new Error(`Status ${res.statusCode}: ${json.error?.message || data}`));
            return;
          }
          resolve(json.data || []);
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function main() {
  try {
    const models = await listModels();
    console.log('Modelos disponiveis na conta Groq configurada:');
    models
      .sort((a, b) => a.id.localeCompare(b.id))
      .forEach(m => console.log(` - ${m.id} (contexto: ${m.context_window || 'n/d'} tokens)`));
    console.log(`Total: ${models.length} modelos`);
  } catch (error) {
    console.error('[list-models] Erro ao listar modelos:', error.message);
  }
}

main();
