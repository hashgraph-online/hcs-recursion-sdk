export interface LoadQueueItem {
  element: HTMLElement;
  type: 'script' | 'image';
  order: number;
}

export interface HCSConfig {
  cdnUrl: string;
  network: string;
  retryAttempts: number;
  retryBackoff: number;
  debug: boolean;
  showLoadingIndicator: boolean;
  loadingCallbackName: string | null;
}

export interface HCSConfigMapping {
  hcsCdnUrl: keyof HCSConfig;
  hcsNetwork: keyof HCSConfig;
  hcsRetryAttempts: keyof HCSConfig;
  hcsRetryBackoff: keyof HCSConfig;
  hcsDebug: keyof HCSConfig;
  hcsShowLoadingIndicator: keyof HCSConfig;
  hcsLoadingCallbackName: keyof HCSConfig;
}

export interface HCS {
  config: HCSConfig;
  configMapping: HCSConfigMapping;
  LoadedScripts: Record<string, boolean>;
  LoadedWasm: WebAssembly.Instance | null;
  LoadedImages: Record<string, string>;
  scriptLoadedEvent: Event;
  loadQueue: LoadQueueItem[];
  isProcessingQueue: boolean;

  log(...args: any[]): void;
  error(...args: any[]): void;
  loadConfigFromHTML(): void;
  updateLoadingStatus(id: string, status: string): void;
  fetchWithRetry(
    url: string,
    retries?: number,
    backoff?: number
  ): Promise<Response>;
  loadScript(scriptElement: HTMLElement): Promise<void>;
  loadImage(imageElement: HTMLElement): Promise<void>;
  processQueue(): Promise<void>;
  queueLoading(elements: NodeListOf<HTMLElement>, type: string): void;
  init(): Promise<void>;
}

declare global {
  interface Window {
    HCS: Promise<void>;
    HCSReady?: () => void;
  }
}
