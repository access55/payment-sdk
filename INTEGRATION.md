# A55Pay SDK Integration Guide

## Overview


The A55Pay SDK provides a simple way to integrate 3DS and payment submission into your checkout flow. You provide the `charge_uuid` (from your backend) and user input (`userData`), and the SDK handles the rest by fetching the charge data automatically.

---

## Usage Example

```html
<!-- Add this to your checkout page -->
<script src="https://cdn.jsdelivr.net/npm/a55pay-sdk@latest"></script>
<script>
  // Example: charge_uuid from your backend
  const charge_uuid = '...';

  // Example: userData from your checkout form
  const userData = {
    holder: 'John Doe',
    number: '4111 1111 1111 1111',
    month: '12',
    year: '2028',
    cvc: '123',
    phone: '5511999999999',
    street1: 'Rua Exemplo',
    street2: '',
    city: 'São Paulo',
    state: 'SP',
    zipcode: '01234567',
    country: 'BR',
    device_ipaddress: '1.2.3.4' // (optional, can be fetched by SDK)
  };

  A55Pay.pay({
    selector: '#your-form', // CSS selector for the form or container
    charge_uuid, // This charge_uuid comes from the charge creation response
    userData,
    onSuccess: function(result) {
      // Handle payment success
      console.log('Payment success:', result);
    },
    onError: function(error) {
      // Handle error
      console.log('Payment error:', error);
    },
    onReady: function() {
      // Optional: called when 3DS is ready
    }
  });
</script>
```

---

## userData Fields

| Field            | Type   | Required | Description                                     |
|------------------|--------|----------|-------------------------------------------------|
| holder           | string | Yes      | Cardholder's full name                          |
| number           | string | Yes      | Card number (spaces allowed)                    |
| month            | string | Yes      | Expiry month (MM)                               |
| year             | string | Yes      | Expiry year (YYYY)                              |
| cvc              | string | Yes      | Card CVC/CVV                                    |
| phone            | string | Yes      | Customer phone number (digits only preferred)   |
| street1          | string | Yes      | Billing street address                          |
| street2          | string | No       | Billing address complement                      |
| city             | string | Yes      | Billing city                                    |
| state            | string | Yes      | Billing state (2-letter code)                   |
| zipcode          | string | Yes      | Billing postal code (digits only preferred)     |
| country          | string | Yes      | Country code (2-letter, e.g. 'BR')              |
| device_ipaddress | string | Yes      | Device IP address (optional, can be set by SDK) |

---


## charge_uuid

You only need to provide the `charge_uuid` (string) from your backend. The SDK will fetch all other required charge data automatically from the A55 API.

---

## forceThreeds Parameter

The `forceThreeds` parameter is a boolean flag that determines how the SDK behaves when 3DS authentication fails or is not supported.

- **Default:** `true`
- **Behavior:**
  - When `true`, the SDK will stop the payment process if 3DS authentication fails or is not supported.
  - When `false`, the SDK will proceed with the payment request even if 3DS authentication fails or is not supported.

### Example Usage with `forceThreeds`

```javascript
A55Pay.pay({
  selector: '#your-form',
  charge_uuid, // This charge_uuid comes from the charge creation response
  userData,
  forceThreeds: false, // Proceed with payment even if 3DS fails
  onSuccess: function(result) {
    // Handle payment success
    console.log('Payment success:', result);
  },
  onError: function(error) {
    // Handle error
    console.log('Payment error:', error);
  },
  onReady: function() {
    // Optional: called when 3DS is ready
  }
});
```

---

## Notes
- The SDK will inject all required hidden fields for 3DS into the form/container you specify.
- All callbacks (`onSuccess`, `onError`, `onReady`) are optional but recommended.
- The SDK will handle the 3DS authentication and call your backend `/pay` endpoint automatically.
- The backend payload will match your original API (see your reference.vue for details).
- The SDK now only requires `charge_uuid` and `userData`—it will fetch the charge data for you.

---

For questions or support, contact the A55 team.
