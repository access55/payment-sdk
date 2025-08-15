# Melhorias na Integração Yuno SDK v1.1

## Principais Correções Implementadas

### 1. **Fluxo Correto do SDK**
Implementado o fluxo completo conforme a documentação oficial:

```javascript
// Antes (incorreto)
yuno.startCheckout() → Callback direto

// Depois (correto)
yuno.startCheckout() → yuno.mountCheckout() → yuno.startPayment() → Callbacks
```

### 2. **Adicionado `mountCheckout()`**
- Agora o SDK monta corretamente os formulários no DOM
- Exibe os métodos de pagamento disponíveis

### 3. **Método `startPayment()` Exposto**
- Disponível em `window.A55Pay.startPayment()`
- Deve ser chamado quando o usuário quiser iniciar o pagamento

### 4. **Callback `yunoCreatePayment` Melhorado**
- Agora suporta `tokenWithInformation` (dados adicionais como parcelamento)
- Verifica se `sdk_action_required` antes de chamar `continuePayment()`
- Gerencia redirecionamentos customizados quando necessário

### 5. **Callback `yunoError` Corrigido**
- Agora recebe `(message, data)` conforme a documentação
- Melhor tratamento de erros

## Como Usar

### Exemplo Básico
```html
<div id="yuno-checkout"></div>
<div id="yuno-checkout-action"></div>
<button onclick="A55Pay.startPayment()">Pagar Agora</button>

<script>
A55Pay.checkout({
  selector: '#yuno-checkout',
  charge_uuid: 'seu-charge-uuid',
  checkoutSession: 'sua-checkout-session',
  apiKey: 'sua-api-key',
  countryCode: 'BR',
  onReady: () => {
    console.log('Checkout pronto');
    // Agora o usuário pode ver os métodos de pagamento
  },
  onSuccess: (result) => {
    console.log('Pagamento realizado:', result);
  },
  onError: (error) => {
    console.error('Erro no pagamento:', error);
  }
});
</script>
```

### Exemplo com Botão Personalizado
```html
<div id="yuno-checkout"></div>
<div id="yuno-checkout-action"></div>

<button id="meu-botao-pagamento" disabled>
  Processar Pagamento
</button>

<script>
A55Pay.checkout({
  selector: '#yuno-checkout',
  charge_uuid: 'seu-charge-uuid',
  checkoutSession: 'sua-checkout-session',
  apiKey: 'sua-api-key',
  onReady: () => {
    // Habilitar botão quando checkout estiver pronto
    document.getElementById('meu-botao-pagamento').disabled = false;
  },
  onSuccess: (result) => {
    if (result.pending) {
      // Pagamento pendente
      console.log('Pagamento pendente:', result.status);
    } else {
      // Pagamento concluído
      window.location.href = '/sucesso';
    }
  },
  onError: (error) => {
    alert('Erro: ' + error.message);
  }
});

// Conectar botão personalizado
document.getElementById('meu-botao-pagamento').addEventListener('click', () => {
  if (window.A55Pay && window.A55Pay.startPayment) {
    window.A55Pay.startPayment();
  }
});
</script>
```

## Novos Recursos Disponíveis

### 1. **Suporte a Redirecionamentos Customizados**
O SDK agora detecta quando é necessário redirecionamento e permite customização:

```javascript
// No callback yunoCreatePayment, se result.sdk_action_required = true
const continueResult = await yuno.continuePayment({ showPaymentStatus: true });

if (continueResult && continueResult.action === 'REDIRECT_URL') {
  // Gerenciar redirecionamento customizado
  console.log('URLs de redirecionamento:', continueResult.redirect);
  // continueResult.redirect.init_url
  // continueResult.redirect.success_url  
  // continueResult.redirect.error_url
}
```

### 2. **Informações Adicionais do Token**
O callback agora recebe dados extras do formulário:

```javascript
yunoCreatePayment(oneTimeToken, tokenWithInformation) {
  // tokenWithInformation pode conter:
  // - Dados de parcelamento
  // - Tipo/número do documento
  // - Outras informações do checkout
}
```

### 3. **Estados de Loading Melhorados**
Classes CSS automáticas para feedback visual:

```css
.yuno-loading {
  opacity: 0.6;
  pointer-events: none;
}

.yuno-loading::after {
  content: 'Processando...';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
```

### 4. **Configurações Adicionais Disponíveis**
```javascript
A55Pay.checkout({
  // ... outras configurações
  
  // Configurações de cartão
  card: {
    type: "extends", // ou "step"
    cardSaveEnable: true, // checkbox para salvar cartão
    isCreditCardProcessingOnly: true // processar sempre como crédito
  },
  
  // Textos customizados
  texts: {
    customerForm: {
      submitButton: "Continuar Pagamento"
    }
  },
  
  // Controles de interface
  showPayButton: false, // ocultar botão padrão (usar customizado)
  showPaymentStatus: true, // mostrar página de status
  automaticallyUnmount: false // manter formulário para retry
});
```

## Diferenças da Versão Anterior

| Aspecto | Antes | Depois |
|---------|--------|--------|
| Montagem | Automática no startCheckout | Explícita com mountCheckout() |
| Início do Pagamento | Automático | Manual com startPayment() |
| Callbacks | Limitados | Completos conforme documentação |
| Redirecionamentos | Não suportado | Totalmente suportado |
| Estados de Loading | Básico | Avançado com classes CSS |
| Retry de Pagamentos | Não suportado | Suportado com automaticallyUnmount |

## Próximos Passos

1. **Testar a integração** com os novos callbacks
2. **Implementar CSS** para estados de loading
3. **Adicionar validações** nos formulários customizados
4. **Configurar webhooks** para confirmação de pagamentos
5. **Implementar retry** de pagamentos rejeitados
