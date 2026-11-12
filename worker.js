/**
 * worker.js
 * Cloudflare Worker Anycast para TradNinja Pro API (Cloudflare Workers AI + Meta M2M-100)
 * 
 * Tradução Neural com @cf/meta/m2m100-1.2b, ****** 6750 e Rate Limiter
 * 
 * @license MIT
 * @see https://github.com/clepta2/tradninja-pro
 */

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
  'Access-Control-Expose-Headers': 'x-tradninja-plan, x-tradninja-max-phrases, Retry-After',
  'Access-Control-Max-Age': '86400'
};

export const TRADNINJA_PLANS = {
  free: {
    key: 'free',
    name: 'Free / Sandbox',
    prefix: 'tn_free_',
    rpm: 30,
    maxPhrases: 50,
    maxPayloadBytes: 1 * 1024 * 1024,
    dailyQuota: 500,
    support: 'Comunidade'
  },
  starter: {
    key: 'starter',
    name: 'Starter',
    prefix: 'tn_start_',
    rpm: 60,
    maxPhrases: 100,
    maxPayloadBytes: 2 * 1024 * 1024,
    dailyQuota: 2000,
    support: 'Padrão'
  },
  pro: {
    key: 'pro',
    name: 'Pro',
    prefix: 'tn_pro_',
    rpm: 300,
    maxPhrases: 500,
    maxPayloadBytes: 5 * 1024 * 1024,
    dailyQuota: 20000,
    support: 'Prioritário'
  },
  business: {
    key: 'business',
    name: 'Business',
    prefix: 'tn_biz_',
    rpm: 1200,
    maxPhrases: 1000,
    maxPayloadBytes: 8 * 1024 * 1024,
    dailyQuota: 100000,
    support: 'SLA 99.9% 24/7'
  },
  master: {
    key: 'master',
    name: 'Master Admin',
    prefix: 'tn_master_',
    rpm: 3000,
    maxPhrases: 2000,
    maxPayloadBytes: 15 * 1024 * 1024,
    dailyQuota: Infinity,
    support: 'Engenharia Dedicada'
  }
};

export const NOMES_IDIOMAS = {
  'auto': 'Detectar Automaticamente',
  'pt': 'Português',
  'en': 'Inglês',
  'es': 'Espanhol',
  'fr': 'Francês',
  'de': 'Alemão',
  'it': 'Italiano',
  'ja': 'Japonês',
  'zh': 'Chinês',
  'ru': 'Russo',
  'ar': 'Árabe',
  'ko': 'Coreano',
  'nl': 'Holandês',
  'pl': 'Polonês',
  'tr': 'Turco',
  'sv': 'Sueco',
  'hi': 'Hindi',
  'el': 'Grego',
  'he': 'Hebraico',
  'uk': 'Ucraniano',
  'vi': 'Vietnamita',
  'id': 'Indonésio',
  'cs': 'Tcheco',
  'ro': 'Romeno',
  'hu': 'Húngaro',
  'da': 'Dinamarquês',
  'fi': 'Finlandês',
  'no': 'Norueguês'
};

const rateLimitMap = new Map();

export function resetRateLimits() {
  rateLimitMap.clear();
}

export function checkRateLimit(identifier, rpm) {
  const now = Date.now();
  const windowMs = 60000;
  let record = rateLimitMap.get(identifier);
  if (!record || (now - record.resetTime > windowMs)) {
    record = { count: 1, resetTime: now };
    rateLimitMap.set(identifier, record);
    return { allowed: true, remaining: rpm - 1, retryAfter: 0 };
  }
  if (record.count >= rpm) {
    const retryAfter = Math.max(1, Math.ceil((record.resetTime + windowMs - now) / 1000));
    return { allowed: false, remaining: 0, retryAfter };
  }
  record.count++;
  return { allowed: true, remaining: rpm - record.count, retryAfter: 0 };
}

