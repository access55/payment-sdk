// a55pay-sdk.js
// Embeddable Payment SDK for 3DS integration (Access55)
// Usage: <script src="a55pay-sdk.js"></script>
//        A55Pay.pay({ onSuccess, onError })

(function (global) {
  const SDK = {};
  
  // ==========================================
  // SENTRY CONFIGURATION
  // ==========================================
  let sentryInitialized = false;
  let sentryConfig = {
    enabled: true,
    scriptUrl: 'https://js.sentry-cdn.com/f334943e6050a1dbfd5af9441b424ebb.min.js',
    environment: 'production',
    tracesSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  };

  function loadSentryScript() {
    return new Promise((resolve, reject) => {
      if (window.Sentry) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = sentryConfig.scriptUrl;
      script.crossOrigin = 'anonymous';
      script.onload = () => {
        // Aguardar um pouco para o Sentry estar completamente carregado
        setTimeout(resolve, 100);
      };
      script.onerror = () => reject(new Error('Failed to load Sentry script'));
      document.head.appendChild(script);
    });
  }

  // Inicializar Sentry automaticamente ao carregar o SDK
  (function autoInitSentry() {
    loadSentryScript().then(() => {
      if (window.Sentry) {
        try {
          // Inicializar Sentry v8+ se ainda não foi inicializado
          if (typeof window.Sentry.init === 'function') {
            window.Sentry.init({
              environment: sentryConfig.environment,
              tracesSampleRate: sentryConfig.tracesSampleRate,
              replaysSessionSampleRate: sentryConfig.replaysSessionSampleRate,
              replaysOnErrorSampleRate: sentryConfig.replaysOnErrorSampleRate,
              beforeSend(event) {
                // Filtrar eventos se necessário
                return event;
              },
              // Configurações específicas do Sentry v8+
              integrations: [
                ...(typeof window.Sentry.browserTracingIntegration === 'function' 
                  ? [window.Sentry.browserTracingIntegration()] 
                  : []),
                ...(typeof window.Sentry.replayIntegration === 'function' 
                  ? [window.Sentry.replayIntegration()] 
                  : [])
              ]
            });
          }
          
          sentryInitialized = true;
          console.log('✅ Sentry inicializado automaticamente');
          
          // Adicionar breadcrumb inicial
          logBreadcrumb('Sentry v8+ Auto-Initialized', { 
            environment: sentryConfig.environment,
            sdk_version: '1.0.16',
            sentry_version: 'v8+'
          });
        } catch (error) {
          console.warn('⚠️ Erro ao inicializar Sentry:', error.message);
          sentryConfig.enabled = false;
        }
      }
    }).catch((error) => {
      console.warn('⚠️ Sentry não pôde ser carregado:', error.message);
      sentryConfig.enabled = false;
    });
  })();

  function logBreadcrumb(message, data = {}) {
    if (sentryConfig.enabled && window.Sentry) {
      window.Sentry.addBreadcrumb({
        category: 'a55pay-sdk',
        message: message,
        level: 'info',
        data: data,
        timestamp: Date.now() / 1000
      });
    }
    console.log(`[A55Pay SDK] ${message}`, data);
  }

  function captureError(error, context = {}) {
    console.error('[A55Pay SDK Error]', error, context);
    
    if (sentryConfig.enabled && window.Sentry) {
      window.Sentry.captureException(error, {
        extra: context,
        tags: {
          component: 'a55pay-sdk',
          ...context.tags
        }
      });
    }
  }

  function setUserContext(userData) {
    if (sentryConfig.enabled && window.Sentry) {
      window.Sentry.setUser({
        email: userData.payer_email,
        username: userData.payer_name,
      });
    }
  }

  function setTransactionContext(chargeUuid, additionalData = {}) {
    if (sentryConfig.enabled && window.Sentry) {
      window.Sentry.setContext('transaction', {
        charge_uuid: chargeUuid,
        ...additionalData
      });
    }
  }

  // Função para gerar UUID v4
  function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Função para carregar script da ThreatMetrix
  function loadThreatMetrixScript(sessionId) {
    // Verificar se já existe um script carregado
    const existingScript = document.querySelector('script[src*="online-metrix.net"]');
    if (existingScript) {
      existingScript.remove();
    }

    // Criar novo script
    const script = document.createElement('script');
    script.type = 'text/javascript';
    script.async = true;
    script.src = `https://h.online-metrix.net/fp/tags.js?org_id=k8vif92e&session_id=a55payment_br${encodeURIComponent(sessionId)}`;
    
    // Adicionar ao head
    document.head.appendChild(script);
    
    // Log para debug
    console.log('ThreatMetrix script loaded with session_id:', `a55payment_br${sessionId}`);
    
    // Opcional: listener para quando script carregar
    script.onload = function() {
      console.log('ThreatMetrix fingerprinting script loaded successfully');
    };
    
    script.onerror = function() {
      console.warn('Failed to load ThreatMetrix script, but continuing with generated session_id');
    };
  }

  // Função para gerar device_id único usando ThreatMetrix
  function generateDeviceId() {
    // Gerar UUID para session_id
    const sessionUUID = generateUUID();
    const sessionId = sessionUUID; // Sem prefixo aqui pois será adicionado na URL
    
    // Carregar script da ThreatMetrix
    loadThreatMetrixScript(sessionId);
    
    // Retornar device_id completo
    const deviceId = sessionId;
    console.log('Device ID gerado:', deviceId);
    
    return deviceId;
  }

  // Variável global para armazenar o device_id - inicializada imediatamente
  let globalDeviceId = generateDeviceId();

  // Variáveis globais para callbacks do payV2
  let currentPayV2Callbacks = null;

  // Listener global para mensagens 3DS
  window.addEventListener('message', function (event) {
    if (event.data && event.data.event === '3ds-auth-complete') {
      const chargeUuid = event.data.chargeUuid;
      console.log('3DS authentication complete for charge:', chargeUuid);
      
      logBreadcrumb('3DS Auth Complete Message Received', { 
        charge_uuid: chargeUuid,
        event_origin: event.origin
      });
      
      if (currentPayV2Callbacks) {
        // Verificar status da charge após 3DS
        logBreadcrumb('Checking Charge Status After 3DS', { charge_uuid: chargeUuid });
        checkChargeStatusAndHandle(chargeUuid, currentPayV2Callbacks);
      } else {
        logBreadcrumb('No Callbacks Found for 3DS Complete', { charge_uuid: chargeUuid });
      }
    }
  });

  // Função para verificar status da charge e tratar redirecionamento
  async function checkChargeStatusAndHandle(chargeUuid, callbacks) {
    const { callOnSuccess, callOnError } = callbacks;
    
    logBreadcrumb('Checking Charge Status', { charge_uuid: chargeUuid });
    
    // Função para fechar modal após 3 segundos
    function closeModalAfterDelay(isSuccess = true, message = '') {
      logBreadcrumb('Closing 3DS Modal', { 
        charge_uuid: chargeUuid, 
        is_success: isSuccess,
        message 
      });
      
      // Mostrar feedback visual no modal
      const overlay = document.getElementById('threeds-overlay');
      if (overlay) {
        const iframe = overlay.querySelector('#threeds-iframe');
        if (iframe) {
          // Substituir iframe por mensagem de feedback
          const feedbackDiv = document.createElement('div');
          feedbackDiv.style.cssText = `
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            text-align: center;
            font-family: Arial, sans-serif;
            padding: 20px;
          `;
    
          
          iframe.parentNode.replaceChild(feedbackDiv, iframe);
        }
      }
      
      setTimeout(() => {
        if (overlay && overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
          console.log('3DS modal closed automatically after 3 seconds');
          logBreadcrumb('3DS Modal Closed', { charge_uuid: chargeUuid });
        }
        // Limpar callbacks globais
        currentPayV2Callbacks = null;
      }, 2000);
    }
    
    try {
      // Buscar dados atualizados da charge
      logBreadcrumb('Fetching Charge Status', { charge_uuid: chargeUuid });
      
      const response = await fetch(`https://core-manager.a55.tech/api/v1/bank/public/charge?charge_uuid=${encodeURIComponent(chargeUuid)}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch charge status');
      }
      
      const data = await response.json();
      if (!Array.isArray(data) || !data.length) {
        throw new Error('No charge data found');
      }
      
      const chargeData = data[0];
      const status = chargeData.status;
      const redirectUrl = chargeData.redirect_url;
      
      console.log('Charge status after 3DS:', status);
      console.log('Redirect URL:', redirectUrl);
      
      logBreadcrumb('Charge Status Retrieved', { 
        charge_uuid: chargeUuid, 
        status,
        has_redirect_url: !!redirectUrl
      });
      
      // Verificar status e chamar callback apropriado
      if (status === 'confirmed' || status === 'paid') {
        // Sucesso - verificar se deve redirecionar
        if (redirectUrl) {
          console.log('Redirecting to:', redirectUrl);
          logBreadcrumb('Redirecting to Success Page', { 
            charge_uuid: chargeUuid, 
            redirect_url: redirectUrl 
          });
          // Fechar modal antes de redirecionar
          closeModalAfterDelay(true, 'Redirecionando para a página de sucesso...');
          setTimeout(() => {
            window.location.replace(redirectUrl);
          }, 3000);
        } else {
          // Fechar modal e chamar callback de sucesso
          logBreadcrumb('Payment Success Without Redirect', { charge_uuid: chargeUuid, status });
          closeModalAfterDelay(true, 'Pagamento aprovado com sucesso!');
          callOnSuccess({
            status: status,
            charge_uuid: chargeUuid,
            data: chargeData,
            threeds_completed: true
          });
        }
      } else if (status === 'error' || status === 'failed' || status === 'declined') {
        // Fechar modal e chamar callback de erro
        const errorMessage = chargeData.message || 'Payment failed';
        logBreadcrumb('Payment Failed After 3DS', { 
          charge_uuid: chargeUuid, 
          status,
          error_message: errorMessage
        });
        closeModalAfterDelay(false, errorMessage);
        const error = new Error(`Payment ${status}: ${errorMessage}`);
        captureError(error, {
          function: 'checkChargeStatusAndHandle',
          charge_uuid: chargeUuid,
          status: status,
          tags: { payment_status: status }
        });
        callOnError(error);
      } else {
        // Status ainda pendente ou outro - não fechar modal ainda
        console.log('Payment still processing, status:', status);
        logBreadcrumb('Payment Still Processing', { charge_uuid: chargeUuid, status });
        callOnSuccess({
          status: status,
          charge_uuid: chargeUuid,
          data: chargeData,
          pending: true,
          threeds_completed: true
        });
      }
      
    } catch (error) {
      console.error('Error checking charge status:', error);
      logBreadcrumb('Error Checking Charge Status', { 
        charge_uuid: chargeUuid, 
        error: error.message 
      });
      captureError(error, {
        function: 'checkChargeStatusAndHandle',
        charge_uuid: chargeUuid,
        tags: { operation: 'status_check' }
      });
      // Fechar modal em caso de erro
      closeModalAfterDelay(false, 'Erro ao verificar status do pagamento');
      callOnError(error);
    }
  }

  /**
   * Main payment function. Reads bpmpi_* hidden fields, loads 3DS, and triggers payment flow.
   * @param {Object} config - { onSuccess: function, onError: function }
   */
  SDK.pay = function (config) {
    // config: { selector, charge_uuid, userData, onSuccess, onError, onReady, forceThreeds }
    const { selector, charge_uuid, userData, onSuccess, onError, onReady, forceThreeds = true } = config;
    function callOnError(err) { if (typeof onError === 'function') onError(err); }
    function callOnSuccess(res) { if (typeof onSuccess === 'function') onSuccess(res); }
    function callOnReady() { if (typeof onReady === 'function') onReady(); }

    if (!selector || !charge_uuid || !userData) {
      callOnError(new Error('Missing selector, charge_uuid, or userData in config'));
      return;
    }
    const container = document.querySelector(selector);
    if (!container) {
      callOnError(new Error('Selector not found: ' + selector));
      return;
    }

    function sendPaymentRequest(a55Data) {
      const payload = {
        payer_name: a55Data.customer?.name,
        payer_email: a55Data.customer?.email,
        cell_phone: userData.phone?.replace(/\D/g, ''),
        card: {
          holder_name: userData.holder,
          number: userData.number?.replace(/\s/g, ''),
          expiry_month: userData.month,
          expiry_year: userData.year,
          ccv: userData.cvc,
        },
        address: {
          postal_code: userData.zipcode?.replace(/\D/g, ''),
          street: userData.street1,
          address_number: 'n/d',
          complement: userData.street2 || userData.street1 || '',
          neighborhood: 'n/d',
          city: userData.city,
          state: userData.state,
          country: userData.country || 'BR',
        },
        ...(a55Data.threeds_auth ? { threeds_auth: a55Data.threeds_auth } : {}),
      };
      fetch(`https://core-manager.a55.tech/api/v1/bank/public/charge/${a55Data.charge_uuid}/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ...payload })
      })
        .then(async (resp) => {
          if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            throw new Error(err.message || 'Payment failed');
          }
          return resp.json();
        })
        .then((result) => {
          callOnSuccess(result);
        })
        .catch((err) => {
          callOnError(err);
        });
    }

    // Fetch a55Data from API
    fetch(`https://core-manager.a55.tech/api/v1/bank/public/charge?charge_uuid=${encodeURIComponent(charge_uuid)}`)
      .then(async (resp) => {
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          throw new Error(err.message || 'Failed to fetch charge data');
        }
        return resp.json();
      })
      .then((data) => {
        if (!Array.isArray(data) || !data.length) {
          throw new Error('No charge data found for this charge_uuid');
        }
        const a55Data = data[0];
        // Map a55Data and userData to bpmpi fields
        const bpmpi = {
          bpmpi_accesstoken: a55Data.threeds_metadata?.access_token || '',
          bpmpi_ordernumber: a55Data.charge_uuid,
          bpmpi_currency: a55Data.currency || 'BRL',
          bpmpi_default_card: userData.default_card || 'true',
          bpmpi_totalamount: (a55Data.value * 100).toFixed(0),
          bpmpi_cardnumber: userData.number?.replace(/\s/g, ''),
          bpmpi_cardexpirationmonth: userData.month,
          bpmpi_cardexpirationyear: userData.year,
          bpmpi_paymentmethod: a55Data.type_charge?.replace('_card', ''),
          bpmpi_auth: 'true',
          bpmpi_shipto_sameasbillto: 'true',
          bpmpi_installments: a55Data.installment_count,
          bpmpi_device_ipaddress: userData.device_ipaddress || '',
          bpmpi_device_channel: 'browser',
          bpmpi_merchant_url: a55Data.website,
          bpmpi_order_productcode: 'PHY',
          bpmpi_billto_contactname: a55Data.customer?.name,
          bpmpi_billto_email: a55Data.customer?.email,
          bpmpi_billto_phonenumber: userData.phone?.replace(/\D/g, ''),
          bpmpi_billto_street1: userData.street1,
          bpmpi_billto_street2: userData.street2 || userData.street1,
          bpmpi_billto_city: userData.city,
          bpmpi_billto_state: userData.state,
          bpmpi_billto_zipcode: userData.zipcode?.replace(/\D/g, ''),
          bpmpi_billto_country: userData.country || 'BR',
          bpmpi_order_recurrence: a55Data.recurrence || 'false'
        };
        // Remove any existing bpmpi_* hidden fields in the container
        Object.keys(bpmpi).forEach((name) => {
          const old = container.querySelector(`input[name='${name}']`);
          if (old) old.remove();
        });
        // Inject new hidden fields
        Object.entries(bpmpi).forEach(([name, value]) => {
          if (typeof value === 'undefined') {
            callOnError(new Error('Missing required data for: ' + name));
            return;
          }
          const input = document.createElement('input');
          input.type = 'hidden';
          input.classList.add(name);
          input.value = value;
          container.appendChild(input);
        });

        // 2. Load 3DS script if not already loaded
        function load3DSScript() {
          return new Promise((resolve, reject) => {
            if (document.getElementById('bpmpi-script')) return resolve();
            const script = document.createElement('script');
            script.type = 'text/javascript';
            script.src = 'https://mpi.braspag.com.br/Scripts/BP.Mpi.3ds20.min.js';
            script.id = 'bpmpi-script';
            script.onload = resolve;
            script.onerror = () => reject(new Error('Failed to load 3DS script'));
            document.body.appendChild(script);
          });
        }

        // 3. Set up config callbacks
        window.bpmpi_config = function () {
          return {
            onReady: function () {
              callOnReady();
              window.bpmpi_authenticate && window.bpmpi_authenticate();
            },
            onSuccess: function (e) {
              const threeds_auth = {
                eci: e.Eci,
                request_id: e.ReferenceId,
                xid: e.Xid,
                cavv: e.Cavv,
                version: e.Version
              };
              sendPaymentRequest({ ...a55Data, threeds_auth });
            },
            onFailure: function () {
              if (!forceThreeds) {
                sendPaymentRequest(a55Data);
              } else {
                callOnError(new Error('Authentication failed'));
              }
            },
            onUnenrolled: function () {
              if (!forceThreeds) {
                sendPaymentRequest(a55Data);
              } else {
                callOnError(new Error('Card not eligible for authentication'));
              }
            },
            onDisabled: function () {
              if (!forceThreeds) {
                sendPaymentRequest(a55Data);
              } else {
                callOnError(new Error('Authentication disabled'));
              }
            },
            onError: function (e) {
              if (!forceThreeds) {
                sendPaymentRequest(a55Data);
              } else {
                callOnError(new Error(e?.ReturnMessage || 'Error during authentication process'));
              }
            },
            onUnsupportedBrand: function (e) {
              if (!forceThreeds) {
                sendPaymentRequest(a55Data);
              } else {
                callOnError(new Error(e?.ReturnMessage || 'Unsupported card brand'));
              }
            },
            Environment: 'PRD'
          };
        };

        // 4. Load script and trigger payment
        load3DSScript()
          .then(() => {
            if (typeof window.bpmpi_load === 'function') {
              window.bpmpi_load();
            } else {
              callOnError(new Error('3DS script did not initialize bpmpi_load'));
            }
          })
          .catch((err) => {
            callOnError(err);
          });
      })
      .catch((err) => {
        callOnError(err);
      });
  };

  /**
   * Yuno checkout integration function
   * @param {Object} config - { selector, charge_uuid, checkoutSession, apiKey, countryCode, onSuccess, onError, onReady }
   */
  SDK.checkout = function (config) {
    const { 
      selector, 
      chargeUuid, 
      checkoutSession, 
      apiKey, 
      countryCode = 'BR',
      onSuccess, 
      onError, 
      onReady,
      onLoading
    } = config;

    function callOnError(err) { 
      if (typeof onError === 'function') onError(err); 
    }
    function callOnSuccess(res) { 
      if (typeof onSuccess === 'function') onSuccess(res); 
    }
    function callOnReady() { 
      if (typeof onReady === 'function') onReady(); 
    }
    function callOnLoading(isLoading) {
      if (typeof onLoading === 'function') onLoading({ isLoading });
    }

    // Validação de parâmetros obrigatórios
    if (!selector || !chargeUuid || !checkoutSession || !apiKey) {
      callOnError(new Error('Missing required parameters: selector, chargeUuid, checkoutSession, or apiKey'));
      return;
    }

    const container = document.querySelector(selector);
    if (!container) {
      callOnError(new Error('Selector not found: ' + selector));
      return;
    }

    // Função para carregar o SDK do Yuno dinamicamente
    function loadYunoSDK() {
      return new Promise((resolve, reject) => {
        // Se o Yuno já está disponível, resolve imediatamente
        if (window.Yuno) {
          resolve();
          return;
        }

        // Verifica se o script já está sendo carregado
        const existingScript = document.querySelector('script[src="https://sdk-web.y.uno/v1.1/main.js"]');
        if (existingScript) {
          // Script já está carregando, aguarda o evento
          function handleLoad() {
            window.removeEventListener('yuno-sdk-loaded', handleLoad);
            window.removeEventListener('yuno-sdk-error', handleError);
            resolve();
          }

          function handleError() {
            window.removeEventListener('yuno-sdk-loaded', handleLoad);
            window.removeEventListener('yuno-sdk-error', handleError);
            reject(new Error('Failed to load Yuno SDK'));
          }

          window.addEventListener('yuno-sdk-loaded', handleLoad);
          window.addEventListener('yuno-sdk-error', handleError);
          return;
        }

        // Cria e carrega o script
        const script = document.createElement('script');
        script.src = 'https://sdk-web.y.uno/v1.1/main.js';
        script.defer = true;
        script.id = 'yuno-sdk-script';

        script.onload = () => {
          // Emite evento customizado quando o SDK do Yuno carrega
          window.dispatchEvent(new CustomEvent('yuno-sdk-loaded'));
          resolve();
        };

        script.onerror = () => {
          console.error('Failed to load Yuno SDK');
          window.dispatchEvent(new CustomEvent('yuno-sdk-error'));
          reject(new Error('Failed to load Yuno SDK'));
        };

        document.head.appendChild(script);
      });
    }

    // Função para aguardar o SDK do Yuno estar pronto
    function waitForYunoSDK() {
      return new Promise((resolve, reject) => {
        // Se o Yuno já está disponível, resolve imediatamente
        if (window.Yuno) {
          resolve();
          return;
        }

        function handleLoad() {
          window.removeEventListener('yuno-sdk-loaded', handleLoad);
          window.removeEventListener('yuno-sdk-error', handleError);
          resolve();
        }

        function handleError() {
          window.removeEventListener('yuno-sdk-loaded', handleLoad);
          window.removeEventListener('yuno-sdk-error', handleError);
          reject(new Error('Failed to load Yuno SDK'));
        }

        window.addEventListener('yuno-sdk-loaded', handleLoad);
        window.addEventListener('yuno-sdk-error', handleError);

        // Fallback: também escuta o evento original yuno-sdk-ready
        function handleReady() {
          window.removeEventListener('yuno-sdk-ready', handleReady);
          resolve();
        }
        window.addEventListener('yuno-sdk-ready', handleReady);
      });
    }

    // Função para criar pagamento no backend A55
    async function createPayment(oneTimeToken) {
      try {
        const response = await fetch(`http://localhost/api/v1/bank/public/charge/${chargeUuid}/pay`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            card: {
              card_token: oneTimeToken,
            },
          })
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          throw new Error(error.message || 'Payment failed');
        }

        return await response.json();
      } catch (error) {
        console.error('Error in createPayment:', error);
        throw error;
      }
    }

    // Variável para armazenar a instância do Yuno
    let yunoInstance = null;

    // Função principal de inicialização do checkout
    async function initCheckout() {
      try {
        // 1. Carregar o SDK do Yuno dinamicamente
        await loadYunoSDK();

        // 2. Aguardar o SDK estar pronto
        await waitForYunoSDK();

        // 3. Inicializar o Yuno
        yunoInstance = await window.Yuno.initialize(apiKey);

        // 4. Configurar e iniciar o checkout
        await yunoInstance.startCheckout({
          checkoutSession: checkoutSession,
          elementSelector: selector,
          renderMode: {
            type: 'element',
            elementSelector: {
              apmForm: selector,
              actionForm: selector + '-action',
            },
          },
          countryCode: countryCode,
          language: countryCode === 'BR' ? 'pt' : 'es',
          showLoading: true,
          issuersFormEnable: true,
          showPaymentStatus: true,
          
          // Callback para criação de pagamento
          async yunoCreatePayment(oneTimeToken) {
            try {
              await createPayment(oneTimeToken);
              yunoInstance.continuePayment();
            } catch (error) {
              callOnError(error);
            }
          },

          // Callback para resultado do pagamento
          yunoPaymentResult(data) {
            const statusText = String(data);
            
            if (statusText === 'SUCCEEDED' || statusText === 'APPROVED') {
              callOnSuccess({ status: statusText, data });
            } else if ([
              'REJECTED',
              'ERROR', 
              'DECLINED',
              'CANCELLED',
              'FAILED',
            ].includes(statusText)) {
              callOnError(new Error(`Payment ${statusText.toLowerCase()}: ${data}`));
            } else if ([
              'PENDING',
              'PROCESSING', 
              'IN_PROGRESS',
            ].includes(statusText)) {
              // Status pendente - não recarrega ainda
              callOnSuccess({ status: statusText, data, pending: true });
            }
          },

          // Callback para erros
          yunoError: (error) => {
            callOnError(new Error(error?.ReturnMessage || 'Error during payment process'));
          },

          // Callback para estados de loading
          onLoading: ({ isLoading }) => {
            // Adiciona classe CSS para indicar loading
            if (isLoading) {
              callOnLoading(true);
            } else {
              callOnLoading(false);
            }
          },

        });

        // 5. Montar o checkout no DOM
        yunoInstance.mountCheckout();

        // 6. Expor método startPayment sempre atualizado
        SDK.startPayment = function() {
          if (yunoInstance && typeof yunoInstance.startPayment === 'function') {
            yunoInstance.startPayment();
          } else {
            throw new Error('Yuno não está pronto para iniciar o pagamento');
          }
        };

        // 7. Chamar callback de pronto
        callOnReady();

        return yunoInstance;
      } catch (error) {
        callOnError(error);
      }
    }

    // Iniciar o processo de checkout
    initCheckout();
  };

  /**
   * PayV2 function with automatic authentication and enhanced device info collection
   * @param {Object} config - { charge_uuid, userData, onSuccess, onError, onReady }
   */
  SDK.payV2 = function (config) {
    const { charge_uuid, userData, onSuccess, onError, onReady } = config;
    
    // Monitoramento com Sentry v8+ usando withScope
    if (sentryConfig.enabled && window.Sentry) {
      try {
        window.Sentry.withScope((scope) => {
          scope.setTag('operation', 'SDK.payV2');
          scope.setContext('payment', {
            charge_uuid: charge_uuid,
            timestamp: new Date().toISOString()
          });
        });
      } catch (error) {
        console.warn('Erro ao configurar escopo do Sentry:', error);
      }
    }
    
    logBreadcrumb('PayV2 Initiated', { charge_uuid });
    
    function callOnError(err) {
      captureError(err, {
        function: 'SDK.payV2',
        charge_uuid: charge_uuid,
        tags: { payment_status: 'error' }
      });
      
      // Capturar erro no Sentry v8+
      if (sentryConfig.enabled && window.Sentry) {
        try {
          window.Sentry.withScope((scope) => {
            scope.setTag('payment_status', 'error');
            scope.setLevel('error');
            window.Sentry.captureException(err);
          });
        } catch (error) {
          console.warn('Erro ao capturar exceção no Sentry:', error);
        }
      }
      
      if (typeof onError === 'function') onError(err);
    }
    
    function callOnSuccess(res) {
      logBreadcrumb('PayV2 Success', { 
        charge_uuid, 
        status: res.status,
        threeds_completed: res.threeds_completed 
      });
      
      // Registrar sucesso no Sentry v8+
      if (sentryConfig.enabled && window.Sentry) {
        try {
          window.Sentry.withScope((scope) => {
            scope.setTag('payment_status', 'success');
            scope.setLevel('info');
            scope.setContext('payment_result', {
              status: res.status,
              threeds_completed: res.threeds_completed,
              charge_uuid: charge_uuid
            });
            window.Sentry.addBreadcrumb({
              category: 'payment',
              message: 'Payment completed successfully',
              level: 'info'
            });
          });
        } catch (error) {
          console.warn('Erro ao registrar sucesso no Sentry:', error);
        }
      }
      
      if (typeof onSuccess === 'function') onSuccess(res);
    }
    
    function callOnReady() {
      logBreadcrumb('PayV2 Ready', { charge_uuid });
      if (typeof onReady === 'function') onReady();
    }

    // Armazenar callbacks globalmente para o listener 3DS
    currentPayV2Callbacks = {
      callOnSuccess,
      callOnError,
      charge_uuid
    };

    // Validações obrigatórias
    if (!charge_uuid || !userData) {
      const error = new Error('Missing charge_uuid or userData in config');
      logBreadcrumb('PayV2 Validation Error', { error: error.message });
      callOnError(error);
      return;
    }

    // Validar payer_name e payer_email obrigatórios
    if (!userData.payer_name || !userData.payer_email) {
      const error = new Error('payer_name and payer_email are required in userData');
      logBreadcrumb('PayV2 Validation Error', { error: error.message });
      callOnError(error);
      return;
    }

    // Validar ccv ou card_cryptogram
    if (!userData.ccv && !userData.card_cryptogram) {
      const error = new Error('Either ccv or card_cryptogram is required in userData');
      logBreadcrumb('PayV2 Validation Error', { error: error.message });
      callOnError(error);
      return;
    }
    
    // Definir contexto do usuário no Sentry
    setUserContext(userData);
    setTransactionContext(charge_uuid, {
      has_cryptogram: !!userData.card_cryptogram,
      payment_method: 'credit_card'
    });

    // Função para coletar informações do dispositivo
    function collectDeviceInfo() {
      logBreadcrumb('Collecting Device Info', { charge_uuid });
      
      const screen = window.screen;
      const navigator = window.navigator;
      
      const deviceInfo = {
        device_id: globalDeviceId, // use global device_id
        ip_address: '', // Será preenchido após obter IP
        session_id: '', // Será preenchido após autenticação
        user_agent: navigator.userAgent,
        http_accept_content: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        http_browser_language: navigator.language || navigator.browserLanguage,
        http_browser_java_enabled: navigator.javaEnabled(),
        http_browser_javascript_enabled: true,
        http_browser_color_depth: screen.colorDepth.toString(),
        http_browser_screen_height: screen.height.toString(),
        http_browser_screen_width: screen.width.toString(),
        http_browser_time_difference: new Date().getTimezoneOffset().toString(),
        http_accept_browser_value: navigator.userAgent
      };
      
      logBreadcrumb('Device Info Collected', { 
        device_id: deviceInfo.device_id,
        screen_resolution: `${deviceInfo.http_browser_screen_width}x${deviceInfo.http_browser_screen_height}`,
        language: deviceInfo.http_browser_language
      });
      
      return deviceInfo;
    }

    // Função para obter IP address do usuário
    async function getClientIPAddress() {
      logBreadcrumb('Getting Client IP Address', { charge_uuid });
      
      try {
        // Método 1: Usar serviço público de IP (mais confiável)
        const response = await fetch('https://api.ipify.org?format=json', {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          logBreadcrumb('IP Address Obtained', { method: 'ipify', ip: data.ip });
          return data.ip;
        }
      } catch (error) {
        console.warn('Failed to get IP from ipify, trying alternative method:', error);
        logBreadcrumb('IP Fetch Failed', { method: 'ipify', error: error.message });
      }

      try {
        // Método 2: Usar serviço alternativo
        const response = await fetch('https://httpbin.org/ip', {
          method: 'GET',
          headers: {
            'Accept': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          const ip = data.origin.split(',')[0].trim();
          logBreadcrumb('IP Address Obtained', { method: 'httpbin', ip });
          return ip; // Pega o primeiro IP se houver múltiplos
        }
      } catch (error) {
        console.warn('Failed to get IP from httpbin, trying WebRTC method:', error);
        logBreadcrumb('IP Fetch Failed', { method: 'httpbin', error: error.message });
      }

      try {
        // Método 3: WebRTC (funciona mesmo com proxy/VPN em alguns casos)
        const ip = await getIPViaWebRTC();
        logBreadcrumb('IP Address Obtained', { method: 'webrtc', ip });
        return ip;
      } catch (error) {
        console.warn('Failed to get IP via WebRTC:', error);
        logBreadcrumb('IP Fetch Failed', { method: 'webrtc', error: error.message });
        captureError(error, {
          function: 'getClientIPAddress',
          charge_uuid: charge_uuid,
          tags: { operation: 'ip_detection' }
        });
      }

      // Se todos os métodos falharam, retornar string vazia
      logBreadcrumb('All IP Detection Methods Failed', { charge_uuid });
      return '';
    }

    // Função para obter IP via WebRTC
    function getIPViaWebRTC() {
      return new Promise((resolve, reject) => {
        const RTCPeerConnection = window.RTCPeerConnection || 
                                  window.webkitRTCPeerConnection || 
                                  window.mozRTCPeerConnection;

        if (!RTCPeerConnection) {
          reject(new Error('WebRTC not supported'));
          return;
        }

        const pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        });

        let ipFound = false;

        pc.onicecandidate = function(event) {
          if (!event.candidate || ipFound) return;

          const candidate = event.candidate.candidate;
          const ipMatch = candidate.match(/(\d+\.\d+\.\d+\.\d+)/);
          
          if (ipMatch && !ipMatch[1].startsWith('192.168.') && 
              !ipMatch[1].startsWith('10.') && 
              !ipMatch[1].startsWith('172.')) {
            ipFound = true;
            pc.close();
            resolve(ipMatch[1]);
          }
        };

        // Criar data channel para iniciar processo ICE
        pc.createDataChannel('');
        pc.createOffer()
          .then(offer => pc.setLocalDescription(offer))
          .catch(reject);

        // Timeout após 3 segundos
        setTimeout(() => {
          if (!ipFound) {
            pc.close();
            reject(new Error('WebRTC IP detection timeout'));
          }
        }, 3000);
      });
    }


    // Função para processar pagamento
    async function processPayment(sessionId) {
      logBreadcrumb('Processing Payment', { charge_uuid, session_id: sessionId });
      
      const deviceInfo = collectDeviceInfo();
      deviceInfo.session_id = sessionId;
      
      // Obter IP address do cliente
      try {
        deviceInfo.ip_address = await getClientIPAddress();
        console.log('Client IP detected:', deviceInfo.ip_address);
        logBreadcrumb('Client IP Detected', { ip: deviceInfo.ip_address });
      } catch (error) {
        console.warn('Could not detect client IP:', error);
        captureError(error, {
          function: 'processPayment.getClientIPAddress',
          charge_uuid: charge_uuid,
          tags: { operation: 'ip_detection' }
        });
        deviceInfo.ip_address = ''; // Deixa vazio se não conseguir obter
      }

      const payload = {
        device_info: deviceInfo,
        // Campos obrigatórios do pagador
        payer_name: userData.payer_name,
        payer_email: userData.payer_email,
        // Campos opcionais do pagador
        ...(userData.payer_tax_id && { payer_tax_id: userData.payer_tax_id }),
        ...(userData.cell_phone && { cell_phone: userData.cell_phone.replace(/\D/g, '') }),
        card: {
          holder_name: userData.holder_name,
          number: userData.number?.replace(/\s/g, ''),
          expiry_month: userData.expiry_month,
          expiry_year: userData.expiry_year,
          ccv: userData.ccv,
          card_token: userData.card_token,
          card_cryptogram: userData.card_cryptogram
        },
        address: {
          postal_code: userData.postal_code?.replace(/\D/g, ''),
          street: userData.street,
          address_number: userData.address_number || 'n/d',
          complement: userData.complement || '',
          neighborhood: userData.neighborhood || 'n/d',
          city: userData.city,
          state: userData.state,
          country: userData.country.toUpperCase() || 'BR'
        },
        shipping_address: {
          postal_code: (userData.shipping_postal_code || userData.postal_code)?.replace(/\D/g, ''),
          street: userData.shipping_street || userData.street,
          address_number: userData.shipping_address_number || userData.address_number || 'n/d',
          complement: userData.shipping_complement || userData.complement || '',
          neighborhood: userData.shipping_neighborhood || userData.neighborhood || 'n/d',
          city: userData.shipping_city || userData.city,
          state: userData.shipping_state || userData.state,
          country: userData.shipping_country.toUpperCase() || userData.country.toUpperCase() || 'BR'
        }
      };

      logBreadcrumb('Sending Payment Request', { 
        charge_uuid,
        has_device_info: !!deviceInfo.device_id,
        has_ip: !!deviceInfo.ip_address
      });

      fetch(`https://core-manager.a55.tech/api/v1/bank/public/charge/${charge_uuid}/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })
      .then(async (resp) => {
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          logBreadcrumb('Payment Request Failed', { 
            charge_uuid, 
            status: resp.status,
            error: err.message 
          });
          throw new Error(err.message || 'Payment failed');
        }
        return resp.json();
      })
      .then((result) => {
        logBreadcrumb('Payment Response Received', { 
          charge_uuid, 
          status: result.status,
          has_3ds_url: !!result.url_3ds
        });
        
        if (result.status === 'pending' && result.url_3ds) {
          // Abrir iframe para 3DS
          logBreadcrumb('3DS Authentication Required', { charge_uuid, url_3ds: result.url_3ds });
          open3DSIframe(result.url_3ds, result);
        }else if (result.status === 'confirmed' || result.status === 'paid') {
          logBreadcrumb('Payment Confirmed', { charge_uuid, status: result.status });
          callOnSuccess(result);
        }
        else {
          logBreadcrumb('Payment Status Unknown', { charge_uuid, status: result.status });
          callOnError(result);
        }
      })
      .catch((err) => {
        captureError(err, {
          function: 'processPayment',
          charge_uuid: charge_uuid,
          tags: { payment_status: 'request_failed' }
        });
        callOnError(err);
      });
    }

    // Função para abrir iframe 3DS
    function open3DSIframe(url3ds, paymentResult) {
      logBreadcrumb('Opening 3DS Iframe', { charge_uuid, url_3ds: url3ds });
      
      // Remover iframe anterior se existir
      const existingIframe = document.getElementById('threeds-iframe');
      if (existingIframe) {
        logBreadcrumb('Removing Existing 3DS Iframe', { charge_uuid });
        existingIframe.remove();
      }

      // Criar overlay
      const overlay = document.createElement('div');
      overlay.id = 'threeds-overlay';
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        z-index: 999999;
        display: flex;
        justify-content: center;
        align-items: center;
      `;

      // Criar container do iframe
      const container = document.createElement('div');
      container.style.cssText = `
        background: white;
        border-radius: 8px;
        padding: 20px;
        max-width: 500px;
        max-height: 600px;
        width: 90%;
        height: 80%;
        position: relative;
      `;

      // Botão fechar
      const closeBtn = document.createElement('button');
      closeBtn.textContent = '×';
      closeBtn.style.cssText = `
        position: absolute;
        top: 10px;
        right: 15px;
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        z-index: 1000000;
      `;
      closeBtn.onclick = function() {
        logBreadcrumb('3DS Cancelled by User', { charge_uuid });
        document.body.removeChild(overlay);
        // Limpar callbacks globais
        currentPayV2Callbacks = null;
        const error = new Error('3DS authentication cancelled by user');
        captureError(error, {
          function: 'open3DSIframe.closeBtn',
          charge_uuid: charge_uuid,
          tags: { payment_status: '3ds_cancelled' }
        });
        callOnError(error);
      };

      // Criar iframe
      const iframe = document.createElement('iframe');
      iframe.id = 'threeds-iframe';
      iframe.src = url3ds;
      iframe.style.cssText = `
        width: 100%;
        height: calc(100% - 40px);
        border: none;
        margin-top: 20px;
      `;

      // Eventos do iframe
      iframe.onload = function() {
        logBreadcrumb('3DS Iframe Loaded', { charge_uuid });
      };
      
      iframe.onerror = function() {
        logBreadcrumb('3DS Iframe Load Error', { charge_uuid });
        captureError(new Error('Failed to load 3DS iframe'), {
          function: 'open3DSIframe.iframe.onerror',
          charge_uuid: charge_uuid,
          url_3ds: url3ds,
          tags: { payment_status: '3ds_load_error' }
        });
      };

      container.appendChild(closeBtn);
      container.appendChild(iframe);
      overlay.appendChild(container);
      document.body.appendChild(overlay);

      // O listener global já trata as mensagens 3DS
      console.log('3DS iframe opened for URL:', url3ds);
      logBreadcrumb('3DS Iframe Displayed', { charge_uuid });

      // Timeout para 3DS (5 minutos)
      setTimeout(() => {
        if (document.getElementById('threeds-overlay')) {
          logBreadcrumb('3DS Timeout', { charge_uuid, timeout_ms: 300000 });
          document.body.removeChild(overlay);
          // Limpar callbacks globais
          currentPayV2Callbacks = null;
          const error = new Error('3DS authentication timeout');
          captureError(error, {
            function: 'open3DSIframe.timeout',
            charge_uuid: charge_uuid,
            tags: { payment_status: '3ds_timeout' }
          });
          callOnError(error);
        }
      }, 300000);
    }

    // Iniciar processo: primeiro executar authentication
    callOnReady();
    
    logBreadcrumb('Starting Authentication Process', { 
      charge_uuid,
      card_brand: getCardBrand(userData.number)
    });
    
    SDK.authentication({
      transactionReference: charge_uuid,
      cardBrand: getCardBrand(userData.number),
      cardExpiryMonth: userData.expiry_month,
      cardExpiryYear: userData.expiry_year,
      cardNumber: userData.number?.replace(/\s/g, ''),
      onSuccess: async function(authResult) {
        // Authentication completado, processar pagamento
        logBreadcrumb('Authentication Success', { 
          charge_uuid,
          session_id: authResult.sessionId
        });
        await processPayment(authResult.sessionId);
      },
      onError: async function(authError) {
        // Se authentication falhar, prosseguir sem device data collection
        console.warn('Authentication failed, proceeding without device data collection:', authError.message);
        logBreadcrumb('Authentication Failed', { 
          charge_uuid,
          error: authError.message,
          proceeding_without_device_data: true
        });
        captureError(authError, {
          function: 'SDK.authentication.onError',
          charge_uuid: charge_uuid,
          tags: { operation: 'authentication' }
        });
        await processPayment('');
      }
    });

    // Função auxiliar para detectar bandeira do cartão
    function getCardBrand(cardNumber) {
      if (!cardNumber) return 'Visa';
      
      const number = cardNumber.replace(/\D/g, '');
      
      if (/^4/.test(number)) return 'Visa';
      if (/^5[1-5]/.test(number) || /^2[2-7]/.test(number)) return 'MasterCard';
      if (/^3[47]/.test(number)) return 'AmericanExpress';
      if (/^6(?:011|5)/.test(number)) return 'Discover';
      if (/^35/.test(number)) return 'JCB';
      if (/^3[0689]/.test(number)) return 'DinersClub';
      if (/^606282|^637095|^637568|^637599|^637609|^637612/.test(number)) return 'Hipercard';
      if (/^636368|^438935|^504175|^451416|^636297/.test(number)) return 'Elo';
      
      return 'Visa'; // Default
    }
  };

  /**
   * Authentication function for CyberSource Device Data Collection setup
   * @param {Object} config - { transactionReference, cardBrand, cardExpiryMonth, cardExpiryYear, cardNumber, onSuccess, onError }
   */
  SDK.authentication = function (config) {
    const { 
      transactionReference, 
      cardBrand, 
      cardExpiryMonth, 
      cardExpiryYear, 
      cardNumber, 
      onSuccess, 
      onError 
    } = config;

    function callOnError(err) { 
      if (typeof onError === 'function') onError(err); 
    }
    function callOnSuccess(res) { 
      if (typeof onSuccess === 'function') onSuccess(res); 
    }

    // Validação de parâmetros obrigatórios
    if (!transactionReference || !cardBrand || !cardExpiryMonth || !cardExpiryYear || !cardNumber) {
      callOnError(new Error('Missing required parameters: transactionReference, cardBrand, cardExpiryMonth, cardExpiryYear, or cardNumber'));
      return;
    }

    // Validar cardBrand
    const validBrands = ['Visa', 'MasterCard', 'AmericanExpress', 'Discover', 'JCB', 'DinersClub', 'Hipercard', 'Elo'];
    if (!validBrands.includes(cardBrand)) {
      callOnError(new Error(`Invalid cardBrand. Must be one of: ${validBrands.join(', ')}`));
      return;
    }

    // Preparar payload para o backend
    const payload = {
      transaction_reference: transactionReference,
      card_brand: cardBrand,
      card_expiry_month: cardExpiryMonth,
      card_expiry_year: cardExpiryYear,
      card_number: cardNumber
    };

    // Chamar o backend para setup da autenticação
    fetch('https://core-manager.a55.tech/api/v1/bank/public/setup-authentication', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })
    .then(async (response) => {
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || 'Setup authentication failed');
      }
      return response.json();
    })
    .then((authData) => {
      // authData contém: access_token, reference_id, device_data_collection_url
      const { access_token, reference_id, device_data_collection_url } = authData;

      if (!device_data_collection_url) {
        callOnError(new Error('Device data collection URL not provided'));
        return;
      }

      // Iniciar Device Data Collection da CyberSource
      startDeviceDataCollection(device_data_collection_url, reference_id, access_token);
    })
    .catch((error) => {
      callOnError(error);
    });

    function startDeviceDataCollection(collectionUrl, referenceId, accessToken) {
      // Remover elementos anteriores se existirem
      const existingIframe = document.getElementById('ddc-iframe');
      if (existingIframe) {
        existingIframe.remove();
      }
      const existingForm = document.getElementById('ddc-form');
      if (existingForm) {
        existingForm.remove();
      }

      // Criar iframe conforme documentação da CyberSource
      const iframe = document.createElement('iframe');
      iframe.name = 'ddc-iframe';
      iframe.id = 'ddc-iframe';
      iframe.height = '1';
      iframe.width = '1';
      iframe.style.display = 'none';
      document.body.appendChild(iframe);

      // Criar formulário conforme documentação
      const form = document.createElement('form');
      form.id = 'ddc-form';
      form.target = 'ddc-iframe';
      form.method = 'POST';
      form.action = collectionUrl;

      // Adicionar campo JWT conforme documentação
      const jwtInput = document.createElement('input');
      jwtInput.type = 'hidden';
      jwtInput.name = 'JWT';
      jwtInput.value = accessToken;
      form.appendChild(jwtInput);

      document.body.appendChild(form);

      // Variável para controlar se já processamos o resultado
      let processed = false;

      function handleDeviceDataComplete(data) {
        if (processed) return;
        processed = true;
        
        cleanup();
        callOnSuccess({
          sessionId: referenceId,
          accessToken: accessToken,
          referenceId: referenceId,
          deviceDataCollection: data || 'completed'
        });
      }

      function cleanup() {
        // Remover elementos criados
        if (form && form.parentNode) {
          form.parentNode.removeChild(form);
        }
        if (iframe && iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
        window.removeEventListener('message', messageHandler);
      }

      // Handler para mensagens do iframe conforme documentação
      function messageHandler(event) {
        // Verificar se a mensagem vem do domínio da CyberSource
        if (event.origin === 'https://centinelapistag.cardinalcommerce.com') {
          let data = JSON.parse(event.data);
          console.log('Merchant received a message:', data);
          
          if (data.MessageType === 'profile.completed') {
            console.log('SongBird ran DF successfully');
            handleDeviceDataComplete(data);
          }
        } else {
          console.log('Message from different origin');
        }
      }

      // Escutar mensagens do iframe
      window.addEventListener('message', messageHandler);

      // JavaScript para submeter o formulário automaticamente
      window.onload = function() {
        const ddcForm = document.querySelector('#ddc-form');
        if (ddcForm) {
          ddcForm.submit();
        }
      };

      // Timeout de segurança (10 segundos conforme boas práticas)
      const timeout = setTimeout(() => {
        if (!processed) {
          processed = true;
          cleanup();
          // Retornar sucesso mesmo com timeout, pois a coleta pode ter funcionado
          console.log('Timeout occurred, but likely successful');
          callOnSuccess({
            sessionId: referenceId,
            accessToken: accessToken,
            referenceId: referenceId,
            timeout: true,
            deviceDataCollection: 'timeout_but_likely_successful'
          });
        }
      }, 10000);

      // Submeter o formulário para iniciar a coleta
      try {
        form.submit();
        
        // Cleanup do timeout quando o processo é completado
        const originalHandleComplete = handleDeviceDataComplete;
        handleDeviceDataComplete = function(data) {
          clearTimeout(timeout);
          originalHandleComplete(data);
        };
      } catch (error) {
        clearTimeout(timeout);
        cleanup();
        callOnError(new Error('Failed to start device data collection: ' + error.message));
      }
    }
  };

  /**
   * Get the current global device_id
   * @returns {string} The current device_id
   */
  SDK.getDeviceId = function() {
    return globalDeviceId;
  };

  /**
   * Force regenerate a new device_id
   * @returns {string} New device_id
   */
  SDK.regenerateDeviceId = function() {
    globalDeviceId = generateDeviceId(); // Gera novo
    return globalDeviceId;
  };

  // Expose globally
  global.A55Pay = SDK;
})(window);
