# Apple Pay — Guia de Integração

## Pre-requisitos

1. **HTTPS obrigatorio** — Apple Pay nao funciona em HTTP. Em desenvolvimento local use um tunel (ngrok, Cloudflare Tunnel) ou o Safari/Simulator com certificado valido.
2. **Dominio verificado na Apple** — o dominio onde o botao sera exibido precisa estar cadastrado no [Apple Developer Portal](https://developer.apple.com/account/) com o arquivo de verificacao `.well-known/apple-developer-merchantid-domain-association` acessivel via HTTPS.
3. **Merchant Identifier** — crie um Merchant ID em `Certificates, Identifiers & Profiles > Merchant IDs` no Apple Developer Portal.
4. **Safari (macOS ou iOS)** — Apple Pay so esta disponivel no Safari. No iOS funciona em todos os browsers (via Safari WebKit). No macOS requer Safari 11.1+.
5. **Cartao configurado na Wallet** — o usuario precisa ter ao menos um cartao valido na Apple Wallet do dispositivo.

---

## Instalacao via CDN

```html
<script src="https://cdn.jsdelivr.net/npm/a55pay-sdk/dist/a55pay-sdk.min.js"></script>
```

---

## API

### `A55Pay.isApplePayAvailable()`

Verifica sincronamente se Apple Pay esta disponivel no browser/dispositivo atual. Retorna `boolean`.

Use este metodo para decidir se deve exibir o botao Apple Pay na sua UI.

```javascript
if (A55Pay.isApplePayAvailable()) {
  document.getElementById('apple-pay-btn').style.display = 'block';
} else {
  // Ocultar botao ou mostrar metodo alternativo de pagamento
}
```

---

### `A55Pay.startApplePay(config)`

Inicia o fluxo de pagamento Apple Pay. **Deve ser chamado dentro de um handler de clique do usuario** — browsers bloqueiam a abertura do payment sheet se nao houver interacao previa.

#### Parametros

| Parametro           | Tipo       | Obrigatorio | Descricao |
|---------------------|------------|-------------|-----------|
| `chargeUuid`        | `string`   | sim         | UUID da charge criada via API A55 com tipo `applepay` |
| `merchantIdentifier`| `string`   | sim         | Merchant Identifier cadastrado no Apple Developer Portal |
| `countryCode`       | `string`   | sim         | Codigo do pais no formato ISO 3166-1 alpha-2 (ex: `'BR'`, `'US'`). Validado por regex `/^[A-Z]{2}$/` |
| `merchantDomain`    | `string`   | nao         | Dominio do merchant (default: `'pay.a55.tech'`) |
| `displayName`       | `string`   | nao         | Nome exibido no payment sheet (default: `'A55Pay'`) |
| `supportedNetworks` | `string[]` | nao         | Redes suportadas (default: `['visa', 'masterCard', 'elo', 'amex']`) |
| `onSuccess`         | `function` | nao         | Chamado com o resultado do backend apos pagamento confirmado |
| `onError`           | `function` | nao         | Chamado com objeto `Error` em caso de falha |
| `onClose`           | `function` | nao         | Chamado quando o usuario cancela o payment sheet |

#### Exemplo completo

```html
<!-- Botao oficial Apple Pay (Safari 12.1+) -->
<apple-pay-button id="apple-pay-btn" buttonstyle="black" type="pay" locale="pt-BR"
  style="display:none; --apple-pay-button-width:240px; --apple-pay-button-height:44px; --apple-pay-button-border-radius:8px;"></apple-pay-button>

<script src="https://cdn.jsdelivr.net/npm/a55pay-sdk/dist/a55pay-sdk.min.js"></script>
<script>
  var btn = document.getElementById('apple-pay-btn');

  // Exibir botao apenas se Apple Pay estiver disponivel
  if (A55Pay.isApplePayAvailable()) {
    btn.style.display = 'inline-block';
  }

  btn.addEventListener('click', function() {
    A55Pay.startApplePay({
      chargeUuid: 'UUID_DA_CHARGE',
      merchantIdentifier: 'merchant.com.suaempresa.pay',
      countryCode: 'BR',
      merchantDomain: 'www.suaempresa.com.br',
      displayName: 'Sua Empresa',
      supportedNetworks: ['visa', 'masterCard', 'elo', 'amex'],

      onSuccess: function(result) {
        console.log('Pagamento aprovado:', result);
        // Redirecionar para pagina de confirmacao ou atualizar UI
      },

      onError: function(error) {
        console.error('Erro no pagamento:', error.message);
        // Exibir mensagem de erro ao usuario
      },

      onClose: function() {
        console.log('Usuario cancelou o pagamento');
        // Restaurar UI ao estado inicial
      }
    });
  });
</script>
```

---

## Fluxo interno

```
Clique do usuario
  └─> A55Pay.startApplePay()
        ├─> GET /api/v1/bank/public/charge?charge_uuid={uuid}      # busca valor/moeda
        ├─> new ApplePaySession(3, paymentRequest)
        ├─> session.begin()
        │
        ├─> onvalidatemerchant
        │     └─> POST /api/v1/bank/public/charge/applepay/{uuid}/session
        │           body: { validation_url, merchant_domain, display_name }
        │     └─> session.completeMerchantValidation(merchantSession)
        │
        ├─> [usuario autentica com Face ID / Touch ID]
        │
        ├─> onpaymentauthorized
        │     └─> POST /api/v1/bank/public/charge/{uuid}/pay
        │           body: { applepay: { type, wallet_key, ephemeral_public_key } }
        │     ├─> sucesso -> session.completePayment(STATUS_SUCCESS) -> onSuccess
        │     └─> erro   -> session.completePayment(STATUS_FAILURE) -> onError
        │
        └─> oncancel -> onClose
```

---

## Estrutura do payload para /pay

```json
{
  "applepay": {
    "type": "credit_card",
    "wallet_key": "<JSON.stringify(payment.token.paymentData)>",
    "ephemeral_public_key": "<payment.token.paymentData.header.ephemeralPublicKey>"
  }
}
```

O campo `wallet_key` contem o `paymentData` completo serializado como string JSON. O `ephemeral_public_key` e extraido de `paymentData.header.ephemeralPublicKey`.

---

## Codigos de erro

| Situacao | Mensagem de erro |
|----------|-----------------|
| Browser sem suporte | `'Apple Pay nao esta disponivel neste dispositivo ou browser'` |
| `chargeUuid` ausente | `'chargeUuid e obrigatorio para A55Pay.startApplePay()'` |
| `merchantIdentifier` ausente | `'merchantIdentifier e obrigatorio para A55Pay.startApplePay()'` |
| `countryCode` ausente ou invalido | `'countryCode e obrigatorio e deve ser um codigo ISO 3166-1 alpha-2 valido (ex: "BR", "US")'` |
| Sessao ja em andamento | `'Uma sessao Apple Pay ja esta em andamento'` |
| Falha ao buscar charge | `'Falha ao buscar dados da charge'` |
| Falha ao criar sessao | `'Falha ao criar ApplePaySession: <detalhe>'` |
| Timeout na validacao | `'Timeout na validacao do merchant Apple Pay'` |
| Falha na validacao | `'Falha na validacao do merchant Apple Pay'` |
| Falha no pagamento | `'Falha ao processar pagamento Apple Pay'` |

---

## Notas de seguranca

- O `wallet_key` (paymentData da Apple) e criptografado de ponta a ponta — apenas o backend A55 consegue descriptografar.
- Nunca logue ou armazene o `wallet_key` no client.
- A sessao Apple Pay expira em aproximadamente 30 segundos apos `session.begin()` — o merchant validation precisa completar dentro desse prazo (o SDK tem timeout de 10 segundos para a chamada ao backend).

---

## Botao Apple Pay — Brand Guidelines

Use o elemento `<apple-pay-button>` nativo disponivel no Safari, ou siga as [Apple Pay Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/apple-pay) para uso do botao customizado. Nao crie botoes que imitem a aparencia do Apple Pay sem usar os recursos oficiais.

```html
<apple-pay-button
  buttonstyle="black"
  type="pay"
  locale="pt-BR"
  style="--apple-pay-button-width: 240px; --apple-pay-button-height: 44px; --apple-pay-button-border-radius: 8px;">
</apple-pay-button>
```

Valores validos para `buttonstyle`: `black`, `white`, `white-outline`.
Valores validos para `type`: `plain`, `buy`, `pay`, `check-out`, `book`, `subscribe`, `reload`, `add-money`, `top-up`, `order`, `rent`, `support`, `contribute`, `tip`, `donate`.
