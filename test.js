import worker, {
  TRADNINJA_PLANS,
  NOMES_IDIOMAS,
  resolverPlanoToken,
  checkRateLimit,
  resetRateLimits,
  isolarTagsHtml,
  restaurarTagsHtml,
  traduzirTextoCompleto
} from './worker.js';

console.log('🧪 Iniciando Bateria de Testes do TradNinja Pro API (Cloudflare Workers AI)...\n');

let pass = 0;
let fail = 0;

function assert(cond, msg) {
  if (cond) {
    pass++;
    console.log(`  ✅ ${msg}`);
  } else {
    fail++;
    console.error(`  ❌ FALHA: ${msg}`);
    throw new Error(msg);
  }
}

// 1. Autenticação e Resolução de Nível
console.log('--- 1. Padrão de Autenticação RFC 6750 & Resolução de Nível ---');
const rFree = resolverPlanoToken(null, null);
assert(rFree.plan.key === 'free', 'Requisição sem token resolve para o plano Free');

const rStart = resolverPlanoToken('Bearer tn_start_live_sandbox', null);
assert(rStart.plan.key === 'starter', 'Token tn_start_ resolve plano starter');

const rPro = resolverPlanoToken(null, 'tn_pro_live_sandbox');
assert(rPro.plan.key === 'pro', 'Header x-api-key tn_pro_ resolve plano pro');

const rBiz = resolverPlanoToken('Bearer tn_biz_live_production', null);
assert(rBiz.plan.key === 'business', 'Token tn_biz_ resolve plano business');

const rMaster = resolverPlanoToken('Bearer tn_master_admin_root', null);
assert(rMaster.plan.key === 'master', 'Token tn_master_ resolve plano master');

const rInvalido = resolverPlanoToken('Bearer token_invalido_xyz', null);
assert(rInvalido.error === 'UNAUTHORIZED_KEY', 'Token inválido retorna erro UNAUTHORIZED_KEY');

// 2. Isolamento de Tags HTML e W3C
console.log('\n--- 2. Isolamento de Tags HTML e W3C ---');
const htmlExemplo = '<p>Olá <strong>mundo</strong>, visite nosso <a href="https://ponte.ozpro.com.br">site</a>.</p>';
const { textoLimpo, tags } = isolarTagsHtml(htmlExemplo);
assert(tags.length === 6, 'Isolou todas as 6 tags HTML');
assert(!textoLimpo.includes('<p>') && !textoLimpo.includes('<strong>'), 'Texto limpo não possui tags');
const restaurado = restaurarTagsHtml(textoLimpo, tags);
assert(restaurado === htmlExemplo, 'Restauração de tags HTML preserva 100% da estrutura original');

// 3. Teste de Worker HTTP e Headers de Telemetria
console.log('\n--- 3. Telemetria e Matriz de Planos no Worker ---');
const reqTest = new Request('https://api.test/api/translate?q=Hello&para=pt', {
  headers: { 'Authorization': 'Bearer tn_pro_live_sandbox' }
});
const resTest = await worker.fetch(reqTest);
assert(resTest.status === 200, 'Worker responde 200 OK');
assert(resTest.headers.get('x-tradninja-plan') === 'pro', 'Header x-tradninja-plan: pro presente');
assert(resTest.headers.get('x-tradninja-max-phrases') === '500', 'Header x-tradninja-max-phrases: 500 presente');

const bodyTest = await resTest.json();
assert(bodyTest.ok === true, 'JSON de resposta tem ok: true');
assert(bodyTest.textoTraduzido.length > 0, `Tradução gerada com sucesso: "${bodyTest.textoTraduzido}"`);
assert(bodyTest.provedor === 'cloudflare-workers-ai' || bodyTest.provedor === 'google-neural-anycast', `Provedor neural ativo: ${bodyTest.provedor}`);

// 4. Teste de Rate Limiting (429)
console.log('\n--- 4. Rate Limiting Dinâmico & Bloqueio HTTP 429 ---');
resetRateLimits();
const testToken = 'tn_free_rate_test_key';
let atingiu429 = false;
let retryAfter = null;

for (let i = 0; i < 35; i++) {
  const r = await worker.fetch(new Request('https://api.test/api/translate?q=Test&para=pt', {
    headers: { 'Authorization': `Bearer ${testToken}` }
  }));
  if (r.status === 429) {
    atingiu429 = true;
    retryAfter = r.headers.get('Retry-After');
    const b429 = await r.json();
    assert(b429.error === 'RATE_LIMIT_EXCEEDED', 'Retorno de erro estruturado RATE_LIMIT_EXCEEDED');
    break;
  }
}
assert(atingiu429 === true, 'Rate limit bloqueia com HTTP 429 quando limite RPM é excedido');
assert(retryAfter !== null, `Cabeçalho Retry-After presente (${retryAfter}s)`);

// 5. Teste de Lote com limite de frases
console.log('\n--- 5. Processamento em Lote & Limite de Frases ---');
const reqLote = new Request('https://api.test/api/translate', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer tn_free_lote_test',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    phrases: ['Bom dia', 'Boa tarde', 'Boa noite'],
    para: 'en'
  })
});
const resLote = await worker.fetch(reqLote);
assert(resLote.status === 200, 'Lote processado com status 200');
const bodyLote = await resLote.json();
assert(bodyLote.totalProcessado === 3, 'Processou 3 frases em lote');

// Excesso de frases
const reqExcesso = new Request('https://api.test/api/translate', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer tn_free_lote_test',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    phrases: Array(55).fill('Frase de teste'),
    para: 'en'
  })
});
const resExcesso = await worker.fetch(reqExcesso);
assert(resExcesso.status === 400, 'Excesso de frases rejeitado com HTTP 400');
const bodyExcesso = await resExcesso.json();
assert(bodyExcesso.error === 'PHRASE_LIMIT_EXCEEDED', 'Erro tipado PHRASE_LIMIT_EXCEEDED retornado');

console.log(`\n========================================`);
console.log(`🎉 TODOS OS TESTES PASSARAM COM 100% DE SUCESSO! (${pass} aprovados)`);
console.log(`========================================\n`);
