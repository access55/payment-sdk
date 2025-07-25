# A55Pay SDK

Embeddable Payment SDK for 3DS integration (Access55)

## Usage

### Always use the latest version

This SDK is published automatically on every push to `main`. To always get the latest version, use one of the following methods:

#### CDN (recommended)

```
<script src="https://cdn.jsdelivr.net/npm/a55pay-sdk@latest"></script>
<!-- or -->
<script src="https://unpkg.com/a55pay-sdk@latest"></script>
```

#### npm (recommended for projects)

```
npm install a55pay-sdk@latest
# or
yarn add a55pay-sdk@latest
# or
pnpm add a55pay-sdk@latest
```

#### Local build (for development)

```
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
- `dist/a55pay-sdk.min.js` - Minified build

## Configuration Options

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
