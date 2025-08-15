# Integração com Yuno SDK

Este documento descreve como usar a integração com o Yuno SDK no A55Pay SDK.

## Visão Geral

O A55Pay SDK agora inclui suporte para integração com o Yuno SDK, permitindo processamento de pagamentos através da plataforma Yuno usando o método `SDK.checkout`.

Este guia mostra como integrar o SDK de checkout (`A55Pay.checkout`) para processar pagamentos via A55 .

- **Fluxo resumido**:
  1. Criar a charge na API A55 e obter `charge_uuid` e `session_id`.
  2. Renderizar o checkout com `A55Pay.checkout` usando `chargeUuid` e `checkoutSession`.
  3. Receber o webhook de status e atualizar o pedido no seu sistema.

### 1 Criar a charge na API A55

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

### 2. Incluir o SDK

```html
<script src="a55pay-sdk.js"></script>
```

### 2. HTML Requerido

```html
<div id="checkout-container"></div>
<div id="payment-status"></div>
```

### 3. Uso Básico

```javascript

const chargeUuid = '8683cbc9-07af-4e52-af0b-77d0fa86df03'; // response api (charge_uuid)
const checkoutSession =  '4cd1e07d-c090-434d-a33d-6d382abf4aad'; // response api (session_id)
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
    console.log('Yuno SDK carregado e pronto para uso');
  },
  onLoading: function({ isLoading }) {
      if (isLoading) {
          console.log('carregando...');
          container.classList.add('yuno-loading');
      } else {
          console.log('carregamento finalizado');
      }
  }
});
```

## Parâmetros de Configuração

### Obrigatórios

- **selector** (string): Seletor CSS do elemento onde o checkout será renderizado
- **charge_uuid** (string): UUID da cobrança no sistema A55
- **checkoutSession** (string): ID da sessão de checkout do Yuno
- **apiKey** (string): Chave pública da API do Yuno

### Opcionais

- **countryCode** (string): Código do país (padrão: 'BR')
- **onSuccess** (function): Callback chamado quando o pagamento é bem-sucedido
- **onError** (function): Callback chamado quando ocorre um erro
- **onReady** (function): Callback chamado quando o SDK está pronto para uso
- **onLoading**  (function): Callback chamado quando SDK esta carregando ou aguardando resposta de alguma requisicao



## Exemplo Completo

```html
<!DOCTYPE html>
<html>
<head>
  <title>Pagamento </title>
  <style>
    #yuno-checkout-container {
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
  </style>
</head>
<body>
  <div id="checkout-container"></div>
  <button id="pay-btn" style="margin: 20px 0; width: 100%; font-size: 18px;">Iniciar</button>
  <div id="payment-status"></div>

  <script src="a55pay-sdk.js"></script>
  <script>
    const chargeUuid = 'dfc047f5-519d-4892-8380-7f8aaf9e6958';
    const checkoutSession =  'f8502004-e083-47c0-a582-3bd5df4e65eb';
    const apiKeyPublic = 'sandbox_gAAAAABnk5Yka...';
    const countryCode = 'BR';
    const selector = '#yuno-checkout-container'

    A55Pay.checkout({
      selector: selector,
      charge_uuid: chargeUuid,
      checkoutSession: checkoutSession,
      apiKey: apiKeyPublic,
      countryCode: countryCode, // Opcional, padrão: 'BR'
      
      onSuccess: function(result) {
        console.log('Pagamento realizado com sucesso:', result);
      },
      
      onError: function(error) {
        console.error('Erro no pagamento:', error);
      },
      
      onReady: function() {
        console.log('Yuno SDK carregado e pronto para uso');
      },
      onLoading: function({ isLoading }) {
          if (isLoading) {
              console.log('carregando...');
              container.classList.add('yuno-loading');
          } else {
              console.log('carregamento finalizado');
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

1. **Sessão de Checkout**: A `checkoutSession` deve ser criada previamente através da API do Yuno
2. **API Key**: Use sempre a chave pública do Yuno, nunca a chave privada
3. **HTTPS**: O Yuno SDK requer HTTPS em produção
4. **Compatibilidade**: Testado com navegadores modernos (Chrome, Firefox, Safari, Edge)
5. **Recarregamento**: O SDK recarrega automaticamente a página após conclusão do pagamento para resetar o estado

## Troubleshooting

### Erro: "Failed to load Yuno SDK"
- Verifique a conexão com a internet
- Confirme que o domínio permite carregamento de scripts externos

### Erro: "Selector not found"
- Verifique se o elemento HTML existe no DOM
- Certifique-se de que o script é executado após o carregamento do DOM

### Erro: "Missing required parameters"
- Confirme que todos os parâmetros obrigatórios foram fornecidos
- Verifique se os valores não estão vazios ou undefined

### Pagamento não processa
- Verifique se a `checkoutSession` é válida
- Confirme se a `charge_uuid` existe no sistema A55
- Verifique logs do console para erros adicionais
