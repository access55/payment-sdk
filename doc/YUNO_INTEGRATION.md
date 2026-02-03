# Integração com Yuno SDK

Este documento descreve como usar a integração com o Yuno SDK no A55Pay SDK.

## Visão Geral

O A55Pay SDK agora inclui suporte para integração com o Yuno SDK, permitindo processamento de pagamentos através da plataforma Yuno usando o método `SDK.checkout`.

## Configuração Básica

### 1. Incluir o SDK

```html
<script src="a55pay-sdk.js"></script>
```

### 2. HTML Requerido

```html
<div id="yuno-checkout-container"></div>
<div id="yuno-checkout-container-action"></div>
<div id="payment-status"></div>
```

### 3. Uso Básico

```javascript
A55Pay.checkout({
  selector: '#yuno-checkout-container',
  charge_uuid: 'sua-charge-uuid-aqui',
  checkoutSession: 'sua-checkout-session-aqui',
  apiKey: '<YUNO_PUBLIC_API_KEY>',
  countryCode: 'BR', // Opcional, padrão: 'BR'
  
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

## Fluxo de Integração

### 1. Carregamento Dinâmico

O SDK carrega automaticamente o script do Yuno (`https://sdk-web.y.uno/v1.1/main.js`) quando necessário, evitando dependências externas no HTML.

### 2. Inicialização

- Inicializa a instância do Yuno com a API key fornecida
- Configura o checkout com os parâmetros especificados
- Monta o formulário de cartão de crédito

### 3. Processamento de Pagamento

- Quando o usuário submete o formulário, o Yuno gera um token único (OTT)
- O token é enviado para a API A55 para processamento
- O resultado é retornado através dos callbacks

## Status de Pagamento

### Status de Sucesso
- `SUCCEEDED`: Pagamento aprovado
- `APPROVED`: Pagamento aprovado (sinônimo)

### Status Pendentes
- `PENDING`: Pagamento pendente
- `PROCESSING`: Pagamento sendo processado
- `IN_PROGRESS`: Pagamento em andamento

### Status de Erro
- `REJECTED`: Pagamento rejeitado
- `ERROR`: Erro no processamento
- `DECLINED`: Pagamento recusado
- `CANCELLED`: Pagamento cancelado
- `FAILED`: Pagamento falhou

## Tratamento de Erros

O SDK trata automaticamente os seguintes cenários de erro:

1. **Parâmetros faltando**: Validação de parâmetros obrigatórios
2. **Elemento não encontrado**: Validação do seletor CSS
3. **Falha no carregamento do Yuno SDK**: Timeout ou erro de rede
4. **Erro na API A55**: Falhas no processamento do pagamento
5. **Erros do Yuno**: Erros internos do SDK Yuno

## Estilização

### Classes CSS Automáticas

O SDK adiciona automaticamente a classe `yuno-loading` ao container durante operações de carregamento:

```css
.yuno-loading {
  opacity: 0.6;
  pointer-events: none;
}

.yuno-loading::after {
  content: "Processando...";
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
```

## Exemplo Completo

```html
<!DOCTYPE html>
<html>
<head>
  <title>Pagamento com Yuno</title>
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
  <div id="yuno-checkout-container"></div>
  <div id="yuno-checkout-container-action"></div>
  <div id="payment-status"></div>

  <script src="a55pay-sdk.js"></script>
  <script>
    A55Pay.checkout({
      selector: '#yuno-checkout-container',
      charge_uuid: 'your-charge-uuid-here',
      checkoutSession: 'your-checkout-session-here',
      apiKey: '<YUNO_PUBLIC_API_KEY>',
      countryCode: 'BR',
      
      onSuccess: function(result) {
        const statusEl = document.getElementById('payment-status');
        statusEl.textContent = `Pagamento ${result.status}`;
        statusEl.className = 'success';
        
        if (!result.pending) {
          // Pagamento finalizado com sucesso
          setTimeout(() => {
            window.location.href = '/success';
          }, 2000);
        }
      },
      
      onError: function(error) {
        const statusEl = document.getElementById('payment-status');
        statusEl.textContent = `Erro: ${error.message}`;
        statusEl.className = 'error';
      },
      
      onReady: function() {
        console.log('Checkout pronto para uso');
      }
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
