# TradNinja Pro ? SDK & API Oficial de Tradu??o Neural na Borda (<35ms)

SDK oficial e cliente HTTP de alta performance para a **TradNinja Pro API**, executada na infraestrutura Anycast Cloudflare Edge com lat?ncia sub-35ms, isolamento de tags W3C, detec??o autom?tica de idiomas e suporte a autentica??o **RFC 6750**.

---

## ?? IMPORTANTE: Libera??o Pr?via Obrigat?ria no Site

> **Aten??o:** Para consumir esta API em produ??o, o usu?rio precisa ter sua conta ativa e a **API liberada no portal Ponte API Marketplace** (`#minhas-apis`). 
> Cada usu?rio deve gerar sua chave oficial (`tn_pro_...`, `tn_start_...` ou `tn_free_...`) vinculada ao seu saldo e plano aprovado no painel. Chaves n?o liberadas no site retornam status HTTP `401 Unauthorized`.

---

## ?? Padr?o Oficial de Autentica??o (RFC 6750)

Todas as requisi??es autenticadas devem enviar o cabe?alho padr?o HTTP:

```http
Authorization: Bearer tn_pro_SUA_CHAVE_AQUI
```

*(Compat?vel tamb?m com o cabe?alho alternativo `x-api-key: tn_pro_...`)*

### Prefixos Inteligentes de Chaves & Resolu??o de N?vel

| Prefixo | Plano Correspondente | N?vel de Acesso |
| :--- | :--- | :--- |
| `tn_free_...` | **Free / Sandbox** | Desenvolvimento, testes e sites de baixo tr?fego |
| `tn_start_...` | **Starter** | Pequenos com?rcios e landing pages |
| `tn_pro_...` | **Pro** | SaaS, e-commerces em escala e portais de m?dia |
| `tn_biz_...` | **Business / Enterprise** | Grandes corpora??es, multi-lojas e alto volume |
| `tn_master_...` | **Master Admin** | Gest?o de cat?logo, bypass irrestrito e infraestrutura |

---

## ? Rotas Facilitadas por Idioma (/api/translate/:target)

Para quem precisa traduzir rapidamente para um idioma espec?fico sem passar par?metros adicionais, disponibilizamos rotas dedicadas:

| Rota Facilitada | Destino | Exemplo GET Direto |
| :--- | :--- | :--- |
| `/api/translate/pt` | ???? Portugu?s | `/api/translate/pt?q=Hello+world` |
| `/api/translate/en` | ???? Ingl?s | `/api/translate/en?q=Bom+dia` |
| `/api/translate/es` | ???? Espanhol | `/api/translate/es?q=Bom+dia` |
| `/api/translate/fr` | ???? Franc?s | `/api/translate/fr?q=Bom+dia` |
| `/api/translate/de` | ???? Alem?o | `/api/translate/de?q=Bom+dia` |
| `/api/translate/it` | ???? Italiano | `/api/translate/it?q=Bom+dia` |
| `/api/translate/ja` | ???? Japon?s | `/api/translate/ja?q=Bom+dia` |
| `/api/translate/zh` | ???? Chin?s | `/api/translate/zh?q=Bom+dia` |
| `/api/translate/ru` | ???? Russo | `/api/translate/ru?q=Bom+dia` |
| `/api/translate/ar` | ???? ?rabe | `/api/translate/ar?q=Bom+dia` |
| `/api/translate/languages` | ?? Cat?logo | Retorna a lista completa com os 52 idiomas suportados |

---

## ?? Arquitetura Multi-Tier & Resili?ncia Infinita

A TradNinja Pro opera com um cluster de 6 camadas integradas de alta performance:

1. **Camada 0 (RAM Cache Edge):** Cache instant?neo em mem?ria RAM do Isolate (<1ms).
2. **Camada 1 (Cloudflare KV & R2):** Cache Anycast global com persist?ncia em chave-valor (<15ms).
3. **Camada 2 (Groq AI):** Infer?ncia ultra-r?pida Llama 3.3 70B (~200ms) quando configurada.
4. **Camada 3 (Cloudflare Workers AI):** Motor oficial isolado em conta dedicada (Meta Llama 3.1 8B Instruct).
5. **Camada 4 (OpenRouter):** Multi-model failover de conting?ncia.
6. **Camada 5 (Google Anycast GTX):** Motor neural Anycast de alta disponibilidade para 100+ l?nguas.
7. **Camada 6 (MyMemory):** Fallback terci?rio com zero tempo de inatividade.

---

## ?? Matriz Oficial de Planos & Limita??es de Vaz?o (Rate Limits)

Refletida nos cabe?alhos de resposta `x-tradninja-plan` e `x-tradninja-max-phrases`:

| Plano | Rate Limit (Vaz?o) | Frases / Lote | Payload M?x. HTML | Cota Di?ria | Suporte |
| :--- | :--- | :--- | :--- | :--- | :--- |
| ?? **Free / Sandbox** | 30 RPM (0.5 req/s) | 50 frases | 1 MB | 500 req/dia | Comunidade |
| ?? **Starter** | 60 RPM (1.0 req/s) | 100 frases | 2 MB | 2.000 req/dia | Padr?o |
| ?? **Pro** | 300 RPM (5.0 req/s) | 500 frases | 5 MB | 20.000 req/dia | Priorit?rio |
| ?? **Business** | 1.200 RPM (20.0 req/s) | 1.000 frases | 8 MB | 100.000 req/dia | SLA 99.9% 24/7 |
| ?? **Master Admin** | 3.000 RPM (50.0 req/s) | 2.000 frases | 15 MB | Ilimitado | Engenharia Dedicada |

---

## ?? Snippets Multi-Linguagem

### 1. cURL
```bash
curl -X POST "https://ponte.ozpro.com.br/api/translate" \
  -H "Authorization: Bearer tn_pro_live_sandbox" \
  -H "Content-Type: application/json" \
  -d '{"texto": "Hello world, welcome to our edge APIs", "para": "pt"}'
```

### 2. Node.js (Fetch nativo)
```javascript
const resp = await fetch('https://ponte.ozpro.com.br/api/translate', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer tn_pro_live_sandbox',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    texto: 'Hello world, welcome to our edge APIs',
    de: 'auto',
    para: 'pt'
  })
});
const data = await resp.json();
console.log(data.textoTraduzido);
```

### 3. Python (requests)
```python
import requests

url = "https://ponte.ozpro.com.br/api/translate"
headers = {
    "Authorization": "Bearer tn_pro_live_sandbox",
    "Content-Type": "application/json"
}
payload = {
    "texto": "Hello world, welcome to our edge APIs",
    "de": "auto",
    "para": "pt"
}

resp = requests.post(url, json=payload, headers=headers)
print(resp.json()["textoTraduzido"])
```

---

## ?? Tratamento Tipado de Erros

| C?digo HTTP | Erro Tipado | Causa |
| :--- | :--- | :--- |
| **400** | `PHRASE_LIMIT_EXCEEDED` | Quantidade de frases no lote excede o limite do plano. |
| **401** | `UNAUTHORIZED_KEY` | Chave de API ausente ou n?o liberada no site. |
| **413** | `PAYLOAD_TOO_LARGE` | Tamanho do corpo da requisi??o excede os bytes do plano. |
| **429** | `RATE_LIMIT_EXCEEDED` | Requisi??es por minuto excederam a cota. Cabe?alho `Retry-After: 60`. |

---

## ?? Licen?a
Distribu?do sob licen?a MIT.
