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
    // config: { selector, charge_uuid, userData, onSuccess, onError, onReady }
    const { selector, charge_uuid, userData, onSuccess, onError, onReady } = config;
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
          input.name = name;
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
              const payload = {
                payer_name: a55Data.customer?.name,
                payer_email: a55Data.customer?.email,
                installment_count: a55Data.installment_count,
                installment_value: a55Data.value,
                cell_phone: userData.phone?.replace(/\D/g, ''),
                card: {
                  holder_name: userData.holder,
                  number: userData.number?.replace(/\s/g, ''),
                  expiry_month: userData.month,
                  expiry_year: userData.year,
                  ccv: userData.cvc,
                },
                threeds_auth: {
                  eci: e.Eci,
                  request_id: e.ReferenceId,
                  xid: e.Xid,
                  cavv: e.Cavv,
                  version: e.Version
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
            },
            onFailure: function () {
              callOnError(new Error('Authentication failed'));
            },
            onUnenrolled: function () {
              callOnError(new Error('Card not eligible for authentication'));
            },
            onDisabled: function () {
              callOnError(new Error('Authentication disabled'));
            },
            onError: function (e) {
              callOnError(new Error(e?.ReturnMessage || 'Error during authentication process'));
            },
            onUnsupportedBrand: function (e) {
              callOnError(new Error(e?.ReturnMessage || 'Unsupported card brand'));
            },
            Environment: 'PRD'          };
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
      input.name = name;
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
          const payload = {
            payer_name: a55Data.customer?.name,
            payer_email: a55Data.customer?.email,
            installment_count: a55Data.installment_count,
            installment_value: a55Data.value,
            cell_phone: userData.phone?.replace(/\D/g, ''),
            card: {
              holder_name: userData.holder,
              number: userData.number?.replace(/\s/g, ''),
              expiry_month: userData.month,
              expiry_year: userData.year,
              ccv: userData.cvc,
            },
            threeds_auth: {
              eci: e.Eci,
              request_id: e.ReferenceId,
              xid: e.Xid,
              cavv: e.Cavv,
              version: e.Version
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
        },
        onFailure: function () {
          callOnError(new Error('Authentication failed'));
        },
        onUnenrolled: function () {
          callOnError(new Error('Card not eligible for authentication'));
        },
        onDisabled: function () {
          callOnError(new Error('Authentication disabled'));
        },
        onError: function (e) {
          callOnError(new Error(e?.ReturnMessage || 'Error during authentication process'));
        },
        onUnsupportedBrand: function (e) {
          callOnError(new Error(e?.ReturnMessage || 'Unsupported card brand'));
        },
        Environment: 'PRD',
        Debug: true
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
  };

  // Expose globally
  global.A55Pay = SDK;
})(window);
