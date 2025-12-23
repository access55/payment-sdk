---
name: a55pay-open-checkout
overview: Adicionar A55Pay.open para renderizar checkout por iframe em modal ou embed com callbacks e segurança de postMessage.
todos:
  - id: add-open-func
    content: Implementar A55Pay.open modal/embed + callbacks
    status: completed
  - id: wire-postmessage
    content: Adicionar listener filtrado e cleanup para postMessage
    status: completed
    dependencies:
      - add-open-func
  - id: handle-cleanup
    content: Limpar iframe/overlay e suportar reuso
    status: completed
    dependencies:
      - wire-postmessage
  - id: optional-style
    content: Estilizar overlay/iframe responsivo e sandbox
    status: completed
    dependencies:
      - add-open-func
---

# Plano: A55Pay.open com modal/embed

- **Local**: implementar em [`src/a55pay-sdk.js`](src/a55pay-sdk.js) perto da exposição do SDK.
- **API**: adicionar `A55Pay.open({ checkoutUuid, display='modal', containerId?, onEvent, onSuccess, onClose, onError })`; validar parâmetros mínimos e normalizar callbacks.
- **Renderização**:
- `modal`: criar overlay + container com iframe apontando para `https://pay.a55.tech/checkout/v2/{checkoutUuid}?origin=sdk`, botão fechar e cleanup.
- `embed`: localizar `containerId`; se ausente, criar automaticamente um container no body; injetar iframe responsivo.
- **postMessage**: listener dedicado filtrando `event.origin` para `https://pay.a55.tech`; roteia payloads: status `paid|confirmed|ok` → `onSuccess`, status `error` → `onError`, demais → `onEvent`; dispara `onClose` ao fechar ou receber sinal de encerramento se existir; remover listener/DOM no cleanup.
- **Eventos auxiliares**: expor método para destruir/remover iframe se chamado novamente; garantir idempotência evitando múltiplos modais/iframes simultâneos.

Todos:

- add-open-func: Implementar função open com modal/embed + callbacks.
- wire-postmessage: Adicionar listener filtrado e cleanup no fluxo do open.
- handle-cleanup: Garantir destruição de iframe/overlay e reutilização em chamadas subsequentes.