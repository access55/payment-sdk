## SDK Checkout A55Pay — Guia de Integração

Este guia mostra como integrar o SDK de checkout (`A55Pay.checkout`) para processar pagamentos via A55 .

- **Fluxo resumido**:
  1. Criar a charge na API A55 e obter `charge_uuid` e `session_id`.
  2. Renderizar o checkout com `A55Pay.checkout` usando `chargeUuid` e `checkoutSession`.
  3. Receber o webhook de status e atualizar o pedido no seu sistema.

### 1) Criar a charge na API A55

- **Endpoint**: `POST https://core-manager.a55.tech/api/v1/bank/wallet/charge/`
- **Headers**: `Content-Type: application/json` e `Authorization: Bearer <SEU_TOKEN>`
- **Payload (exemplo)**:

```json
{
  "wallet_uuid": "9f4cdd29-2b9d-4df4-a8cc-5f8d6d3c2e5a",
  "merchant_id": "d7f8a4b1-7132-4e21-9bcb-1a0a13d3b6f7",
  "payer_name": "João da Silva Souza",
  "payer_email": "joao.souza@example.com",
  "payer_address": {
    "street": "Avenida Paulista",
    "address_number": "1000",
    "complement": "Conjunto 1205",
    "neighborhood": "Bela Vista",
    "city": "São Paulo",
    "state": "SP",
    "postal_code": "01310200",
    "country": "BR"
  },
  "currency": "BRL",
  "installment_value": 150.0,
  "due_date": "2025-08-14",
  "description": "Assinatura mensal do plano Premium",
  "type_charge": "credit_card"
}
```

- **Resposta (campos relevantes)**: use `charge_uuid` e `session_id` na etapa do checkout.

```json
{
  "charge_uuid": "dfc047f5-519d-4892-8380-7f8aaf9e6958",
  "session_id": "f8502004-e083-47c0-a582-3bd5df4e65eb"
}
```

### 2) Renderizar o checkout (A55Pay)

Inclua o SDK e inicialize o checkout informando o container, a charge e a sessão.

```html
<!-- Container onde  montará o checkout -->
<div id="checkout-container"></div>
<div id="checkout-container-action"></div>

<!-- Botão para iniciar o pagamento -->
<button id="pay-btn">Continuar</button>

<!-- A55Pay SDK -->
<script src="./src/a55pay-sdk.js"></script>

<script>
  const selector = '#checkout-container';
  const chargeUuid = 'dfc047f5-519d-4892-8380-7f8aaf9e6958'; // charge_uuid retornado pela API
  const checkoutSession = 'f8502004-e083-47c0-a582-3bd5df4e65eb'; // session_id retornado pela API
  const apiKey = '<SUA_API_KEY_PUBLIC>'; // use a chave do ambiente (sandbox/produção)

  A55Pay.checkout({
    selector,
    chargeUuid,
    checkoutSession,
    apiKey,
    countryCode: 'BR',
    onReady: function () {
      console.log('habilite UI');
    },
    onSuccess: function (result) {
      // Sucesso, pendente ou aprovado
      console.log('Pagamento:', result);
    },
    onError: function (error) {
      console.error('Erro no pagamento:', error);
    },
    onLoading: function ({ isLoading }) {
      // Feedback visual opcional
      console.log('habilite UI');
    }
  });

  // Dispare o fluxo de pagamento quando o usuário confirmar
  document.getElementById('pay-btn').addEventListener('click', function () {
    A55Pay.startPayment();
  });
</script>
```

- **Atenção aos nomes dos campos**: no SDK use `chargeUuid` (camelCase) e `checkoutSession`. Eles correspondem à resposta da criação da charge: `charge_uuid` e `session_id`.

### 3) Webhooks de status

Após o processamento, o A55 enviará webhooks para a URL configurada no seu cadastro. Utilize o webhook para confirmar e atualizar o status do pedido no seu sistema.

