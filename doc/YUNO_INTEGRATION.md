# Integração com Yuno SDK

Este documento descreve como usar a integração com o Yuno SDK no A55Pay SDK.

## Visão Geral

O A55Pay SDK agora inclui suporte para integração com o Yuno SDK, permitindo processamento de pagamentos através da plataforma Yuno usando o método `A55Pay.checkout`.

Este guia mostra como integrar o SDK de checkout para processar pagamentos via A55.

## Fluxo de Integração

1. A55 envia para você os dados das credenciais: `client_id`, `secret_key`, `wallet_uuid`, `merchant_uuid`
2. Recupere seu Bearer token usando o `client_id` e `secret_key`
3. Criar a charge na API A55 usando `wallet_uuid` e `merchant_uuid` para obter `charge_uuid` e `session_id`
4. Renderizar o checkout com `A55Pay.checkout` usando `charge_uuid` e `session_id`
5. Receber o webhook de status e atualizar o pedido no seu sistema

## 1. Recuperar Token da API A55

- **Endpoint**: `POST https://smart-capital.auth.us-east-1.amazoncognito.com/oauth2/token`
- **Headers**: `Content-Type: application/x-www-form-urlencoded`
- **Body**:
```
grant_type=client_credentials&client_id=SEU_CLIENT_ID&client_secret=SEU_SECRET_KEY
```

## 2. Criar a Charge na API A55

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

## 3. Incluir o SDK

```html
<script src="a55pay-sdk.js"></script>
```

## 4. HTML Requerido

```html
<div id="checkout-container"></div>
<div id="payment-status"></div>
```

## 5. Uso Básico

```javascript
const chargeUuid = 'dfc047f5-519d-4892-8380-7f8aaf9e6958'; // response api (charge_uuid)
const checkoutSession = 'f8502004-e083-47c0-a582-3bd5df4e65eb'; // response api (session_id)
const apiKey = 'sandbox_gAAAAABnk5Yka5kamCduuZcD2YvWyZrzkF-T0z6cKy_uErMXn5J9hxDg5fTyWRgy1PbQ_k..'; // a55 sent to you 
const countryCode = 'BR';
const selector = '#checkout-container';

A55Pay.checkout({
  selector: selector,
  chargeUuid: chargeUuid,
  checkoutSession: checkoutSession,
  apiKey: apiKey,
  countryCode: countryCode, // Opcional, padrão: 'BR'
  
  onSuccess: function(result) {
    console.log('Pagamento realizado com sucesso:', result);
    // result.status pode ser: 'SUCCEEDED', 'APPROVED', 'PENDING', etc.
    // result.pending indica se o pagamento ainda está sendo processado
  },
  
  onError: function(error) {
    console.error('Erro no pagamento:', error);
  },
  
  onReady: function() {
    console.log('A55Pay SDK carregado e pronto para uso');
  },
  
  onLoading: function({ isLoading }) {
    const container = document.querySelector(selector);
    if (isLoading) {
      console.log('Carregando...');
      container.classList.add('yuno-loading');
    } else {
      console.log('Carregamento finalizado');
      container.classList.remove('yuno-loading');
    }
  }
});
```

## Parâmetros de Configuração

### Obrigatórios

- **selector** (string): Seletor CSS do elemento onde o checkout será renderizado
- **chargeUuid** (string): UUID da cobrança no sistema A55
- **checkoutSession** (string): ID da sessão de checkout do Yuno
- **apiKey** (string): Chave pública da API do Yuno

### Opcionais

- **countryCode** (string): Código do país (padrão: 'BR')
- **onSuccess** (function): Callback chamado quando o pagamento é bem-sucedido
- **onError** (function): Callback chamado quando ocorre um erro
- **onReady** (function): Callback chamado quando o SDK está pronto para uso
- **onLoading** (function): Callback chamado quando SDK está carregando ou aguardando resposta de alguma requisição



## Exemplo Completo

