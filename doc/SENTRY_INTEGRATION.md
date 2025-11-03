# Integração com Sentry - A55Pay SDK

## 📊 Visão Geral

O A55Pay SDK agora inclui integração completa com o Sentry para monitoramento e rastreamento de erros em tempo real no front-end. Todos os eventos, erros e fluxos de pagamento são automaticamente capturados e enviados para o Sentry.

## 🚀 Configuração Rápida

### 1. Obter DSN do Sentry

Primeiro, você precisa criar um projeto no Sentry e obter o DSN (Data Source Name):

1. Acesse [sentry.io](https://sentry.io)
2. Crie uma conta ou faça login
3. Crie um novo projeto (tipo: JavaScript)
4. Copie o DSN fornecido (formato: `https://[key]@[organization].ingest.sentry.io/[project]`)

### 2. Inicializar o Sentry no SDK

```javascript
// Inicializar o Sentry antes de usar o SDK
A55Pay.initSentry({
  dsn: 'https://seu-dsn@sentry.io/projeto',
  environment: 'production', // ou 'development', 'staging', etc.
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0
});
```

### 3. Usar o SDK Normalmente

```javascript
// O Sentry agora rastreará automaticamente tudo
A55Pay.payV2({
  charge_uuid: 'uuid-da-cobrança',
  userData: {
    payer_name: 'João da Silva',
    payer_email: 'joao@example.com',
    // ... outros dados
  },
  onSuccess: function(result) {
    console.log('Pagamento aprovado!', result);
  },
  onError: function(error) {
    console.error('Erro no pagamento:', error);
  }
});
```

## ⚙️ Opções de Configuração

### `initSentry(config)`

| Parâmetro | Tipo | Obrigatório | Padrão | Descrição |
|-----------|------|-------------|--------|-----------|
| `dsn` | string | ✅ Sim | - | DSN do projeto Sentry |
| `environment` | string | ❌ Não | 'production' | Ambiente (production, development, staging) |
| `tracesSampleRate` | number | ❌ Não | 1.0 | Taxa de amostragem de traces (0.0 a 1.0) |
| `replaysSessionSampleRate` | number | ❌ Não | 0.1 | Taxa de replay de sessões normais (10%) |
| `replaysOnErrorSampleRate` | number | ❌ Não | 1.0 | Taxa de replay quando há erro (100%) |

## 📈 O que é Monitorado

### 1. **Erros Capturados Automaticamente**

- ❌ Erros de validação (dados faltando, inválidos)
- ❌ Erros de autenticação (CyberSource)
- ❌ Erros de requisição de pagamento
- ❌ Erros de detecção de IP
- ❌ Erros de carregamento do iframe 3DS
- ❌ Timeout do 3DS
- ❌ Cancelamento do 3DS pelo usuário
- ❌ Erros ao verificar status da cobrança

### 2. **Breadcrumbs (Rastreamento do Fluxo)**

Todos os eventos importantes são registrados como breadcrumbs:

- 🔷 PayV2 Initiated
- 🔷 PayV2 Ready
- 🔷 PayV2 Validation Error
- 🔷 Collecting Device Info
- 🔷 Device Info Collected
- 🔷 Getting Client IP Address
- 🔷 IP Address Obtained / IP Fetch Failed
- 🔷 Starting Authentication Process
- 🔷 Authentication Success / Authentication Failed
- 🔷 Processing Payment
- 🔷 Sending Payment Request
- 🔷 Payment Response Received
- 🔷 3DS Authentication Required
- 🔷 Opening 3DS Iframe
- 🔷 3DS Iframe Loaded
- 🔷 3DS Auth Complete Message Received
- 🔷 Checking Charge Status After 3DS
- 🔷 Charge Status Retrieved
- 🔷 Payment Confirmed / Payment Failed After 3DS
- 🔷 PayV2 Success

### 3. **Contexto Adicional**

Para cada transação, o Sentry captura:

- **Usuário**: Email e nome do pagador
- **Transação**: UUID da cobrança, método de pagamento
- **Device**: ID do dispositivo, resolução de tela, idioma
- **Tags**: Versão do SDK, status do pagamento, componente

### 4. **Transações de Performance**

O Sentry rastreia a performance de cada pagamento:

- ⏱️ Tempo total do processo de pagamento
- ⏱️ Tempo de autenticação
- ⏱️ Tempo de processamento
- ⏱️ Tempo de resposta da API

## 📊 Visualizando no Dashboard do Sentry

Após configurar, você poderá ver no dashboard do Sentry:

### Issues (Erros)
- Todos os erros agrupados por tipo
- Stack traces completos
- Contexto de cada erro (usuário, transação, device)
- Histórico de eventos antes do erro (breadcrumbs)

### Performance
- Gráficos de tempo de resposta
- Transações mais lentas
- Bottlenecks no processo de pagamento

### Releases
- Erros por versão do SDK
- Comparação entre versões

### Session Replay (se habilitado)
- Replay visual da sessão do usuário
- Ver exatamente o que o usuário fez antes do erro

## 🎯 Exemplos de Uso

### Exemplo Básico

```html
<!DOCTYPE html>
<html>
<head>
    <title>Pagamento com Sentry</title>
</head>
<body>
    <script src="a55pay-sdk.js"></script>
    <script>
        // Inicializar Sentry
        A55Pay.initSentry({
            dsn: 'https://abc123@o123.ingest.sentry.io/456',
            environment: 'production'
        });

        // Processar pagamento
        A55Pay.payV2({
            charge_uuid: 'uuid-exemplo',
            userData: { /* ... */ },
            onSuccess: (result) => console.log('Sucesso!', result),
            onError: (error) => console.error('Erro!', error)
        });
    </script>
</body>
</html>
```

### Exemplo Avançado com Configurações Customizadas

```javascript
// Inicializar com configurações avançadas
A55Pay.initSentry({
    dsn: 'https://abc123@o123.ingest.sentry.io/456',
    environment: window.location.hostname === 'localhost' ? 'development' : 'production',
    
    // Capturar 100% das transações em desenvolvimento, 20% em produção
    tracesSampleRate: window.location.hostname === 'localhost' ? 1.0 : 0.2,
    
    // Session replay: 50% das sessões normais
    replaysSessionSampleRate: 0.5,
    
    // Session replay: 100% quando houver erro
    replaysOnErrorSampleRate: 1.0
});

// Adicionar informações customizadas ao Sentry
if (window.Sentry) {
    window.Sentry.setTag('app_version', '2.0.1');
    window.Sentry.setUser({
        id: 'user-123',
        email: 'usuario@example.com',
        username: 'usuario123'
    });
    window.Sentry.setContext('empresa', {
        id: 'empresa-456',
        nome: 'Minha Empresa'
    });
}

// Processar pagamento
A55Pay.payV2({
    charge_uuid: 'uuid-exemplo',
    userData: { /* ... */ },
    onSuccess: function(result) {
        // Capturar evento customizado de sucesso
        if (window.Sentry) {
            window.Sentry.captureMessage('Pagamento aprovado', {
                level: 'info',
                extra: { charge_uuid: result.charge_uuid, valor: result.amount }
            });
        }
    },
    onError: function(error) {
        // Erro já foi capturado automaticamente pelo SDK
        console.error('Erro:', error);
    }
});
```

## 🔍 Debugging e Testes

### Verificar se o Sentry está Ativo

```javascript
// No console do navegador
if (window.Sentry) {
    console.log('✅ Sentry está ativo!');
    
    // Testar captura de erro
    window.Sentry.captureException(new Error('Teste de erro'));
    
    // Testar breadcrumb
    window.Sentry.addBreadcrumb({
        category: 'teste',
        message: 'Breadcrumb de teste',
        level: 'info'
    });
} else {
    console.log('❌ Sentry não está inicializado');
}
```

### Desabilitar em Ambiente Local

```javascript
// Só inicializar Sentry em produção
if (window.location.hostname !== 'localhost') {
    A55Pay.initSentry({
        dsn: 'https://seu-dsn@sentry.io/projeto',
        environment: 'production'
    });
}
```

## 📝 Logs no Console

Mesmo com o Sentry habilitado, todos os logs continuam aparecendo no console do navegador:

- `[A55Pay SDK] PayV2 Initiated`
- `[A55Pay SDK] Device Info Collected`
- `[A55Pay SDK] Authentication Success`
- `[A55Pay SDK Error] Payment failed`
- etc.

## 🎨 Benefícios da Integração

1. **Visibilidade Completa**: Veja todos os erros em tempo real
2. **Contexto Rico**: Cada erro vem com contexto completo (usuário, device, fluxo)
3. **Debugging Rápido**: Breadcrumbs mostram exatamente o que aconteceu antes do erro
4. **Performance Monitoring**: Identifique gargalos e otimize o processo
5. **Alertas**: Configure alertas para erros críticos
6. **Tendências**: Veja se os erros estão aumentando ou diminuindo
7. **Session Replay**: Assista a sessão do usuário antes do erro

## 🔐 Segurança e Privacidade

O SDK automaticamente:

- ❌ **NÃO** envia dados sensíveis do cartão (número, CVV)
- ✅ Envia apenas metadados (marca do cartão, últimos 4 dígitos mascarados - se configurado)
- ✅ Respeita a configuração de amostragem (não envia 100% das sessões)
- ✅ Permite filtrar dados sensíveis antes de enviar

## 🆘 Suporte

- **Documentação do Sentry**: https://docs.sentry.io/platforms/javascript/
- **Dashboard do Sentry**: https://sentry.io
- **Exemplo Completo**: Veja `examples/sentry-example.html`

---

**Versão do SDK**: 1.0.15
**Data**: Novembro 2025
**Desenvolvido por**: Access55

