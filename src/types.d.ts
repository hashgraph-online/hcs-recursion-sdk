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
  LoadedVideos: Record<string, string>;
  LoadedAudios: Record<string, HTMLAudioElement>;
  LoadedAudioUrls: Record<string, string>;
  LoadedGLBs: Record<string, string>;
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
  isDuplicate(topicId: string): boolean;
  loadScript(scriptElement: HTMLElement): Promise<void>;
  loadStylesheet(linkElement: HTMLElement): Promise<void>;
  loadImage(imageElement: HTMLElement): Promise<void>;
  loadMedia(videoElement: HTMLElement, mediaType: string): Promise<void>;
  loadGLB(glbElement: HTMLElement): Promise<void>;
  processQueue(): Promise<void>;
  queueLoading(elements: NodeListOf<HTMLElement>, type: string): void;
  loadAndPlayAudio(topicId: string, autoplay?: boolean, volume?: number): void;
  playAudio(topicId: string, volume?: number): void;
  preloadAudio(topicId: string): void;
  pauseAudio(topicId: string): void;
  init(): Promise<void>;
}

declare global {
  interface Window {
    HCS: HCS;
    HCSReady?: () => void;
  }
}
