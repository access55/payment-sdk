# 🚀 Guia Rápido - Sentry no A55Pay SDK

## ⚡ Início em 3 Passos

### 1️⃣ Obter o DSN do Sentry

```bash
# Acesse https://sentry.io
# Crie um projeto JavaScript
# Copie o DSN (exemplo): https://abc123@o123.ingest.sentry.io/456
```

### 2️⃣ Adicionar o Script do SDK

```html
<!-- Adicione no seu HTML -->
<script src="dist/a55pay-sdk.js"></script>
```

### 3️⃣ Inicializar e Usar

```javascript
// Inicializar Sentry (faça isso UMA VEZ, antes de qualquer pagamento)
A55Pay.initSentry({
  dsn: 'SEU_DSN_AQUI'
});

// Usar normalmente - Sentry rastreará TUDO automaticamente!
A55Pay.payV2({
  charge_uuid: 'uuid-da-cobrança',
  userData: {
    payer_name: 'João da Silva',
    payer_email: 'joao@example.com',
    holder_name: 'JOAO DA SILVA',
    number: '1234567890123456',
    expiry_month: '12',
    expiry_year: '2025',
    ccv: '123',
    postal_code: '12345678',
    street: 'Rua Exemplo',
    city: 'São Paulo',
    state: 'SP',
    country: 'BR'
  },
  onSuccess: (result) => console.log('✅ Sucesso!', result),
  onError: (error) => console.error('❌ Erro!', error)
});
```

## ✨ Pronto! 

Agora você tem:

- ✅ **Rastreamento automático** de todos os erros
- ✅ **Breadcrumbs** de cada etapa do pagamento
- ✅ **Contexto completo** de cada transação
- ✅ **Métricas de performance** em tempo real
- ✅ **Alertas** quando algo der errado

## 📊 Visualizar no Sentry

1. Acesse https://sentry.io
2. Vá para seu projeto
3. Veja os erros em **Issues**
4. Veja a performance em **Performance**
5. Configure alertas em **Alerts**

## 🎯 Exemplo Completo

Veja o arquivo `examples/sentry-example.html` para um exemplo completo e funcional.

## 📚 Documentação Completa

Para mais detalhes, veja `SENTRY_INTEGRATION.md`

---

**💡 Dica**: Em desenvolvimento, use `environment: 'development'` para separar os erros de produção.

```javascript
A55Pay.initSentry({
  dsn: 'SEU_DSN_AQUI',
  environment: window.location.hostname === 'localhost' ? 'development' : 'production'
});
```

