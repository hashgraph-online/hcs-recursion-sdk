import { HCS, LoadQueueItem } from './types';

const HCS: HCS = {
  config: {
    cdnUrl: 'https://tier.bot/api/hashinals-cdn/',
    network: 'mainnet',
    retryAttempts: 3,
    retryBackoff: 300,
    debug: false,
    showLoadingIndicator: false,
    loadingCallbackName: null,
  },
  configMapping: {
    hcsCdnUrl: 'cdnUrl',
    hcsNetwork: 'network',
    hcsRetryAttempts: 'retryAttempts',
    hcsRetryBackoff: 'retryBackoff',
    hcsDebug: 'debug',
    hcsShowLoadingIndicator: 'showLoadingIndicator',
    hcsLoadingCallbackName: 'loadingCallbackName',
  },
  LoadedScripts: {},
  LoadedWasm: null,
  LoadedImages: {},
  scriptLoadedEvent: new Event('HCSScriptLoaded'),
  loadQueue: [],
  isProcessingQueue: false,

  log(...args: any[]) {
    if (this.config.debug) {
      console.log('[HCS SDK]', ...args);
    }
  },

  error(...args: any[]) {
    console.error('[HCS SDK]', ...args);
  },

  loadConfigFromHTML() {
    const configScript = document.querySelector('script[data-hcs-config]');
    if (configScript) {
      Object.keys(this.configMapping).forEach((dataAttr) => {
        // @ts-ignore
        if (dataAttr in configScript.dataset) {
          const configKey = this.configMapping[dataAttr];
          // @ts-ignore
          let value: any = configScript.dataset[dataAttr];

          if (value === 'true') value = true;
          if (value === 'false') value = false;
          if (!isNaN(value) && value !== '') value = Number(value);

          this.config[configKey] = value;
        }
      });
    }
    this.log('Loaded config:', this.config);
  },

  updateLoadingStatus(id: string, status: string) {
    if (this.config.showLoadingIndicator) {
      console.log(`[HCS Loading] ${id}: ${status}`);
    }

    if (
      this.config.loadingCallbackName &&
      typeof window[this.config.loadingCallbackName] === 'function'
    ) {
      // @ts-ignore
      window[this.config.loadingCallbackName](id, status);
    }
  },

  async fetchWithRetry(
    url: string,
    retries: number = this.config.retryAttempts,
    backoff: number = this.config.retryBackoff
  ) {
    try {
      const response = await fetch(url);
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      return response;
    } catch (error) {
      if (retries > 0) {
        this.log(`Retrying fetch for ${url}. Attempts left: ${retries - 1}`);
        await new Promise((resolve) => setTimeout(resolve, backoff));
        return this.fetchWithRetry(url, retries - 1, backoff * 2);
      }
      throw error;
    }
  },

  async loadScript(scriptElement: HTMLElement) {
    const src = scriptElement.getAttribute('data-src');
    const scriptId = scriptElement.getAttribute('data-script-id');
    const topicId = src!.split('/').pop()!;
    const type = scriptElement.getAttribute('type');
    const isRequired = scriptElement.hasAttribute('data-required');

    this.updateLoadingStatus(scriptId!, 'loading');

    try {
      const cdnUrl =
        scriptElement.getAttribute('data-cdn-url') || this.config.cdnUrl;
      const network =
        scriptElement.getAttribute('data-network') || this.config.network;
      const response = await this.fetchWithRetry(
        `${cdnUrl}${topicId}?network=${network}`
      );

      if (type === 'css') {
        const content = await response.text();
        const style = document.createElement('style');
        style.textContent = content;
        document.head.appendChild(style);
      } else if (type === 'wasm') {
        const arrayBuffer = await response.arrayBuffer();
        const wasmModule = await WebAssembly.compile(arrayBuffer);
        this.LoadedWasm = await WebAssembly.instantiate(wasmModule, {
          env: {},
          ...scriptElement.dataset,
        });
      } else {
        const content = await response.text();
        const script = document.createElement('script');
        script.textContent = content;
        document.body.appendChild(script);
      }

      this.LoadedScripts[scriptId!] = true;
      this.updateLoadingStatus(scriptId!, 'loaded');
      window.dispatchEvent(this.scriptLoadedEvent);
      this.log(`Loaded script: ${scriptId}`);
    } catch (error) {
      this.error(`Failed to load ${type || 'script'}: ${scriptId}`, error);
      this.updateLoadingStatus(scriptId!, 'failed');
      if (isRequired) {
        throw error;
      }
    }
  },

  async loadImage(imageElement: HTMLElement) {
    const src = imageElement.getAttribute('data-src');
    const topicId = src!.split('/').pop()!;

    this.log(`Loading image: ${topicId}`);
    this.updateLoadingStatus(`Image: ${topicId}`, 'loading');

    try {
      const cdnUrl =
        imageElement.getAttribute('data-cdn-url') || this.config.cdnUrl;
      const network =
        imageElement.getAttribute('data-network') || this.config.network;
      const response = await this.fetchWithRetry(
        `${cdnUrl}${topicId}?network=${network}`
      );
      const blob = await response.blob();
      const objectURL = URL.createObjectURL(blob);
      (imageElement as HTMLImageElement).src = objectURL;
      this.LoadedImages[topicId] = objectURL;
      this.updateLoadingStatus(`Image: ${topicId}`, 'loaded');
      this.log(`Loaded image: ${topicId}`);
    } catch (error) {
      this.error(`Failed to load image: ${topicId}`, error);
      this.updateLoadingStatus(`Image: ${topicId}`, 'failed');
    }
  },

  async processQueue() {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    while (this.loadQueue.length > 0) {
      const item = this.loadQueue.shift();
      try {
        if (item!.type === 'script') {
          await this.loadScript(item!.element);
        } else if (item!.type === 'image') {
          await this.loadImage(item!.element);
        }
      } catch (error) {
        this.error(`Error processing queue item:`, error);
        if (
          item!.type === 'script' &&
          item!.element.hasAttribute('data-required')
        ) {
          break;
        }
      }
    }

    this.isProcessingQueue = false;
  },

  queueLoading(elements: NodeListOf<HTMLElement>, type: string) {
    elements.forEach((element) => {
      const order =
        parseInt(element.getAttribute('data-load-order') || '') || Infinity;
      this.loadQueue.push({ element, type, order });
    });

    this.loadQueue.sort(
      (a: LoadQueueItem, b: LoadQueueItem) => a.order - b.order
    );

    this.processQueue();
  },

  init() {
    this.loadConfigFromHTML();

    return new Promise<void>((resolve) => {
      const scriptElements = document.querySelectorAll(
        'script[data-src^="hcs://"]'
      );
      const imageElements = document.querySelectorAll(
        'img[data-src^="hcs://"]'
      );

      this.queueLoading(scriptElements, 'script');
      this.queueLoading(imageElements, 'image');

      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === Node.ELEMENT_NODE) {
              if ((node as HTMLElement).matches('script[data-src^="hcs://"]')) {
                this.queueLoading([node as HTMLElement], 'script');
              } else if (
                (node as HTMLElement).matches('img[data-src^="hcs://"]')
              ) {
                this.queueLoading([node as HTMLElement], 'image');
              }
            }
          });
        });
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true,
      });

      const checkLoaded = () => {
        if (this.loadQueue.length === 0) {
          resolve();
        } else {
          requestAnimationFrame(checkLoaded);
        }
      };
      checkLoaded();
    });
  },
};

window.HCS = HCS.init().then(() => {
  console.log('All HCS resources loaded');
  if (typeof window.HCSReady === 'function') {
    window.HCSReady();
  }
});
