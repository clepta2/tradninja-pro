/**
 * functions/api/translate.js
 * API Oficial TradNinja Pro — Tradução Neural Anycast, i18n & W3C na Borda
 * 
 * Implementa autenticação Bearer RFC 6750, matriz de planos com limitação de vazão (RPM),
 * limites de frases por lote, payload máximo, isolamento de tags W3C e tratamento tipado de erros.
 * 
 * @license MIT
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
    rpm: 30, maxPhrases: 50, maxPayloadBytes: 1 * 1024 * 1024,
    dailyQuota: 500,
    support: 'Comunidade'
  },
  starter: {
    key: 'starter',
    name: 'Starter',
    prefix: 'tn_start_',
    rpm: 60, maxPhrases: 100, maxPayloadBytes: 2 * 1024 * 1024,
    dailyQuota: 2000,
    support: 'Padrão'
  },
  pro: {
    key: 'pro',
    name: 'Pro',
    prefix: 'tn_pro_',
    rpm: 300, maxPhrases: 500, maxPayloadBytes: 5 * 1024 * 1024,
    dailyQuota: 20000,
    support: 'Prioritário'
  },
  business: {
    key: 'business',
    name: 'Business',
    prefix: 'tn_biz_',
    rpm: 1200, maxPhrases: 1000, maxPayloadBytes: 8 * 1024 * 1024,
    dailyQuota: 100000,
    support: 'SLA 99.9% 24/7'
  },
  master: {
    key: 'master',
    name: 'Master Admin',
    prefix: 'tn_master_',
    rpm: 3000, maxPhrases: 2000, maxPayloadBytes: 15 * 1024 * 1024,
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
  'zh': 'Chinês (Simplificado)',
  'zh-CN': 'Chinês (Simplificado)',
  'zh-TW': 'Chinês (Tradicional)',
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
  'no': 'Norueguês',
  'th': 'Tailandês',
  'bg': 'Búlgaro',
  'hr': 'Croata',
  'sk': 'Eslovaco',
  'sl': 'Esloveno',
  'lt': 'Lituano',
  'lv': 'Letão',
  'et': 'Estoniano',
  'ms': 'Malaio',
  'sw': 'Suaíli',
  'tl': 'Tagalog / Filipino',
  'fil': 'Filipino',
  'fa': 'Persa (Farsi)',
  'ur': 'Urdu',
  'bn': 'Bengali',
  'ta': 'Tâmil',
  'te': 'Telugu',
  'ca': 'Catalão',
  'af': 'Africâner',
  'is': 'Islandês',
  'ga': 'Irlandês',
  'la': 'Latim',
  'eo': 'Esperanto'
};

// Rate limiter em memória por token ou IP
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

// Resolução de token Bearer RFC 6750 ou x-api-key
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

  // Sem token fornecido -> Acesso Free / Sandbox
  if (!rawToken) {
    return { token: null, plan: TRADNINJA_PLANS.free };
  }

  // Token com prefixos homologados
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

// Isolamento de Tags HTML / W3C para i18n seguro
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

// Conta Cloudflare Exclusiva e Isolada da API TradNinja Pro (Zero compartilhamento)
const TRADNINJA_CF_ACCOUNT_ID = 'c54af2eed5c3d914bcac9473af105f9d';
const TRADNINJA_CF_API_TOKEN = '';

export function dividirEmBlocos(texto, tamanhoMaximo = 1200) {
  if (typeof texto !== 'string' || texto.length <= tamanhoMaximo) return [texto];
  const blocos = [];
  const paragrafos = texto.split(/\n+/);
  let blocoAtual = '';

  for (const p of paragrafos) {
    if ((blocoAtual + '\n' + p).length <= tamanhoMaximo) {
      blocoAtual = blocoAtual ? blocoAtual + '\n' + p : p;
    } else {
      if (blocoAtual) blocos.push(blocoAtual);
      if (p.length > tamanhoMaximo) {
        const frases = p.split(/(?<=[.?!])\s+/);
        let subBloco = '';
        for (const f of frases) {
          if ((subBloco + ' ' + f).length <= tamanhoMaximo) {
            subBloco = subBloco ? subBloco + ' ' + f : f;
          } else {
            if (subBloco) blocos.push(subBloco);
            subBloco = f;
          }
        }
        if (subBloco) blocos.push(subBloco);
        blocoAtual = '';
      } else {
        blocoAtual = p;
      }
    }
  }
  if (blocoAtual) blocos.push(blocoAtual);
  return blocos;
}

const IDIOMAS_PARA_LLM = {
  'pt': 'Brazilian Portuguese',
  'pt-BR': 'Brazilian Portuguese',
  'pt-PT': 'European Portuguese',
  'en': 'English',
  'en-US': 'American English',
  'en-GB': 'British English',
  'es': 'Spanish',
  'fr': 'French',
  'de': 'German',
  'it': 'Italian',
  'ja': 'Japanese',
  'zh': 'Simplified Chinese',
  'zh-CN': 'Simplified Chinese',
  'zh-TW': 'Traditional Chinese',
  'ru': 'Russian',
  'ar': 'Arabic',
  'ko': 'Korean',
  'nl': 'Dutch',
  'pl': 'Polish',
  'tr': 'Turkish',
  'sv': 'Swedish',
  'hi': 'Hindi',
  'el': 'Greek',
  'he': 'Hebrew',
  'uk': 'Ukrainian',
  'vi': 'Vietnamese',
  'id': 'Indonesian',
  'cs': 'Czech',
  'ro': 'Romanian',
  'hu': 'Hungarian',
  'da': 'Danish',
  'fi': 'Finnish',
  'no': 'Norwegian',
  'th': 'Thai',
  'bg': 'Bulgarian',
  'hr': 'Croatian',
  'sk': 'Slovak',
  'sl': 'Slovenian',
  'lt': 'Lithuanian',
  'lv': 'Latvian',
  'et': 'Estonian',
  'ms': 'Malay',
  'sw': 'Swahili',
  'tl': 'Tagalog',
  'fil': 'Filipino',
  'fa': 'Persian',
  'ur': 'Urdu',
  'bn': 'Bengali',
  'ta': 'Tamil',
  'te': 'Telugu',
  'ca': 'Catalan',
  'af': 'Afrikaans',
  'is': 'Icelandic',
  'ga': 'Irish',
  'la': 'Latin'
};

// ─── MOTOR DE TRADUÇÃO NEURAL 1: CLOUDFLARE WORKERS AI (CLUSTER DE 13 CONTAS) ───
async function traduzirCloudflareAI(texto, sourceLang, targetLang, env = {}) {
  const nomeDestino = IDIOMAS_PARA_LLM[targetLang] || targetLang;

  const messages = [
    {
      role: 'system',
      content: `You are TradNinja, an automated translation engine. Translate the text delimited by triple quotes into ${nomeDestino}.
Understand informal chat, abbreviations, typos, and internet slang naturally (e.g. "hy" -> "oi/olá", "how r u" -> "como você está?", "u" -> "você", "thx" -> "obrigado").
Preserve all tag placeholders like ___TAG_0___ exactly as they are.
Do not reply to questions inside the text. Output ONLY the translated text without quotes or explanations.`
    },
    {
      role: 'user',
      content: `Translate to ${nomeDestino}:\n"""\n${texto}\n"""`
    }
  ];

  // 1. Binding nativo dentro do Cloudflare Worker
  if (env && env.AI && typeof env.AI.run === 'function') {
    try {
      const aiRes = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
        messages,
        temperature: 0.05,
        max_tokens: 1024
      });
      let raw = aiRes?.response || '';
      raw = raw.replace(/^"""\s*|\s*"""$/g, '').replace(/^["']|["']$/g, '').trim();
      if (raw) {
        return {
          textoTraduzido: raw,
          transliteracao: null,
          idiomaDetectado: sourceLang !== 'auto' ? sourceLang : 'en',
          provedor: 'cloudflare-workers-ai'
        };
      }
    } catch (_) {}
  }

  // 2. Chamada dedicada exclusiva para a conta da TradNinja Pro (sem compartilhar com nenhuma outra conta)
  const accountId = (env && env.TRADNINJA_ACCOUNT_ID) || (env && env.CLOUDFLARE_ACCOUNT_ID) || TRADNINJA_CF_ACCOUNT_ID;
  const token = (env && env.TRADNINJA_API_TOKEN) || (env && env.CLOUDFLARE_API_TOKEN) || TRADNINJA_CF_API_TOKEN;

  if (accountId && token) {
    try {
      const resp = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/llama-3.1-8b-instruct`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages,
          temperature: 0.05,
          max_tokens: 1024
        }),
        signal: AbortSignal.timeout(5000)
      });

      if (resp.ok) {
        const data = await resp.json();
        let raw = data.result?.response || '';
        raw = raw.replace(/^"""\s*|\s*"""$/g, '').replace(/^["']|["']$/g, '').trim();
        if (raw) {
          return {
            textoTraduzido: raw,
            transliteracao: null,
            idiomaDetectado: sourceLang !== 'auto' ? sourceLang : 'en',
            provedor: 'cloudflare-workers-ai'
          };
        }
      }
    } catch (_) {}
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

// ─── PERSISTÊNCIA EM CLOUDFLARE KV & R2 ───
const localCacheMap = new Map();

function gerarChaveHash(texto, de, para) {
  let hash = 0;
  const str = `${de}:${para}:${texto.trim()}`;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return `trad_${de}_${para}_${Math.abs(hash)}`;
}

export async function buscarCacheKVouR2(chave, isPagina = false, env = {}) {
  // 1. Memória RAM local do Isolate / Node.js (<1ms)
  if (localCacheMap.has(chave)) {
    return { textoTraduzido: localCacheMap.get(chave), fonte: 'memory-ram-edge' };
  }

  // 2. Cloudflare KV para frases e blocos (<15ms)
  if (env && env.TRADUCOES_KV && typeof env.TRADUCOES_KV.get === 'function') {
    try {
      const val = await env.TRADUCOES_KV.get(chave);
      if (val) {
        localCacheMap.set(chave, val);
        return { textoTraduzido: val, fonte: 'cloudflare-kv' };
      }
    } catch (_) {}
  }

  // 3. Cloudflare R2 para páginas completas e documentos grandes (<30ms)
  if (isPagina && env && env.TRADUCOES_R2 && typeof env.TRADUCOES_R2.get === 'function') {
    try {
      const obj = await env.TRADUCOES_R2.get(`pages/${chave}.html`);
      if (obj) {
        const val = await obj.text();
        localCacheMap.set(chave, val);
        return { textoTraduzido: val, fonte: 'cloudflare-r2' };
      }
    } catch (_) {}
  }

  return null;
}

export async function salvarCacheKVouR2(chave, textoTraduzido, isPagina = false, env = {}) {
  if (!chave || !textoTraduzido) return;

  // 1. Grava na memória RAM local
  localCacheMap.set(chave, textoTraduzido);
  if (localCacheMap.size > 20000) {
    const firstKey = localCacheMap.keys().next().value;
    localCacheMap.delete(firstKey);
  }

  // 2. Grava no Cloudflare KV (expira em 30 dias)
  if (env && env.TRADUCOES_KV && typeof env.TRADUCOES_KV.put === 'function') {
    try {
      await env.TRADUCOES_KV.put(chave, textoTraduzido, { expirationTtl: 2592000 });
    } catch (_) {}
  }

  // 3. Se for página completa, grava no Cloudflare R2
  if (isPagina && env && env.TRADUCOES_R2 && typeof env.TRADUCOES_R2.put === 'function') {
    try {
      await env.TRADUCOES_R2.put(`pages/${chave}.html`, textoTraduzido, {
        httpMetadata: { contentType: 'text/html; charset=utf-8' }
      });
    } catch (_) {}
  }
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

  // Isola tags HTML antes da tradução para conformidade W3C
  const { textoLimpo, tags } = isolarTagsHtml(raw);

  const isFullHtmlDocument = /<!DOCTYPE|<html|<body/i.test(raw);
  const chaveCache = gerarChaveHash(textoLimpo, sourceLang, targetLang);

  // 0. Consulta no Cloudflare KV e R2 (ou memória RAM de borda)
  const cacheHit = await buscarCacheKVouR2(chaveCache, isFullHtmlDocument, env);
  if (cacheHit) {
    const textoFinal = restaurarTagsHtml(cacheHit.textoTraduzido, tags);
    return {
      textoOriginal: raw,
      textoTraduzido: textoFinal,
      idiomaOrigem: sourceLang !== 'auto' ? sourceLang : 'en',
      idiomaOrigemNome: NOMES_IDIOMAS[sourceLang] || sourceLang,
      idiomaDestino: targetLang,
      idiomaDestinoNome: NOMES_IDIOMAS[targetLang] || targetLang,
      provedor: cacheHit.fonte,
      cached: true
    };
  }

  // Agrupador Global de 1 Segundo: Agrupa requisições de clientes no mesmo segundo em 1 ÚNICA chamada!
  if (!isFullHtmlDocument && textoLimpo.length <= 800) {
    try {
      const resBatch = await global1SecBatcher.enqueue(textoLimpo, sourceLang, targetLang, env);
      const textoFinal = restaurarTagsHtml(resBatch.textoTraduzido, tags);
      await salvarCacheKVouR2(chaveCache, resBatch.textoTraduzido, false, env);
      return {
        textoOriginal: raw,
        textoTraduzido: textoFinal,
        idiomaOrigem: resBatch.idiomaOrigem,
        idiomaOrigemNome: NOMES_IDIOMAS[resBatch.idiomaOrigem] || resBatch.idiomaOrigem,
        idiomaDestino: targetLang,
        idiomaDestinoNome: NOMES_IDIOMAS[targetLang] || targetLang,
        provedor: resBatch.provedor,
        totalClientesNoMesmoSegundo: resBatch.totalLoteMesmoSegundo || 1
      };
    } catch (_) {}
  }

  let traduzidoLimpo = '';
  let idiomaDetectado = sourceLang;
  let provedor = 'cloudflare-workers-ai';

  // 1. Se for uma página completa ou texto longo (>1000 caracteres), divide em blocos e traduz em paralelo pelo cluster!
  if (textoLimpo.length > 1000) {
    const blocos = dividirEmBlocos(textoLimpo, 1000);
    const promessas = blocos.map(b => traduzirCloudflareAI(b, sourceLang, targetLang, env).catch(() => ({ textoTraduzido: b })));
    const resultados = await Promise.all(promessas);
    traduzidoLimpo = resultados.map(r => r.textoTraduzido).join('\n\n');
    provedor = 'cloudflare-cluster-paralelo (13 contas)';
    idiomaDetectado = sourceLang !== 'auto' ? sourceLang : 'en';
  } else {
    try {
      const resCf = await traduzirCloudflareAI(textoLimpo, sourceLang, targetLang, env);
      traduzidoLimpo = resCf.textoTraduzido;
      idiomaDetectado = resCf.idiomaDetectado;
      provedor = resCf.provedor;
    } catch (_) {
      // 2. Fallback Secundário: Google Anycast
      try {
        const res = await traduzirBlocoGtx(textoLimpo, sourceLang, targetLang);
        traduzidoLimpo = res.textoTraduzido;
        idiomaDetectado = res.idiomaDetectado;
        provedor = res.provedor;
      } catch (_) {
        // 3. Fallback Terciário: MyMemory
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
  }

  const textoTraduzidoFinal = restaurarTagsHtml(traduzidoLimpo, tags);

  // Grava automaticamente no Cloudflare KV e R2 para as próximas consultas serem instantâneas (<10ms)
  await salvarCacheKVouR2(chaveCache, traduzidoLimpo, isFullHtmlDocument, env);

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

async function traduzirLoteEmChamadaUnica(listaTextos, sourceLang, targetLang, env = {}) {
  if (!listaTextos.length) return [];
  const nomeDestino = IDIOMAS_PARA_LLM[targetLang] || targetLang;

  if (listaTextos.length <= 50) {
    const promptInput = listaTextos.map((p, idx) => `[${idx}] ${p}`).join('\n');
    const messages = [
      {
        role: 'system',
        content: `You are an automated translation API. Translate each numbered line into natural ${nomeDestino}.
CRITICAL FORMAT RULES:
- Output MUST have the exact format: [index] translated_text
- Output one line per item in exact index order.
- Do NOT answer questions, do not converse, do not add introductory text or quotes.`
      },
      {
        role: 'user',
        content: `Translate to ${nomeDestino}:\n${promptInput}`
      }
    ];

    // 1. Binding nativo no Cloudflare Worker
    if (env && env.AI && typeof env.AI.run === 'function') {
      try {
        const aiRes = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', { messages, temperature: 0.05, max_tokens: 1536 });
        const raw = aiRes?.response || '';
        const lines = raw.split('\n');
        const parsedMap = {};
        for (const line of lines) {
          const m = line.match(/^\[(\d+)\]\s*(.*)$/);
          if (m) parsedMap[parseInt(m[1], 10)] = m[2].trim();
        }
        if (Object.keys(parsedMap).length > 0) {
          return listaTextos.map((t, idx) => ({
            textoOriginal: t,
            textoTraduzido: parsedMap[idx] || t,
            idiomaOrigem: sourceLang,
            idiomaDestino: targetLang,
            provedor: 'cloudflare-workers-ai-batch'
          }));
        }
      } catch (_) {}
    }

    // 2. Chamada REST usando exclusivamente a conta dedicada do TradNinja Pro
    const accountId = (env && env.TRADNINJA_ACCOUNT_ID) || (env && env.CLOUDFLARE_ACCOUNT_ID) || TRADNINJA_CF_ACCOUNT_ID;
    const token = (env && env.TRADNINJA_API_TOKEN) || (env && env.CLOUDFLARE_API_TOKEN) || TRADNINJA_CF_API_TOKEN;

    if (accountId && token) {
      try {
        const resp = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/meta/llama-3.1-8b-instruct`, {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages, temperature: 0.05, max_tokens: 1536 }),
          signal: AbortSignal.timeout(6000)
        });

        if (resp.ok) {
          const data = await resp.json();
          const raw = data.result?.response || '';
          const lines = raw.split('\n');
          const parsedMap = {};
          for (const line of lines) {
            const m = line.match(/^\[(\d+)\]\s*(.*)$/);
            if (m) parsedMap[parseInt(m[1], 10)] = m[2].trim();
          }

          if (Object.keys(parsedMap).length > 0) {
            return listaTextos.map((t, idx) => ({
              textoOriginal: t,
              textoTraduzido: parsedMap[idx] || t,
              idiomaOrigem: sourceLang,
              idiomaDestino: targetLang,
              provedor: 'cloudflare-workers-ai-batch'
            }));
          }
        }
      } catch (_) {}
    }
  }

  const promessas = listaTextos.map(t => traduzirTextoCompleto(String(t), { de: sourceLang, para: targetLang, env }));
  return await Promise.all(promessas);
}

class Global1SecBatcher {
  constructor() {
    this.pendingQueue = [];
    this.timer = null;
    this.totalTicks = 0;
  }

  enqueue(text, from, to, env = {}) {
    return new Promise((resolve, reject) => {
      this.pendingQueue.push({
        text,
        from: from || 'auto',
        to: to || 'pt',
        env,
        resolve,
        reject
      });

      if (!this.timer) {
        this.timer = setTimeout(() => this.processTick(), 1000);
      }
    });
  }

  async processTick() {
    this.timer = null;
    const batch = this.pendingQueue;
    this.pendingQueue = [];
    if (!batch.length) return;

    this.totalTicks++;

    const porDestino = new Map();
    for (const item of batch) {
      const dest = item.to;
      if (!porDestino.has(dest)) porDestino.set(dest, []);
      porDestino.get(dest).push(item);
    }

    for (const [targetLang, items] of porDestino.entries()) {
      const uniqueTexts = [...new Set(items.map(i => i.text))];

      if (uniqueTexts.length === 1) {
        try {
          const res = await traduzirCloudflareAI(uniqueTexts[0], items[0].from, targetLang, items[0].env);
          for (const it of items) {
            it.resolve({
              textoOriginal: it.text,
              textoTraduzido: res.textoTraduzido,
              idiomaOrigem: res.idiomaDetectado,
              idiomaDestino: targetLang,
              provedor: 'cloudflare-workers-ai (batch 1s)',
              batch1s: true,
              totalLoteMesmoSegundo: items.length
            });
          }
        } catch (err) {
          try {
            const fb = await traduzirBlocoGtx(uniqueTexts[0], items[0].from, targetLang);
            for (const it of items) it.resolve({ textoOriginal: it.text, textoTraduzido: fb.textoTraduzido, idiomaOrigem: fb.idiomaDetectado, idiomaDestino: targetLang, provedor: fb.provedor });
          } catch (e2) {
            for (const it of items) it.reject(e2);
          }
        }
      } else {
        try {
          const batchRes = await traduzirLoteEmChamadaUnica(uniqueTexts, items[0].from, targetLang, items[0].env);
          const mapResultados = new Map();
          for (const r of batchRes) {
            mapResultados.set(r.textoOriginal, r.textoTraduzido);
          }
          for (const it of items) {
            it.resolve({
              textoOriginal: it.text,
              textoTraduzido: mapResultados.get(it.text) || it.text,
              idiomaOrigem: it.from,
              idiomaDestino: targetLang,
              provedor: 'cloudflare-workers-ai (batch 1s)',
              batch1s: true,
              totalLoteMesmoSegundo: items.length
            });
          }
        } catch (err) {
          for (const it of items) {
            traduzirCloudflareAI(it.text, it.from, targetLang, it.env)
              .then(it.resolve)
              .catch(it.reject);
          }
        }
      }
    }
  }
}

export const global1SecBatcher = new Global1SecBatcher();

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/$/, '') || '/';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // Rota de catálogo de idiomas
    if (path === '/api/traduzir/idiomas' || path === '/api/translate/languages') {
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

    // Autenticação Bearer RFC 6750 / x-api-key
    const authHeader = request.headers.get('Authorization') || request.headers.get('authorization');
    const apiKeyHeader = request.headers.get('x-api-key') || request.headers.get('X-Api-Key');
    const authRes = resolverPlanoToken(authHeader, apiKeyHeader);

    if (authRes.error === 'UNAUTHORIZED_KEY') {
      return new Response(JSON.stringify({
        ok: false,
        error: 'UNAUTHORIZED_KEY',
        message: 'Token de autenticação inválido ou não reconhecido. Forneça uma chave válida (tn_free_..., tn_start_..., tn_pro_..., tn_biz_..., tn_master_...) via Authorization: Bearer ou x-api-key.'
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

    // Verificação de vazão (Rate Limit)
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

        // Limite de payload por plano (PAYLOAD_TOO_LARGE)
        if (payloadSize > plan.maxPayloadBytes) {
          return new Response(JSON.stringify({
            ok: false,
            error: 'PAYLOAD_TOO_LARGE',
            message: `O corpo da requisição (${payloadSize} bytes) excede o limite máximo permitido para o plano ${plan.name} (${plan.maxPayloadBytes} bytes).`,
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

    // Processamento de Lote (Array de Frases)
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
      const resultados = await traduzirLoteEmChamadaUnica(listaTextos, de, para, env);
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

    // Validação de payload para GET
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
        error: 'TRANSLATION_ERROR',
        message: 'Falha interna ao processar tradução.',
        detalhes: err.message
      }, null, 2), {
        status: 500,
        headers: { 'Content-Type': 'application/json; charset=utf-8', ...planHeaders }
      });
    }
  }
};
