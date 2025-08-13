# A55Pay SDK

Embeddable Payment SDK for 3DS integration (Access55) with Yuno SDK support

## Features

- **3DS Integration**: Built-in support for 3D Secure authentication via Braspag
- **Yuno SDK Integration**: Full integration with Yuno payment platform
- **Dynamic Script Loading**: Automatically loads required dependencies
- **Error Handling**: Comprehensive error handling and validation
- **Flexible Configuration**: Customizable payment flows and options

## Usage

The A55Pay SDK provides two main integration methods:

### 1. 3DS Integration (A55Pay.pay)

Traditional 3D Secure integration with Braspag for card payments.

### 2. Yuno SDK Integration (A55Pay.checkout)

Modern payment processing through Yuno platform with support for multiple payment methods.

# payment-sdk

<script src="dist/a55pay-sdk.min.js"></script>

```

> **Note:** Always use `@latest` to ensure you get the most recent version. Version bumps are handled automatically by our CI/CD pipeline.

## Build

```
pnpm install
pnpm run build:dev   # Regular build
pnpm run build       # Minified build
```
# Package Manager

This project uses [pnpm](https://pnpm.io/) for fast, disk-efficient dependency management. If you don't have pnpm, install it globally:

```
npm install -g pnpm
```

## Deploy to CDN

1. Publish to npm:
   - Update version in package.json
   - Run `npm publish`
2. Your SDK will be available via jsDelivr and UNPKG automatically.


## Purge CDN Cache (jsDelivr)

If you publish a new version and the CDN does not update immediately, you can force-refresh the cache using the jsDelivr purge tool:

1. Go to [https://www.jsdelivr.com/tools/purge](https://www.jsdelivr.com/tools/purge)
2. Enter the full URL of your file, for example:
   - `https://cdn.jsdelivr.net/npm/a55pay-sdk@latest`
3. Click **Purge** to clear the cache and force jsDelivr to fetch the latest version.

This is useful if you or your users are not seeing the latest changes after a new release.

## Automated Publishing

Every push to the `main` branch triggers a GitHub Actions workflow that:
- Installs dependencies with pnpm
- Builds the SDK
- Publishes the latest version to npm with `@latest`

Your SDK will be available via jsDelivr and UNPKG automatically after each publish.

## Directory Structure

- `a55pay-sdk.js` - Source file

- `dist/a55pay-sdk.js` - Bundled (dev) build
- O botão de pagamento só deve ser habilitado após o evento `onReady`.
- Use o callback `onLoading` para feedback visual de carregamento.
- O método `A55Pay.startPayment()` dispara o fluxo de pagamento do Yuno.
- `dist/a55pay-sdk.min.js` - Minified build

## Configuration Options

### 3DS Integration (A55Pay.pay)

#### `forceThreeds`

The `forceThreeds` parameter is a boolean flag that controls the behavior of the SDK when 3DS authentication fails or is not supported.

- **Default:** `true`
- **Description:**
  - When `true`, the SDK will stop the payment process if 3DS authentication fails or is not supported.
  - When `false`, the SDK will proceed with the payment request even if 3DS authentication fails or is not supported.

#### Example Usage

```javascript
A55Pay.pay({
  selector: '#payment-container',
  charge_uuid: 'your-charge-uuid',
  userData: {
    number: '4111 1111 1111 1111',
    month: '12',
    year: '2030',
    cvc: '123',
    holder: 'John Doe',
    phone: '+5511999999999',
    street1: 'Street 1',
    city: 'City',
    state: 'State',
    zipcode: '12345-678',
    country: 'BR',
  },
  forceThreeds: false, // Proceed with payment even if 3DS fails
  onSuccess: (response) => {
    console.log('Payment successful:', response);
  },
  onError: (error) => {
    console.error('Payment failed:', error);
  },
});
```

### Yuno SDK Integration (A55Pay.checkout)

Modern payment integration with Yuno platform supporting multiple payment methods.

#### Example Usage

```javascript
A55Pay.checkout({
  selector: '#yuno-checkout-container',
  charge_uuid: 'your-charge-uuid',
  checkoutSession: 'your-yuno-checkout-session',
  apiKey: 'your-yuno-public-api-key',
  countryCode: 'BR', // Optional, default: 'BR'
  
  onSuccess: function(result) {
    console.log('Payment successful:', result);
    // result.status: 'SUCCEEDED', 'APPROVED', 'PENDING', etc.
    // result.pending: boolean indicating if payment is still processing
  },
  
  onError: function(error) {
    console.error('Payment failed:', error);
  },
  
  onReady: function() {
    console.log('Yuno SDK loaded and ready');
  }
});
```

#### Required Parameters

- **selector** (string): CSS selector for the checkout container element
- **charge_uuid** (string): A55 charge UUID
- **checkoutSession** (string): Yuno checkout session ID
- **apiKey** (string): Yuno public API key

#### Optional Parameters

- **countryCode** (string): Country code (default: 'BR')
- **onSuccess** (function): Success callback
- **onError** (function): Error callback
- **onReady** (function): Ready callback

For detailed Yuno integration documentation, see [YUNO_INTEGRATION.md](./YUNO_INTEGRATION.md).

## Configuration Options (Legacy)

### `forceThreeds`

The `forceThreeds` parameter is a boolean flag that controls the behavior of the SDK when 3DS authentication fails or is not supported.

- **Default:** `true`
- **Description:**
  - When `true`, the SDK will stop the payment process if 3DS authentication fails or is not supported.
  - When `false`, the SDK will proceed with the payment request even if 3DS authentication fails or is not supported.

### Example Usage

```javascript
A55Pay.pay({
  selector: '#payment-container',
  charge_uuid: 'your-charge-uuid',
  userData: {
    number: '4111 1111 1111 1111',
    month: '12',
    year: '2030',
    cvc: '123',
    holder: 'John Doe',
    phone: '+5511999999999',
    street1: 'Street 1',
    city: 'City',
    state: 'State',
    zipcode: '12345-678',
    country: 'BR',
  },
  forceThreeds: false, // Proceed with payment even if 3DS fails
  onSuccess: (response) => {
    console.log('Payment successful:', response);
  },
  onError: (error) => {
    console.error('Payment failed:', error);
  },
});
```

## License
MIT