export function resolverPlanoToken(authHeader, apiKeyHeader) {
  let rawToken = null;
  if (authHeader && typeof authHeader === 'string') {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match) {
      rawToken = match[1].trim();
    } else {
      rawToken = authHeader.trim();
    }
  } else if (apiKeyHeader && typeof apiKeyHeader === 'string') {
    rawToken = apiKeyHeader.trim();
  }

  if (!rawToken) {
    return { token: null, plan: TRADNINJA_PLANS.free };
  }

  if (rawToken.startsWith('tn_free_') || rawToken === 'tn_free') {
    return { token: rawToken, plan: TRADNINJA_PLANS.free };
  }
  if (rawToken.startsWith('tn_start_') || rawToken === 'tn_start') {
    return { token: rawToken, plan: TRADNINJA_PLANS.starter };
  }
  if (rawToken.startsWith('tn_pro_') || rawToken === 'tn_pro' || rawToken.startsWith('tn_live_')) {
    return { token: rawToken, plan: TRADNINJA_PLANS.pro };
  }
  if (rawToken.startsWith('tn_biz_') || rawToken === 'tn_biz') {
    return { token: rawToken, plan: TRADNINJA_PLANS.business };
  }
  if (rawToken.startsWith('tn_master_') || rawToken === 'tn_master') {
    return { token: rawToken, plan: TRADNINJA_PLANS.master };
  }

  return { token: rawToken, plan: null, error: 'UNAUTHORIZED_KEY' };
}

export function isolarTagsHtml(texto) {
  if (typeof texto !== 'string') return { textoLimpo: '', tags: [] };
  const tags = [];
  const textoLimpo = texto.replace(/<[^>]+>/g, (tag) => {
    const idx = tags.length;
    tags.push(tag);
    return `___TAG_${idx}___`;
  });
  return { textoLimpo, tags };
}

export function restaurarTagsHtml(texto, tags) {
  if (typeof texto !== 'string') return '';
  if (!tags || !tags.length) return texto;
  return texto.replace(/___TAG_(\d+)___/g, (_, idx) => {
    const i = Number(idx);
    return tags[i] !== undefined ? tags[i] : '';
  });
}

const CF_ACCOUNT_ID = '';
const CF_API_TOKEN = '';

// ─── MOTOR DE TRADUÇÃO NEURAL 1: CLOUDFLARE WORKERS AI (@cf/meta/m2m100-1.2b) ───
async function traduzirCloudflareAI(texto, sourceLang, targetLang, env = {}) {
  // 1. Binding nativo dentro do Cloudflare Worker
  if (env && env.AI && typeof env.AI.run === 'function') {
    const payload = { text: texto, target_lang: targetLang };
    if (sourceLang && sourceLang !== 'auto') payload.source_lang = sourceLang;
    const aiRes = await env.AI.run('@cf/meta/m2m100-1.2b', payload);
    if (aiRes && aiRes.translated_text) {
      return {
        textoTraduzido: aiRes.translated_text,
        transliteracao: null,
        idiomaDetectado: sourceLang !== 'auto' ? sourceLang : 'auto',
        provedor: 'cloudflare-workers-ai'
      };
    }
  }

  // 2. Chamada via REST API da Cloudflare (quando executado no Node.js/VM)
  const accountId = (env && env.CLOUDFLARE_ACCOUNT_ID) || CF_ACCOUNT_ID;
  const token = (env && env.CLOUDFLARE_API_TOKEN) || CF_API_TOKEN;

  if (accountId && token) {
    const payload = { text: texto, target_lang: targetLang };
    if (sourceLang && sourceLang !== 'auto') payload.source_lang = sourceLang;

    const resp = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/m2m100-1.2b`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(6000)
    });

    if (resp.ok) {
      const data = await resp.json();
      if (data && data.result && data.result.translated_text) {
        return {
          textoTraduzido: data.result.translated_text,
          transliteracao: null,
          idiomaDetectado: sourceLang !== 'auto' ? sourceLang : 'auto',
          provedor: 'cloudflare-workers-ai'
        };
      }
    }
  }

  throw new Error('Cloudflare Workers AI indisponível');
}

async function traduzirBlocoGtx(texto, sourceLang, targetLang) {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(sourceLang)}&tl=${encodeURIComponent(targetLang)}&dt=t&dt=at&dt=rm&dt=bd&dt=qca&q=${encodeURIComponent(texto)}`;

  const resp = await fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      'Accept': '*/*'
    }
  });

  if (!resp.ok) {
    throw new Error(`Cluster de tradução retornou HTTP ${resp.status}`);
  }

  const data = await resp.json();
  let textoTraduzido = '';
  let transliteracao = null;

  if (Array.isArray(data[0])) {
    const partes = [];
    for (const item of data[0]) {
      if (item && item[0]) partes.push(item[0]);
      if (item && !item[0] && item[3]) transliteracao = item[3];
    }
    textoTraduzido = partes.join('');
  }

  const idiomaDetectado = data[2] || (sourceLang !== 'auto' ? sourceLang : 'desconhecido');
  return {
    textoTraduzido,
    transliteracao,
    idiomaDetectado,
    provedor: 'google-neural-anycast'
  };
}

