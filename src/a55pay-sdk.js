// a55pay-sdk.js
// Embeddable Payment SDK for 3DS integration (Access55)
// Usage: <script src="a55pay-sdk.js"></script>
//        A55Pay.pay({ onSuccess, onError })

(function (global) {
  const SDK = {};

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
        const response = await fetch(`https://core-manager.a55.tech/api/v1/bank/public/charge/${chargeUuid}/pay`, {
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

      // Timeout de segurança (30 segundos conforme boas práticas)
      const timeout = setTimeout(() => {
        if (!processed) {
          processed = true;
          cleanup();
          // Retornar sucesso mesmo com timeout, pois a coleta pode ter funcionado
          callOnSuccess({
            sessionId: referenceId,
            accessToken: accessToken,
            referenceId: referenceId,
            timeout: true,
            deviceDataCollection: 'timeout_but_likely_successful'
          });
        }
      }, 30000);

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

  // Expose globally
  global.A55Pay = SDK;
})(window);
