# A55Pay SDK

Embeddable Payment SDK for 3DS integration (Access55)

## Usage

Include via CDN (after publishing to npm):

```
<script src="https://cdn.jsdelivr.net/npm/a55pay-sdk/dist/a55pay-sdk.min.js"></script>
<!-- or -->
<script src="https://unpkg.com/a55pay-sdk/dist/a55pay-sdk.min.js"></script>
```

Or use the local build:

```
<script src="dist/a55pay-sdk.min.js"></script>
```

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

## Directory Structure

- `a55pay-sdk.js` - Source file
- `dist/a55pay-sdk.js` - Bundled (dev) build
- `dist/a55pay-sdk.min.js` - Minified build

## License
MIT