async function traduzirFallback(texto, sourceLang, targetLang) {
  const langPair = `${sourceLang === 'auto' ? 'pt' : sourceLang}|${targetLang}`;
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(texto)}&langpair=${encodeURIComponent(langPair)}`;
  const resp = await fetch(url);
  const data = await resp.json();
  if (data && data.responseData && data.responseData.translatedText) {
    return {
      textoTraduzido: data.responseData.translatedText,
      transliteracao: null,
      idiomaDetectado: sourceLang,
      provedor: 'mymemory-fallback'
    };
  }
  throw new Error('Fallback esgotado');
}

export async function traduzirTextoCompleto(texto, { de = 'auto', para = 'pt', env = {} } = {}) {
  if (!texto || typeof texto !== 'string' || !texto.trim()) {
    return {
      textoOriginal: '',
      textoTraduzido: '',
      idiomaOrigem: de,
      idiomaDestino: para
    };
  }

  const raw = texto.trim();
  const sourceLang = de || 'auto';
  const targetLang = para || 'pt';

  if (sourceLang !== 'auto' && sourceLang.toLowerCase() === targetLang.toLowerCase()) {
    return {
      textoOriginal: raw,
      textoTraduzido: raw,
      idiomaOrigem: sourceLang,
      idiomaOrigemNome: NOMES_IDIOMAS[sourceLang] || sourceLang,
      idiomaDestino: targetLang,
      idiomaDestinoNome: NOMES_IDIOMAS[targetLang] || targetLang,
      provedor: 'identico'
    };
  }

  const { textoLimpo, tags } = isolarTagsHtml(raw);

  let traduzidoLimpo = '';
  let idiomaDetectado = sourceLang;
  let provedor = 'cloudflare-workers-ai';

  try {
    const resCf = await traduzirCloudflareAI(textoLimpo, sourceLang, targetLang, env);
    traduzidoLimpo = resCf.textoTraduzido;
    idiomaDetectado = resCf.idiomaDetectado;
    provedor = resCf.provedor;
  } catch (_) {
    try {
      const res = await traduzirBlocoGtx(textoLimpo, sourceLang, targetLang);
      traduzidoLimpo = res.textoTraduzido;
      idiomaDetectado = res.idiomaDetectado;
      provedor = res.provedor;
    } catch (_) {
      try {
        const fb = await traduzirFallback(textoLimpo, sourceLang, targetLang);
        traduzidoLimpo = fb.textoTraduzido;
        idiomaDetectado = fb.idiomaDetectado;
        provedor = fb.provedor;
      } catch {
        traduzidoLimpo = textoLimpo;
        provedor = 'raw';
      }
    }
  }

  const textoTraduzidoFinal = restaurarTagsHtml(traduzidoLimpo, tags);

  return {
    textoOriginal: raw,
    textoTraduzido: textoTraduzidoFinal,
    idiomaOrigem: idiomaDetectado,
    idiomaOrigemNome: NOMES_IDIOMAS[idiomaDetectado] || idiomaDetectado,
    idiomaDestino: targetLang,
    idiomaDestinoNome: NOMES_IDIOMAS[targetLang] || targetLang,
    provedor
  };
}

export default {
  async fetch(request, env = {}, ctx = {}) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, '') || '/';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (path === '/api/traduzir/idiomas' || path === '/api/translate/languages' || path === '/languages') {
      return new Response(JSON.stringify({
        ok: true,
        totalIdiomas: Object.keys(NOMES_IDIOMAS).length - 1,
        idiomas: NOMES_IDIOMAS
      }, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'x-tradninja-plan': 'free',
          'x-tradninja-max-phrases': '50',
          ...CORS_HEADERS
        }
      });
    }

    const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
    const apiKeyHeader = request.headers.get('x-api-key') || request.headers.get('X-Api-Key');
    const authRes = resolverPlanoToken(authHeader, apiKeyHeader);

    if (authRes.error === 'UNAUTHORIZED_KEY') {
      return new Response(JSON.stringify({
        ok: false,
        error: 'UNAUTHORIZED_KEY',
        message: 'Token de autenticação inválido ou não reconhecido. Forneça uma chave válida (tn_free_..., tn_start_..., tn_pro_..., tn_biz_..., tn_master_...) via Authorization: ****** x-api-key.'
      }, null, 2), {
        status: 401,
        headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS_HEADERS }
      });
    }

    const plan = authRes.plan;
    const planHeaders = {
      'x-tradninja-plan': plan.key,
      'x-tradninja-max-phrases': String(plan.maxPhrases),
      ...CORS_HEADERS
    };

    const clientIdentifier = authRes.token || request.headers.get('cf-connecting-ip') || 'client_sandbox';
    const rateCheck = checkRateLimit(clientIdentifier, plan.rpm);
    if (!rateCheck.allowed) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'RATE_LIMIT_EXCEEDED',
        message: `Limite de requisições excedido para o plano ${plan.name} (${plan.rpm} RPM). Aguarde ${rateCheck.retryAfter}s antes de enviar nova requisição.`,
        retryAfter: rateCheck.retryAfter
      }, null, 2), {
        status: 429,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Retry-After': String(rateCheck.retryAfter),
          ...planHeaders
        }
      });
    }

    let texto = url.searchParams.get('texto') || url.searchParams.get('q') || url.searchParams.get('text') || '';
    let de = url.searchParams.get('de') || url.searchParams.get('sl') || url.searchParams.get('from') || 'auto';
    let para = url.searchParams.get('para') || url.searchParams.get('tl') || url.searchParams.get('to') || 'pt';
    let listaTextos = null;
    let payloadSize = 0;

    if (request.method === 'POST') {
      try {
        const rawBodyText = await request.text();
        payloadSize = rawBodyText ? Buffer.byteLength(rawBodyText, 'utf8') : 0;

        if (payloadSize > plan.maxPayloadBytes) {
          return new Response(JSON.stringify({
            ok: false,
            error: 'PAYLOAD_TOO_LARGE',
            message: `O payload enviado (${(payloadSize / 1024 / 1024).toFixed(2)} MB) excede o limite máximo permitido de ${(plan.maxPayloadBytes / 1024 / 1024).toFixed(0)} MB para o plano ${plan.name}.`,
            maxBytes: plan.maxPayloadBytes
          }, null, 2), {
            status: 413,
            headers: { 'Content-Type': 'application/json; charset=utf-8', ...planHeaders }
          });
        }

        if (rawBodyText) {
          const body = JSON.parse(rawBodyText);
          if (body.texto !== undefined) texto = String(body.texto);
          if (body.q !== undefined) texto = String(body.q);
          if (body.text !== undefined) texto = String(body.text);
          if (body.de) de = String(body.de);
          if (body.para) para = String(body.para);
          if (Array.isArray(body.textos)) listaTextos = body.textos;
          if (Array.isArray(body.itens)) listaTextos = body.itens;
          if (Array.isArray(body.phrases)) listaTextos = body.phrases;
        }
      } catch (err) {
        if (err.name === 'SyntaxError') {
          return new Response(JSON.stringify({
            ok: false,
            error: 'INVALID_JSON',
            message: 'O corpo da requisição não é um JSON válido.'
          }, null, 2), {
            status: 400,
            headers: { 'Content-Type': 'application/json; charset=utf-8', ...planHeaders }
          });
        }
      }
    }

    if (listaTextos && Array.isArray(listaTextos)) {
      if (listaTextos.length > plan.maxPhrases) {
        return new Response(JSON.stringify({
          ok: false,
          error: 'PHRASE_LIMIT_EXCEEDED',
          message: `A quantidade de frases enviadas (${listaTextos.length}) excede o limite de ${plan.maxPhrases} frases por lote para o plano ${plan.name}.`,
          limit: plan.maxPhrases
        }, null, 2), {
          status: 400,
          headers: { 'Content-Type': 'application/json; charset=utf-8', ...planHeaders }
        });
      }

      const t0 = Date.now();
      const promessas = listaTextos.map(t => traduzirTextoCompleto(String(t), { de, para, env }));
      const resultados = await Promise.all(promessas);
      const tempoMs = Date.now() - t0;

      return new Response(JSON.stringify({
        ok: true,
        tipo: 'lote',
        plano: plan.key,
        totalProcessado: resultados.length,
        limitePlano: plan.maxPhrases,
        idiomaOrigem: de,
        idiomaDestino: para,
        tempoMs,
        itens: resultados
      }, null, 2), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8', ...planHeaders }
      });
    }

    if (!texto) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'INVALID_PARAMS',
        message: 'Informe o parâmetro "texto" ou "q" para tradução. Exemplo: /api/translate?q=Hello+world&para=pt',
        rotas: [
          'GET /api/translate?q=Hello&de=auto&para=pt',
          'POST /api/translate {"texto": "Hello World", "para": "pt"}',
          'POST /api/translate {"phrases": ["Hello", "Good morning"], "para": "pt"}',
          'GET /api/translate/languages'
        ]
      }, null, 2), {
        status: 400,
        headers: { 'Content-Type': 'application/json; charset=utf-8', ...planHeaders }
      });
    }

    if (Buffer.byteLength(texto, 'utf8') > plan.maxPayloadBytes) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'PAYLOAD_TOO_LARGE',
        message: `O texto fornecido excede o limite do plano ${plan.name} (${plan.maxPayloadBytes} bytes).`,
        maxBytes: plan.maxPayloadBytes
      }, null, 2), {
        status: 413,
        headers: { 'Content-Type': 'application/json; charset=utf-8', ...planHeaders }
      });
    }

    const t0 = Date.now();
    try {
      const resultado = await traduzirTextoCompleto(texto, { de, para, env });
      const tempoMs = Date.now() - t0;

      return new Response(JSON.stringify({
        ok: true,
        plano: plan.key,
        ...resultado,
        tempoMs,
        caracteres: texto.length,
        timestamp: new Date().toISOString()
      }, null, 2), {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'public, max-age=3600',
          ...planHeaders
        }
      });
    } catch (err) {
      return new Response(JSON.stringify({
        ok: false,
        error: 'TRANSLATION_FAILED',
        message: 'Falha no processamento neural da tradução: ' + err.message
      }, null, 2), {
        status: 500,
        headers: { 'Content-Type': 'application/json; charset=utf-8', ...planHeaders }
      });
    }
  }
};