- **Possíveis status (exemplos)**: `confirmed`, `error`, `issued`, `pending`
- **Exemplo de payload**:

```json
{
  "charge_uuid": "dfc047f5-519d-4892-8380-7f8aaf9e6958",
  "status": "confirmed",
 
}
```

Trate o webhook como fonte de verdade para a conciliação. Garanta idempotência (ex.: usando `charge_uuid` como chave) e responda com `200 OK` ao receber e processar com sucesso.



### Erros comuns

- Falta de parâmetros obrigatórios no SDK: verifique `selector`, `chargeUuid`, `checkoutSession` e `apiKey`.
- `Selector not found`: confirme o `id`/`query` do container no DOM antes de inicializar o checkout.
- Confusão entre `charge_uuid` (na API) e `chargeUuid` (no SDK). Faça a conversão correta para camelCase no front.
- CORS/Autorização na criação de charge: a criação via `/wallet/charge/` deve ser feita no backend do seu sistema, com `Authorization: Bearer ...`.

### Ambiente e endpoints

- Criar charge: `POST https://core-manager.a55.tech/api/v1/bank/wallet/charge/`
- Pagar charge (feito pelo SDK): `POST https://core-manager.a55.tech/api/v1/bank/public/charge/{chargeUuid}/pay`

### Exemplo completo (recomendado para testes)

Veja `examples/test.html` para um exemplo funcional utilizando `A55Pay.checkout`, botão de pagamento e logs de estado.

# A55Pay SDK

Embeddable Payment SDK for 3DS integration (Access55) with SDK support

## Features

- **3DS Integration**: Built-in support for 3D Secure authentication via Braspag
- **SDK Integration**: Full integration with payment platform
- **Dynamic Script Loading**: Automatically loads required dependencies
- **Error Handling**: Comprehensive error handling and validation
- **Flexible Configuration**: Customizable payment flows and options

## Usage

The A55Pay SDK provides two main integration methods:

### 1. 3DS Integration (A55Pay.pay)

Traditional 3D Secure integration with Braspag for card payments.

### 2. SDK Integration (A55Pay.checkout)

Modern payment processing through Yuno platform with support for multiple payment methods.

# payment-sdk

<script src="dist/a55pay-sdk.min.js"></script>

```

> **Note:** Always use `@latest` to ensure you get the most recent version. Version bumps are handled automatically by our CI/CD pipeline.

## Build

```
pnpm install
pnpm run build:dev   # Regular build
pnpm run build       # Minified build
```
# Package Manager

This project uses [pnpm](https://pnpm.io/) for fast, disk-efficient dependency management. If you don't have pnpm, install it globally:

```
npm install -g pnpm
```

## Deploy to CDN

1. Publish to npm:
   - Update version in package.json
   - Run `npm publish`
2. Your SDK will be available via jsDelivr and UNPKG automatically.


## Purge CDN Cache (jsDelivr)

If you publish a new version and the CDN does not update immediately, you can force-refresh the cache using the jsDelivr purge tool:

1. Go to [https://www.jsdelivr.com/tools/purge](https://www.jsdelivr.com/tools/purge)
2. Enter the full URL of your file, for example:
   - `https://cdn.jsdelivr.net/npm/a55pay-sdk@latest`
3. Click **Purge** to clear the cache and force jsDelivr to fetch the latest version.

This is useful if you or your users are not seeing the latest changes after a new release.

## Automated Publishing

Every push to the `main` branch triggers a GitHub Actions workflow that:
- Installs dependencies with pnpm
- Builds the SDK
- Publishes the latest version to npm with `@latest`

Your SDK will be available via jsDelivr and UNPKG automatically after each publish.

## Directory Structure

- `a55pay-sdk.js` - Source file

- `dist/a55pay-sdk.js` - Bundled (dev) build
- O botão de pagamento só deve ser habilitado após o evento `onReady`.
- Use o callback `onLoading` para feedback visual de carregamento.
- O método `A55Pay.startPayment()` dispara o fluxo de pagamento do Yuno.
- `dist/a55pay-sdk.min.js` - Minified build

