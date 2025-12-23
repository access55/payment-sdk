// a55pay-sdk.js
// Embeddable Payment SDK for 3DS integration (Access55)
// Usage: <script src="a55pay-sdk.js"></script>
//        A55Pay.pay({ onSuccess, onError })

(function (global) {
  const SDK = {};
  



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

  // Estado do checkout v2 via SDK.open
  const CHECKOUT_ORIGIN = 'http://localhost:3001';
  const CHECKOUT_BASE_URL = `${CHECKOUT_ORIGIN}/checkout/v2`;
  let currentCheckoutInstance = null;

  // Listener global para mensagens 3DS
  window.addEventListener('message', function (event) {
    if (event.data && event.data.event === '3ds-auth-complete') {
      const chargeUuid = event.data.chargeUuid;
      console.log('3DS authentication complete for charge:', chargeUuid);
      
    
      
      if (currentPayV2Callbacks) {
        // Verificar status da charge após 3DS
        checkChargeStatusAndHandle(chargeUuid, currentPayV2Callbacks);
      } else {
        console.warn('No callbacks found for 3DS complete');
      }
    }
  });

  // Função para verificar status da charge e tratar redirecionamento
  async function checkChargeStatusAndHandle(chargeUuid, callbacks) {
    const { callOnSuccess, callOnError } = callbacks;
    
    // Função para fechar modal após 3 segundos
    function closeModalAfterDelay(isSuccess = true, message = '') {
      
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
        }
        // Limpar callbacks globais
        currentPayV2Callbacks = null;
      }, 2000);
    }
    
    try {
      // Buscar dados atualizados da charge
      
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
      
      
      
      // Verificar status e chamar callback apropriado
      if (status === 'confirmed' || status === 'paid') {
        // Sucesso - verificar se deve redirecionar
        if (redirectUrl) {
          console.log('Redirecting to:', redirectUrl);
          // Fechar modal antes de redirecionar
          closeModalAfterDelay(true, 'Redirecionando para a página de sucesso...');
          setTimeout(() => {
            window.location.replace(redirectUrl);
          }, 3000);
        } else {
          // Fechar modal e chamar callback de sucesso
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
        closeModalAfterDelay(false, errorMessage);
        const error = new Error(`Payment ${status}: ${errorMessage}`);
        callOnError(error);
      } else {
        // Status ainda pendente ou outro - não fechar modal ainda
        console.log('Payment still processing, status:', status);
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
    
    
    function callOnError(err) {
      if (typeof onError === 'function') onError(err);
    }
    
    function callOnSuccess(res) {
      if (typeof onSuccess === 'function') onSuccess(res);
    }
    
    function callOnReady() {
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
      callOnError(error);
      return;
    }

    // Validar payer_name e payer_email obrigatórios
    if (!userData.payer_name || !userData.payer_email) {
      const error = new Error('payer_name and payer_email are required in userData');
      callOnError(error);
      return;
    }

    // Validar ccv ou card_cryptogram
    if (!userData.ccv && !userData.card_cryptogram) {
      const error = new Error('Either ccv or card_cryptogram is required in userData');
      callOnError(error);
      return;
    }
    
   

    // Função para coletar informações do dispositivo
    function collectDeviceInfo() {
      
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
      
      
      return deviceInfo;
    }

    // Função para obter IP address do usuário
    async function getClientIPAddress() {
      
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
          return data.ip;
        }
      } catch (error) {
        console.warn('Failed to get IP from ipify, trying alternative method:', error);
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
          return ip; // Pega o primeiro IP se houver múltiplos
        }
      } catch (error) {
        console.warn('Failed to get IP from httpbin, trying WebRTC method:', error);
      }

      try {
        // Método 3: WebRTC (funciona mesmo com proxy/VPN em alguns casos)
        const ip = await getIPViaWebRTC();
        return ip;
      } catch (error) {
        console.warn('Failed to get IP via WebRTC:', error);
      }

      // Se todos os métodos falharam, retornar string vazia
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
      
      const deviceInfo = collectDeviceInfo();
      deviceInfo.session_id = sessionId;
      
      // Obter IP address do cliente
      try {
        deviceInfo.ip_address = await getClientIPAddress();
        console.log('Client IP detected:', deviceInfo.ip_address);
      } catch (error) {
        console.warn('Could not detect client IP:', error);
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
          throw new Error(err.message || 'Payment failed');
        }
        return resp.json();
      })
      .then((result) => {
        
        if (result.status === 'pending' && result.url_3ds) {
          // Abrir iframe para 3DS
          open3DSIframe(result.url_3ds, result);
        }else if (result.status === 'confirmed' || result.status === 'paid') {
          callOnSuccess(result);
        }
        else {
          callOnError(result);
        }
      })
      .catch((err) => {
        callOnError(err);
      });
    }

    // Função para abrir iframe 3DS
    function open3DSIframe(url3ds, paymentResult) {
      
      // Remover iframe anterior se existir
      const existingIframe = document.getElementById('threeds-iframe');
      if (existingIframe) {
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
        document.body.removeChild(overlay);
        // Limpar callbacks globais
        currentPayV2Callbacks = null;
        const error = new Error('3DS authentication cancelled by user');
        callOnError(error);
      };

      // Criar iframe com atributos de segurança
      const iframe = document.createElement('iframe');
      iframe.id = 'threeds-iframe';
      iframe.src = url3ds;
      iframe.sandbox = 'allow-scripts allow-forms allow-same-origin allow-top-navigation allow-popups';
      iframe.allow = '*';
      iframe.loading = 'eager';
      iframe.style.cssText = `
        width: 100%;
        height: calc(100% - 40px);
        border: none;
        margin-top: 20px;
      `;

      // Eventos do iframe
      iframe.onload = function() {
      };
      
      iframe.onerror = function() {
      };

      container.appendChild(closeBtn);
      container.appendChild(iframe);
      overlay.appendChild(container);
      document.body.appendChild(overlay);

      // O listener global já trata as mensagens 3DS
      console.log('3DS iframe opened for URL:', url3ds);

      // Timeout para 3DS (5 minutos)
      setTimeout(() => {
        if (document.getElementById('threeds-overlay')) {
          document.body.removeChild(overlay);
          // Limpar callbacks globais
          currentPayV2Callbacks = null;
          const error = new Error('3DS authentication timeout');
          callOnError(error);
        }
      }, 300000);
    }

    // Iniciar processo: primeiro executar authentication
    callOnReady();
    
    
    SDK.authentication({
      transactionReference: charge_uuid,
      cardBrand: getCardBrand(userData.number),
      cardExpiryMonth: userData.expiry_month,
      cardExpiryYear: userData.expiry_year,
      cardNumber: userData.number?.replace(/\s/g, ''),
      onSuccess: async function(authResult) {
        // Authentication completado, processar pagamento
        await processPayment(authResult.sessionId);
      },
      onError: async function(authError) {
        // Se authentication falhar, prosseguir sem device data collection
        console.warn('Authentication failed, proceeding without device data collection:', authError.message);
      
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

        console.log('Device Data Collection completed:', data);
        console.log('referenceId:', referenceId);
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
        if (event.origin === 'https://centinelapi.cardinalcommerce.com') {
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
      }, 13000);

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

  /**
   * Renderiza checkout v2 via iframe em modal ou embed.
   * @param {Object} config
   * @param {string} config.checkoutUuid - UUID do checkout.
   * @param {'modal'|'embed'} [config.display='modal'] - Modo de exibição.
   * @param {string} [config.containerId] - Necessário apenas para embed (criado automaticamente se não existir).
   * @param {function} [config.onEvent] - Callback para eventos genéricos.
   * @param {function} [config.onSuccess] - Callback para sucesso.
   * @param {function} [config.onClose] - Callback ao fechar (sempre chamado quando o iframe é removido).
   * @param {function} [config.onError] - Callback para erros.
   */
  SDK.open = function(config) {
    const {
      checkoutUuid,
      display = 'modal',
      containerId,
      onEvent,
      onSuccess,
      onClose,
      onError
    } = config || {};

    function callOnEvent(payload) { if (typeof onEvent === 'function') onEvent(payload); }
    function callOnSuccess(payload) { if (typeof onSuccess === 'function') onSuccess(payload); }
    function callOnClose(payload) { if (typeof onClose === 'function') onClose(payload); }
    function callOnError(err) { if (typeof onError === 'function') onError(err); }

    if (!checkoutUuid) {
      callOnError(new Error('checkoutUuid é obrigatório'));
      return;
    }

    const normalizedDisplay = display === 'embed' ? 'embed' : 'modal';
    const checkoutUrl = `${CHECKOUT_BASE_URL}/${encodeURIComponent(checkoutUuid)}?origin=sdk`;

    // Limpa instância anterior antes de abrir nova
    cleanupCheckout();

    // Cria listener para mensagens do iframe
    const messageListener = function(event) {
      if (event.origin !== CHECKOUT_ORIGIN) return;
      const payload = event.data || {};
      const status = (payload.status || '').toLowerCase();

      if (status === 'paid' || status === 'confirmed' || status === 'ok') {
        callOnSuccess(payload);
        cleanupCheckout(true);
        return;
      }

      if (status === 'error') {
        const err = payload instanceof Error ? payload : new Error(payload?.message || 'Checkout error');
        err.payload = payload;
        callOnError(err);
        cleanupCheckout(true);
        return;
      }

      // Evento genérico
      callOnEvent(payload);

      // Caso receba sinal explícito de fechamento
      if (payload.event === 'checkout-close') {
        cleanupCheckout(true);
      }
    };

    window.addEventListener('message', messageListener);

    // Helpers de DOM
    function buildIframe() {
      const iframe = document.createElement('iframe');
      iframe.src = checkoutUrl;
      iframe.id = 'a55pay-checkout-iframe';
      iframe.style.cssText = 'width:100%;height:100%;border:0;';
      iframe.setAttribute('allow', 'payment *; fullscreen; clipboard-read; clipboard-write');
      iframe.setAttribute('sandbox', 'allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox');
      iframe.loading = 'eager';
      return iframe;
    }

    function buildModal(iframe) {
      const overlay = document.createElement('div');
      overlay.id = 'a55pay-checkout-overlay';
      overlay.style.cssText = [
        'position:fixed','top:0','left:0','width:100%','height:100%',
        'background:rgba(9,12,28,0.75)','backdrop-filter:blur(4px)',
        'z-index:999999','display:flex','align-items:center','justify-content:center',
        'padding:18px','box-sizing:border-box'
      ].join(';');

      const container = document.createElement('div');
      container.id = 'a55pay-checkout-modal';
      container.style.cssText = [
        'background:linear-gradient(180deg,#ffffff 0%,#f9fafb 100%)',
        'border:1px solid rgba(17,24,39,0.08)',
        'border-radius:24px','max-width:920px','width:100%',
        'max-height:90vh','height:90vh',
        'box-shadow:0 24px 80px rgba(0,0,0,0.35)',
        'overflow:visible','position:relative'
      ].join(';');

      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.textContent = '×';
      closeBtn.setAttribute('aria-label', 'Fechar checkout');
      closeBtn.style.cssText = [
        'position:absolute','top:-18px','right:-18px',
        'width:40px','height:40px','border-radius:50%',
        'background:#fff','border:1px solid rgba(0,0,0,0.12)',
        'font-size:22px','font-weight:600','color:#111',
        'cursor:pointer','line-height:1','padding:0',
        'display:flex','align-items:center','justify-content:center',
        'box-shadow:0 4px 12px rgba(0,0,0,0.22)','transition:background 0.2s ease,color 0.2s ease',
        'z-index:3'
      ].join(';');
      closeBtn.onmouseenter = function() {
        closeBtn.style.background = '#f3f3f3';
      };
      closeBtn.onmouseleave = function() {
        closeBtn.style.background = '#fff';
      };
      closeBtn.onclick = function() {
        cleanupCheckout(true);
      };

      container.appendChild(closeBtn);
      container.appendChild(iframe);
      overlay.appendChild(container);
      document.body.appendChild(overlay);
      return { overlay, container };
    }

    function ensureEmbedContainer() {
      let target = containerId ? document.getElementById(containerId) : null;
      if (!target) {
        target = document.createElement('div');
        target.id = containerId || 'a55pay-checkout-embed';
        target.style.cssText = 'width:100%;max-width:100%;min-height:600px;';
        document.body.appendChild(target);
      }
      target.style.position = target.style.position || 'relative';
      target.style.minHeight = target.style.minHeight || '600px';
      return target;
    }

    // Montagem conforme display
    const iframe = buildIframe();
    let overlay = null;
    let container = null;

    if (normalizedDisplay === 'modal') {
      const modal = buildModal(iframe);
      overlay = modal.overlay;
      container = modal.container;
    } else {
      container = ensureEmbedContainer();
      container.appendChild(iframe);
    }

    // Guarda instância atual para permitir cleanup futuro
    currentCheckoutInstance = {
      display: normalizedDisplay,
      overlay,
      container,
      iframe,
      listener: messageListener,
      callbacks: { callOnClose }
    };

    // Retorno opcional
    return {
      close: () => cleanupCheckout(true)
    };
  };

  // Remove iframe/modal e listener ativo.
  function cleanupCheckout(triggerCloseCallback = false) {
    if (!currentCheckoutInstance) return;
    const { overlay, container, iframe, listener, callbacks } = currentCheckoutInstance;

    if (listener) {
      window.removeEventListener('message', listener);
    }

    if (iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe);
    if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);

    // Se embed, remover container apenas se foi criado dinamicamente (pela ausência de containerId)
    // Não removemos container se veio do usuário para evitar efeitos colaterais.
    if (container && container.id === 'a55pay-checkout-embed' && container.parentNode) {
      container.parentNode.removeChild(container);
    }

    if (triggerCloseCallback && callbacks?.callOnClose) {
      callbacks.callOnClose();
    }

    currentCheckoutInstance = null;
  }

  // Expose globally
  global.A55Pay = SDK;
})(window);
