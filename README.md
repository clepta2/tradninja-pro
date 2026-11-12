# TradNinja Pro — SDK & API Oficial de Tradução Neural na Borda (<35ms)

SDK oficial e cliente HTTP de alta performance para a **TradNinja Pro API**, executada na infraestrutura Anycast Cloudflare Edge com latência sub-35ms, isolamento de tags W3C, detecção automática de idiomas e suporte a autenticação **Bearer RFC 6750**.

---

## 🚀 Padrão Oficial de Autenticação (Bearer RFC 6750)

Todas as requisições autenticadas devem enviar o cabeçalho padrão HTTP:

```http
Authorization: Bearer tn_live_SEU_TOKEN_AQUI
```

*(Compatível também com o cabeçalho alternativo `x-api-key: tn_live_...`)*

### Prefixos Inteligentes de Chaves & Resolução de Nível

| Prefixo | Plano Correspondente | Nível de Acesso |
| :--- | :--- | :--- |
| `tn_free_...` | **Free / Sandbox** | Desenvolvimento, testes e sites de baixo tráfego |
| `tn_start_...` | **Starter** | Pequenos comércios e landing pages |
| `tn_pro_...` | **Pro** | SaaS, e-commerces em escala e portais de mídia |
| `tn_biz_...` | **Business / Enterprise** | Grandes corporações, multi-lojas e alto volume |
| `tn_master_...` | **Master Admin** | Gestão de catálogo, bypass irrestrito e infraestrutura |

---

## 📊 Matriz Oficial de Planos & Limitações de Vazão (Rate Limits)

Refletida nos cabeçalhos de resposta `x-tradninja-plan` e `x-tradninja-max-phrases`:

| Plano | Rate Limit (Vazão) | Frases / Lote | Payload Máx. HTML | Cota Diária | Suporte |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 🟢 **Free / Sandbox** | 30 RPM (0.5 req/s) | 50 frases | 1 MB | 500 req/dia | Comunidade |
| 🔵 **Starter** | 60 RPM (1.0 req/s) | 100 frases | 2 MB | 2.000 req/dia | Padrão |
| 🟣 **Pro** | 300 RPM (5.0 req/s) | 500 frases | 5 MB | 20.000 req/dia | Prioritário |
| 🟠 **Business** | 1.200 RPM (20.0 req/s) | 1.000 frases | 8 MB | 100.000 req/dia | SLA 99.9% 24/7 |
| 🔴 **Master Admin** | 3.000 RPM (50.0 req/s) | 2.000 frases | 15 MB | Ilimitado | Engenharia Dedicada |

---

## 💻 Snippets Multi-Linguagem

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

### 4. PHP (curl_init)
```php
<?php
$ch = curl_init('https://ponte.ozpro.com.br/api/translate');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer tn_pro_live_sandbox',
    'Content-Type: application/json'
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([
    'texto' => 'Hello world, welcome to our edge APIs',
    'de' => 'auto',
    'para' => 'pt'
]));
$response = curl_exec($ch);
curl_close($ch);
echo $response;
?>
```

### 5. C# (.NET HttpClient)
```csharp
using System;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;

class Program {
    static async Task Main() {
        var client = new HttpClient();
        client.DefaultRequestHeaders.Add("Authorization", "Bearer tn_pro_live_sandbox");
        var json = "{\"texto\": \"Hello world\", \"de\": \"auto\", \"para\": \"pt\"}";
        var content = new StringContent(json, Encoding.UTF8, "application/json");
        var resp = await client.PostAsync("https://ponte.ozpro.com.br/api/translate", content);
        Console.WriteLine(await resp.Content.ReadAsStringAsync());
    }
}
```

---

## ⚠️ Tratamento Tipado de Erros

| Código HTTP | Erro Tipado | Causa |
| :--- | :--- | :--- |
| **400** | `PHRASE_LIMIT_EXCEEDED` | Quantidade de frases no lote excede o limite do plano. |
| **401** | `UNAUTHORIZED_KEY` | Chave de API ausente ou com prefixo não reconhecido. |
| **413** | `PAYLOAD_TOO_LARGE` | Tamanho do corpo da requisição excede os bytes do plano. |
| **429** | `RATE_LIMIT_EXCEEDED` | Requisições por minuto excederam a cota. Cabeçalho `Retry-After: 60`. |

---

## 📄 Licença

MIT License &bull; clepta2 &bull; Ponte APIs Marketplace Oficial