## Configuration Options

### 3DS Integration (A55Pay.pay)

#### `forceThreeds`

The `forceThreeds` parameter is a boolean flag that controls the behavior of the SDK when 3DS authentication fails or is not supported.

- **Default:** `true`
- **Description:**
  - When `true`, the SDK will stop the payment process if 3DS authentication fails or is not supported.
  - When `false`, the SDK will proceed with the payment request even if 3DS authentication fails or is not supported.

#### Example Usage

```javascript
A55Pay.pay({
  selector: '#payment-container',
  charge_uuid: 'your-charge-uuid',
  userData: {
    number: '4111 1111 1111 1111',
    month: '12',
    year: '2030',
    cvc: '123',
    holder: 'John Doe',
    phone: '+5511999999999',
    street1: 'Street 1',
    city: 'City',
    state: 'State',
    zipcode: '12345-678',
    country: 'BR',
  },
  forceThreeds: false, // Proceed with payment even if 3DS fails
  onSuccess: (response) => {
    console.log('Payment successful:', response);
  },
  onError: (error) => {
    console.error('Payment failed:', error);
  },
});
```

### Yuno SDK Integration (A55Pay.checkout)

Modern payment integration with Yuno platform supporting multiple payment methods.

#### Example Usage

```javascript
A55Pay.checkout({
  selector: '#checkout-container',
  charge_uuid: 'your-charge-uuid',
  checkoutSession: 'your-checkout-session',
  apiKey: 'your-public-api-key',
  countryCode: 'BR', // Optional, default: 'BR'
  
  onSuccess: function(result) {
    console.log('Payment successful:', result);
    // result.status: 'SUCCEEDED', 'APPROVED', 'PENDING', etc.
    // result.pending: boolean indicating if payment is still processing
  },
  
  onError: function(error) {
    console.error('Payment failed:', error);
  },
  
  onReady: function() {
    console.log('Yuno SDK loaded and ready');
  }
});
```

#### Required Parameters

- **selector** (string): CSS selector for the checkout container element
- **charge_uuid** (string): A55 charge UUID
- **checkoutSession** (string): Yuno checkout session ID
- **apiKey** (string): Yuno public API key

#### Optional Parameters

- **countryCode** (string): Country code (default: 'BR')
- **onSuccess** (function): Success callback
- **onError** (function): Error callback
- **onReady** (function): Ready callback

For detailed Yuno integration documentation, see [YUNO_INTEGRATION.md](./YUNO_INTEGRATION.md).

## Configuration Options (Legacy)

### `forceThreeds`

The `forceThreeds` parameter is a boolean flag that controls the behavior of the SDK when 3DS authentication fails or is not supported.

- **Default:** `true`
- **Description:**
  - When `true`, the SDK will stop the payment process if 3DS authentication fails or is not supported.
  - When `false`, the SDK will proceed with the payment request even if 3DS authentication fails or is not supported.

### Example Usage

```javascript
A55Pay.pay({
  selector: '#payment-container',
  charge_uuid: 'your-charge-uuid',
  userData: {
    number: '4111 1111 1111 1111',
    month: '12',
    year: '2030',
    cvc: '123',
    holder: 'John Doe',
    phone: '+5511999999999',
    street1: 'Street 1',
    city: 'City',
    state: 'State',
    zipcode: '12345-678',
    country: 'BR',
  },
  forceThreeds: false, // Proceed with payment even if 3DS fails
  onSuccess: (response) => {
    console.log('Payment successful:', response);
  },
  onError: (error) => {
    console.error('Payment failed:', error);
  },
});
```

# Navegar para o diretório do projeto
cd /home/leolimasilva123/projetos/payment-sdk

# Iniciar servidor na porta 8000
python3 -m http.server 8000

# Ou especificar uma porta diferente
python3 -m http.server 3000

## License
MIT
