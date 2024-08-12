# HCS Recursion SDK

The Recursion SDK is a powerful and flexible tool designed to simplify the integration of Hedera Consensus Service into web applications. It provides an easy way to load and manage HCS-related scripts, styles, and images, with built-in support for configuration, retry mechanisms, and loading indicators.

## Features

- Easy configuration via HTML data attributes
- Automatic loading of HCS-related scripts, styles, and WASM modules
- Support for custom CDNs and networks
- Built-in retry mechanism for failed resource loads
- Customizable loading indicator
- Queue-based loading system with support for load order
- Promise-based initialization

## Usage

Testing locally:

- Copy the contents of the file in [the dist directory](./dist/hcs-recursion-sdk.js) into your HTML file.
- Ensure the script included before any logic that depends on the loading of assets.

```html
<script src="path/to/hcs-sdk.js"></script>
```

Usage with TierBot CDN:
- Remove the SDK from your code.
- The TierBot CDN will automatically inject the latest version of the Recursion SDK into your file. Saving you extra HBAR on inscription fees, and ensuring you have access to all the latest features at the time of inscription.

## Configuration

You can configure the SDK using data attributes on a script tag. Here's an example with all available options:

```html
<script
  data-hcs-config
  data-hcs-cdn-url="https://your-custom-cdn.com/"
  data-hcs-network="testnet"
  data-hcs-debug="true"
  data-hcs-retry-attempts="5"
  data-hcs-retry-backoff="500"
  data-hcs-show-loading-indicator="true"
  data-hcs-loading-callback-name="setLoadingIndicator"
></script>
```

### Configuration Options

- `data-hcs-cdn-url`: The base URL for the CDN hosting your HCS resources (default: "https://tier.bot/api/hashinals-cdn/")
- `data-hcs-network`: The Hedera network to use (default: "mainnet")
- `data-hcs-debug`: Enable debug logging (default: false)
- `data-hcs-retry-attempts`: Number of retry attempts for failed resource loads (default: 3)
- `data-hcs-retry-backoff`: Initial backoff time in milliseconds for retries (default: 300)
- `data-hcs-show-loading-indicator`: Show loading status in console (default: false)
- `data-hcs-loading-callback-name`: Name of a global function to call with loading status updates

## Usage

### Loading HCS Resources

To load HCS resources (scripts, styles, or images), use the `data-src` attribute with the `hcs://` protocol:

```html
<script data-src="hcs://1/0.0.6614307" data-script-id="threejs"></script>
<script data-src="hcs://1/0.0.6627067" data-script-id="animejs"></script>
<script
  data-src="hcs://1/0.0.6633438"
  data-script-id="nes-css"
  type="css"
></script>
<script
  data-src="hcs://1/0.0.6628687"
  data-script-id="rust-wasm"
  type="wasm"
></script>
<img data-src="hcs://1/0.0.6529019" alt="Example Image" />
```

Note, the examples above are real HCS-1 inscribed topics.

### Initialization and Ready State

The SDK automatically initializes itself. To run code after all HCS resources are loaded, define a global `HCSReady` function:

```javascript
window.HCSReady = function () {
  console.log('All HCS resources loaded, initializing application');
  // Your initialization code here
};
```

### Custom Loading Indicator

To use a custom loading indicator, define a global function and specify its name in the configuration:

```html
<script>
  function setLoadingIndicator(id, status) {
    console.log(`Resource ${id}: ${status}`);
    // Update your custom loading UI here
  }
</script>
<script
  data-hcs-config
  data-hcs-loading-callback-name="setLoadingIndicator"
></script>
```

## Advanced Usage

### Load Order

You can specify the load order for resources using the `data-load-order` attribute:

```html
<script
  data-src="hcs://1/0.0.6614307"
  data-script-id="threejs"
  data-load-order="1"
></script>
<script
  data-src="hcs://1/0.0.6627067"
  data-script-id="animejs"
  data-load-order="2"
></script>
```

### Required Scripts

Mark a script as required by adding the `data-required` attribute. If a required script fails to load, the SDK will stop processing the queue:

```html
<script
  data-src="hcs://1/0.0.6614307"
  data-script-id="threejs"
  data-required
></script>
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

If you encounter any problems or have any questions, please open an issue in this repository.
