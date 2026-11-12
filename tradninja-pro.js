/**
 * tradninja-pro.js
 * SDK Oficial TradNinja Pro para Node.js e Navegador
 * 
 * @license MIT
 */

export class TradNinjaClient {
  constructor(apiKey = 'tn_free_client', options = {}) {
    this.apiKey = apiKey;
    this.baseUrl = (options.baseUrl || 'https://ponte.ozpro.com.br/api/translate').replace(/\/$/, '');
  }

  async translate(text, options = {}) {
    const { from = 'auto', to = 'pt' } = options;
    const resp = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ texto: text, de: from, para: to })
    });

    const data = await resp.json();
    if (!resp.ok) {
      const err = new Error(data.message || `Erro HTTP ${resp.status}`);
      err.code = data.error;
      err.status = resp.status;
      err.retryAfter = resp.headers.get('Retry-After');
      throw err;
    }
    return data;
  }

  async translateBatch(phrases, options = {}) {
    const { from = 'auto', to = 'pt' } = options;
    const resp = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ phrases, de: from, para: to })
    });

    const data = await resp.json();
    if (!resp.ok) {
      const err = new Error(data.message || `Erro HTTP ${resp.status}`);
      err.code = data.error;
      err.status = resp.status;
      throw err;
    }
    return data;
  }
}

export default TradNinjaClient;