```html
<!DOCTYPE html>
<html>
<head>
  <title>Pagamento A55Pay</title>
  <style>
    #checkout-container {
      max-width: 400px;
      margin: 20px auto;
      padding: 20px;
      border: 1px solid #ddd;
      border-radius: 8px;
    }
    
    .yuno-loading {
      opacity: 0.6;
      pointer-events: none;
      position: relative;
    }
    
    #payment-status {
      margin-top: 20px;
      padding: 10px;
      text-align: center;
      border-radius: 4px;
    }
    
    #pay-btn {
      margin: 20px 0;
      width: 100%;
      font-size: 18px;
      padding: 12px;
      background-color: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    
    #pay-btn:hover {
      background-color: #0056b3;
    }
  </style>
</head>
<body>
  <div id="checkout-container"></div>
  <button id="pay-btn">Iniciar Pagamento</button>
  <div id="payment-status"></div>

  <script src="https://cdn.jsdelivr.net/npm/a55pay-sdk"></script>
  <script>
    const chargeUuid = 'dfc047f5-519d-4892-8380-7f8aaf9e6958';
    const checkoutSession = 'f8502004-e083-47c0-a582-3bd5df4e65eb';
    const apiKey = 'sandbox_gAAAAABnk5Yka...';
    const countryCode = 'BR';
    const selector = '#checkout-container';

    A55Pay.checkout({
      selector: selector,
      chargeUuid: chargeUuid,
      checkoutSession: checkoutSession,
      apiKey: apiKey,
      countryCode: countryCode, // Opcional, padrão: 'BR'
      
      onSuccess: function(result) {
        console.log('Pagamento realizado com sucesso:', result);
        document.getElementById('payment-status').innerHTML = 
          '<div style="color: green;">Pagamento realizado com sucesso!</div>';
      },
      
      onError: function(error) {
        console.error('Erro no pagamento:', error);
        document.getElementById('payment-status').innerHTML = 
          '<div style="color: red;">Erro no pagamento: ' + error.message + '</div>';
      },
      
      onReady: function() {
        console.log('A55Pay SDK carregado e pronto para uso');
      },
      
      onLoading: function({ isLoading }) {
        const container = document.querySelector(selector);
        if (isLoading) {
          console.log('Carregando...');
          container.classList.add('yuno-loading');
        } else {
          console.log('Carregamento finalizado');
          container.classList.remove('yuno-loading');
        }
      }
    });

    // Adicionar evento de click no botão de pagamento
    document.getElementById('pay-btn').addEventListener('click', function() {
      A55Pay.startPayment();
    });
  </script>
</body>
</html>
```

## Notas Importantes

1. **Sessão de Checkout**: A `checkoutSession` deve ser criada previamente através da API A55
2. **API Key**: Use sempre a chave pública fornecida pela A55
3. **HTTPS**: O SDK requer HTTPS em produção
4. **Compatibilidade**: Testado com navegadores modernos (Chrome, Firefox, Safari, Edge)
5. **Autenticação**: Sempre obtenha um token válido antes de criar charges
6. **Webhooks**: Configure webhooks para receber atualizações de status dos pagamentos

## Troubleshooting

### Erro: "Failed to load A55Pay SDK"
- Verifique a conexão com a internet
- Confirme que o domínio permite carregamento de scripts externos
- Verifique se o arquivo `a55pay-sdk.js` está no caminho correto

### Erro: "Selector not found"
- Verifique se o elemento HTML existe no DOM
- Certifique-se de que o script é executado após o carregamento do DOM
- Confirme se o seletor CSS está correto

### Erro: "Missing required parameters"
- Confirme que todos os parâmetros obrigatórios foram fornecidos: `selector`, `chargeUuid`, `checkoutSession`, `apiKey`
- Verifique se os valores não estão vazios ou undefined

### Erro de autenticação
- Verifique se o token Bearer está válido e não expirado
- Confirme se as credenciais `client_id` e `secret_key` estão corretas
- Certifique-se de que está usando o endpoint correto para obter o token

### Pagamento não processa
- Verifique se a `checkoutSession` é válida e não expirada
- Confirme se o `chargeUuid` existe no sistema A55
- Verifique se o `wallet_uuid` e `merchant_uuid` estão corretos
- Consulte os logs do console para erros adicionais
- Confirme se o valor da cobrança é válido
