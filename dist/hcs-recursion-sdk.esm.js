const sleep = (ms) => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};
class HCS {
  constructor() {
    this.modelViewerLoaded = false;
    this.modelViewerLoading = null;
    this.config = {
      cdnUrl: "https://kiloscribe.com/api/inscription-cdn/",
      network: "mainnet",
      retryAttempts: 3,
      retryBackoff: 300,
      debug: false,
      showLoadingIndicator: false,
      loadingCallbackName: null
    };
    this.configMapping = {
      hcsCdnUrl: "cdnUrl",
      hcsNetwork: "network",
      hcsRetryAttempts: "retryAttempts",
      hcsRetryBackoff: "retryBackoff",
      hcsDebug: "debug",
      hcsShowLoadingIndicator: "showLoadingIndicator",
      hcsLoadingCallbackName: "loadingCallbackName"
    };
    this.LoadedScripts = {};
    this.LoadedWasm = {};
    this.LoadedImages = {};
    this.LoadedVideos = {};
    this.LoadedAudios = {};
    this.LoadedAudioUrls = {};
    this.LoadedGLBs = {};
    this.scriptLoadedEvent = new Event("HCSScriptLoaded");
    this.loadQueue = [];
    this.isProcessingQueue = false;
  }
  log(...args) {
    if (this.config.debug) {
      console.log("[HCS SDK]", ...args);
    }
  }
  error(...args) {
    console.error("[HCS SDK]", ...args);
  }
  loadConfigFromHTML() {
    const configScript = document.querySelector(
      "script[data-hcs-config]"
    );
    if (configScript) {
      Object.keys(this.configMapping).forEach((dataAttr) => {
        if (configScript.dataset[dataAttr]) {
          const configKey = this.configMapping[dataAttr];
          let value = configScript.dataset[dataAttr];
          if (value === "true") value = true;
          if (value === "false") value = false;
          if (!isNaN(Number(value)) && value !== "") value = Number(value);
          this.config[configKey] = value;
        }
      });
    }
    this.log("Loaded config:", this.config);
  }
  updateLoadingStatus(id, status) {
    if (this.LoadedScripts[id] === "loaded") {
      return;
    }
    if (this.config.showLoadingIndicator) {
      console.log("[HCS Loading] " + id + " : " + status);
    }
    this.LoadedScripts[id] = status;
    if (this.config.loadingCallbackName && typeof window[this.config.loadingCallbackName] === "function") {
      const callback = window[this.config.loadingCallbackName];
      if (typeof callback === "function") {
        callback(id, status);
      }
    }
  }
  async fetchWithRetry(url, retries = this.config.retryAttempts, backoff = this.config.retryBackoff) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("HTTP error! status: " + response.status);
      }
      return response;
    } catch (error) {
      if (retries > 0) {
        this.log(
          "Retrying fetch for " + url + " Attempts left: " + (retries - 1)
        );
        await this.sleep(backoff);
        return this.fetchWithRetry(url, retries - 1, backoff * 2);
      }
      throw error;
    }
  }
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
  isDuplicate(topicId) {
    return !!this.LoadedScripts[topicId];
  }
  async retrieveHCS1Data(topicId, cdnUrl = this.config.cdnUrl, network = this.config.network) {
    const cleanNetwork = network.replace(/['"]+/g, "");
    const response = await this.fetchWithRetry(
      cdnUrl + topicId + "?network=" + cleanNetwork
    );
    return await response.blob();
  }
  async loadScript(scriptElement) {
    const src = scriptElement.getAttribute("data-src");
    const scriptId = scriptElement.getAttribute("data-script-id");
    const topicId = src == null ? void 0 : src.split("/").pop();
    const type = scriptElement.getAttribute("type");
    const isRequired = scriptElement.hasAttribute("data-required");
    const isModule = scriptElement.getAttribute("type") === "module";
    if (this.isDuplicate(topicId || "")) {
      return;
    }
    this.updateLoadingStatus(scriptId, "loading");
    try {
      const cdnUrl = scriptElement.getAttribute("data-cdn-url") || this.config.cdnUrl;
      const network = scriptElement.getAttribute("data-network") || this.config.network;
      const blob = await this.retrieveHCS1Data(topicId, cdnUrl, network);
      if (type === "wasm") {
        const arrayBuffer = await blob.arrayBuffer();
        const wasmModule = await WebAssembly.compile(arrayBuffer);
        this.LoadedWasm[scriptId] = await WebAssembly.instantiate(wasmModule, {
          env: {},
          ...scriptElement.dataset
        });
        this.updateLoadingStatus(scriptId, "loaded");
        window.dispatchEvent(this.scriptLoadedEvent);
        this.log("Loaded wasm: " + scriptId);
      } else {
        const content = await blob.text();
        const script = document.createElement("script");
        script.textContent = content;
        script.className = "hcs-inline-script";
        if (scriptId) {
          script.setAttribute("data-loaded-script-id", scriptId);
        }
        if (isModule) {
          script.type = "module";
          const moduleBlob = new Blob([content], {
            type: "application/javascript"
          });
          script.src = URL.createObjectURL(moduleBlob);
        }
        document.body.appendChild(script);
        this.updateLoadingStatus(scriptId, "loaded");
        window.dispatchEvent(this.scriptLoadedEvent);
        this.log("Loaded script: " + scriptId);
        script.onerror = (error) => {
          this.error("Failed to load " + type + ": " + scriptId, error);
          this.updateLoadingStatus(scriptId, "failed");
          if (isRequired) {
            throw error;
          }
        };
      }
    } catch (error) {
      this.error("Failed to load " + type + ": " + scriptId, error);
      this.updateLoadingStatus(scriptId, "failed");
      if (isRequired) {
        throw error;
      }
    }
  }
  async loadModuleExports(scriptId) {
    const script = document.querySelector(
      'script[data-loaded-script-id="' + scriptId + '"]'
    );
    if (!script) {
      throw new Error("Module script with id " + scriptId + " not found");
    }
    const scriptSrc = script.getAttribute("src");
    if (!scriptSrc) {
      throw new Error("Module script " + scriptId + " has no src attribute");
    }
    return await import(scriptSrc);
  }
  async loadStylesheet(linkElement) {
    const src = linkElement.getAttribute("data-src");
    const stylesheetId = linkElement.getAttribute("data-script-id");
    const topicId = src == null ? void 0 : src.split("/").pop();
    const isRequired = linkElement.hasAttribute("data-required");
    if (this.isDuplicate(topicId || "")) {
      return;
    }
    this.updateLoadingStatus(stylesheetId, "loading");
    try {
      const cdnUrl = linkElement.getAttribute("data-cdn-url") || this.config.cdnUrl;
      const network = linkElement.getAttribute("data-network") || this.config.network;
      const blob = await this.retrieveHCS1Data(topicId, cdnUrl, network);
      const cssContent = await blob.text();
      const style = document.createElement("style");
      style.textContent = cssContent;
      document.head.appendChild(style);
      this.updateLoadingStatus(stylesheetId, "loaded");
      window.dispatchEvent(this.scriptLoadedEvent);
      this.log("Loaded and inlined stylesheet: " + stylesheetId);
    } catch (error) {
      this.error("Failed to load stylesheet: " + stylesheetId, error);
      this.updateLoadingStatus(stylesheetId, "failed");
      if (isRequired) {
        throw error;
      }
    }
  }
  async loadImage(imageElement) {
    const src = imageElement.getAttribute("data-src");
    const topicId = src == null ? void 0 : src.split("/").pop();
    this.log("Loading image: " + topicId);
    this.updateLoadingStatus("Image: " + topicId, "loaded");
    try {
      const cdnUrl = imageElement.getAttribute("data-cdn-url") || this.config.cdnUrl;
      const network = imageElement.getAttribute("data-network") || this.config.network;
      const blob = await this.retrieveHCS1Data(topicId, cdnUrl, network);
      const objectURL = URL.createObjectURL(blob);
      imageElement.src = objectURL;
      this.LoadedImages[topicId] = objectURL;
      this.updateLoadingStatus("Image: " + topicId, "loaded");
      this.log("Loaded image: " + topicId);
    } catch (error) {
      this.error("Failed to load image: " + topicId, error);
      this.updateLoadingStatus("Image: " + topicId, "failed");
    }
  }
  async loadMedia(mediaElement, mediaType) {
    const src = mediaElement.getAttribute("data-src");
    const topicId = src == null ? void 0 : src.split("/").pop();
    this.log("Loading " + mediaType + ": " + topicId);
    this.updateLoadingStatus(mediaType + ": " + topicId, "loading");
    try {
      const cdnUrl = mediaElement.getAttribute("data-cdn-url") || this.config.cdnUrl;
      const network = mediaElement.getAttribute("data-network") || this.config.network;
      const blob = await this.retrieveHCS1Data(topicId, cdnUrl, network);
      const objectURL = URL.createObjectURL(blob);
      mediaElement.src = objectURL;
      if (mediaType === "video") {
        this.LoadedVideos[topicId] = objectURL;
      } else {
        this.LoadedAudioUrls[topicId] = objectURL;
      }
      this.updateLoadingStatus(mediaType + ": " + topicId, "loaded");
      this.log("Loaded " + mediaType + ": " + topicId);
    } catch (error) {
      this.error("Failed to load " + mediaType + ": " + topicId, error);
      this.updateLoadingStatus(mediaType + ": " + topicId, "failed");
    }
  }
  async loadModelViewer() {
    if (this.modelViewerLoading) return this.modelViewerLoading;
    if (this.modelViewerLoaded) return Promise.resolve();
    this.modelViewerLoading = new Promise((resolve) => {
      const modelViewerScript = document.createElement("script");
      modelViewerScript.setAttribute("data-src", "hcs://1/0.0.7293044");
      modelViewerScript.setAttribute("data-script-id", "model-viewer");
      modelViewerScript.setAttribute("type", "module");
      window.addEventListener(
        "HCSScriptLoaded",
        () => {
          this.modelViewerLoaded = true;
          resolve();
        },
        { once: true }
      );
      this.loadScript(modelViewerScript);
    });
    return this.modelViewerLoading;
  }
  async loadGLB(glbElement) {
    var _a;
    await this.loadModelViewer();
    const src = glbElement.getAttribute("data-src");
    const topicId = src == null ? void 0 : src.split("/").pop();
    this.log("Loading GLB: " + topicId);
    this.updateLoadingStatus("GLB: " + topicId, "loading");
    try {
      const cdnUrl = glbElement.getAttribute("data-cdn-url") || this.config.cdnUrl;
      const network = glbElement.getAttribute("data-network") || this.config.network;
      let modelViewer;
      if (glbElement.tagName.toLowerCase() !== "model-viewer") {
        modelViewer = document.createElement("model-viewer");
        Array.from(glbElement.attributes).forEach((attr) => {
          modelViewer.setAttribute(attr.name, attr.value);
        });
        modelViewer.setAttribute("camera-controls", "");
        modelViewer.setAttribute("auto-rotate", "");
        modelViewer.setAttribute("ar", "");
        (_a = glbElement.parentNode) == null ? void 0 : _a.replaceChild(modelViewer, glbElement);
      } else {
        modelViewer = glbElement;
      }
      const blob = await this.retrieveHCS1Data(topicId, cdnUrl, network);
      const objectURL = URL.createObjectURL(blob);
      modelViewer.setAttribute("src", objectURL);
      this.LoadedGLBs[topicId] = objectURL;
      this.updateLoadingStatus("GLB: " + topicId, "loaded");
      this.log("Loaded GLB: " + topicId);
    } catch (error) {
      this.error("Failed to load GLB: " + topicId, error);
      this.updateLoadingStatus("GLB: " + topicId, "failed");
    }
  }
  async loadResource(element, type, order) {
    return new Promise((resolve) => {
      this.loadQueue.push({ element, type, order, resolve });
      this.processQueue();
    });
  }
  async processQueue() {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;
    while (this.loadQueue.length > 0) {
      const item = this.loadQueue.shift();
      try {
        if (item.type === "script") {
          await this.loadScript(item.element);
        } else if (item.type === "image") {
          await this.loadImage(item.element);
        } else if (item.type === "video" || item.type === "audio") {
          await this.loadMedia(item.element, item.type);
        } else if (item.type === "glb") {
          await this.loadGLB(item.element);
        } else if (item.type === "css") {
          await this.loadStylesheet(item.element);
        }
        item.resolve();
      } catch (error) {
        this.error("Error processing queue item:", error);
        if (item.type === "script" && item.element.hasAttribute("data-required")) {
          break;
        }
      }
    }
    this.isProcessingQueue = false;
  }
  async replaceHCSInStyle(styleContent) {
    let newContent = styleContent;
    let startIndex = newContent.indexOf("hcs://");
    while (startIndex !== -1) {
      let endIndex = startIndex;
      while (endIndex < newContent.length && !["'", '"', " ", ")"].includes(newContent[endIndex])) {
        endIndex++;
      }
      const hcsUrl = newContent.substring(startIndex, endIndex);
      const topicId = hcsUrl.split("/").pop();
      try {
        const cdnUrl = this.config.cdnUrl;
        const network = this.config.network;
        const blob = await this.retrieveHCS1Data(topicId, cdnUrl, network);
        const objectURL = URL.createObjectURL(blob);
        newContent = newContent.substring(0, startIndex) + objectURL + newContent.substring(endIndex);
        this.LoadedImages[topicId] = objectURL;
        this.log("Replaced CSS HCS URL: " + hcsUrl + " with " + objectURL);
      } catch (error) {
        this.error("Failed to load CSS image: " + topicId, error);
      }
      startIndex = newContent.indexOf("hcs://", startIndex + 1);
    }
    return newContent;
  }
  async processInlineStyles() {
    var _a;
    const elementsWithStyle = document.querySelectorAll('[style*="hcs://"]');
    this.log(
      "Found " + elementsWithStyle.length + " elements with HCS style references"
    );
    for (const element of Array.from(elementsWithStyle)) {
      const style = element.getAttribute("style");
      if (style) {
        this.log("Processing style: " + style);
        const newStyle = await this.replaceHCSInStyle(style);
        if (style !== newStyle) {
          element.setAttribute("style", newStyle);
          this.log("Updated style to: " + newStyle);
        }
      }
    }
    const styleTags = document.querySelectorAll("style");
    for (const styleTag of Array.from(styleTags)) {
      if ((_a = styleTag.textContent) == null ? void 0 : _a.includes("hcs://")) {
        const newContent = await this.replaceHCSInStyle(styleTag.textContent);
        if (styleTag.textContent !== newContent) {
          styleTag.textContent = newContent;
        }
      }
    }
  }
  async init() {
    this.loadConfigFromHTML();
    return new Promise((resolve) => {
      const initializeObserver = async () => {
        const scriptElements = document.querySelectorAll(
          'script[data-src^="hcs://"]'
        );
        const imageElements = document.querySelectorAll(
          'img[data-src^="hcs://"]'
        );
        const videoElements = document.querySelectorAll(
          'video[data-src^="hcs://"]'
        );
        const audioElements = document.querySelectorAll(
          'audio[data-src^="hcs://"]'
        );
        const glbElements = document.querySelectorAll(
          'model-viewer[data-src^="hcs://"]'
        );
        const cssElements = document.querySelectorAll(
          'link[data-src^="hcs://"]'
        );
        await this.processInlineStyles();
        const loadPromises = [];
        [
          { elements: scriptElements, type: "script" },
          { elements: imageElements, type: "image" },
          { elements: videoElements, type: "video" },
          { elements: audioElements, type: "audio" },
          { elements: glbElements, type: "glb" },
          { elements: cssElements, type: "css" }
        ].forEach(({ elements, type }) => {
          elements.forEach((element) => {
            const order = parseInt(element.getAttribute("data-load-order") || "") || Infinity;
            loadPromises.push(
              this.loadResource(element, type, order)
            );
          });
        });
        await Promise.all(loadPromises);
        const observer = new MutationObserver((mutations) => {
          mutations.forEach((mutation) => {
            var _a;
            mutation.addedNodes.forEach((node) => {
              var _a2, _b;
              if (node.nodeType === Node.ELEMENT_NODE) {
                const element = node;
                if ((_a2 = element.getAttribute("style")) == null ? void 0 : _a2.includes("hcs://")) {
                  this.processInlineStyles();
                }
                if (element.tagName.toLowerCase() === "style" && ((_b = element.textContent) == null ? void 0 : _b.includes("hcs://"))) {
                  this.processInlineStyles();
                }
                if (element.matches('script[data-src^="hcs://"]')) {
                  this.loadResource(element, "script", Infinity);
                } else if (element.matches('img[data-src^="hcs://"]')) {
                  this.loadResource(element, "image", Infinity);
                } else if (element.matches('video[data-src^="hcs://"]')) {
                  this.loadResource(element, "video", Infinity);
                } else if (element.matches('audio[data-src^="hcs://"]')) {
                  this.loadResource(element, "audio", Infinity);
                } else if (element.matches('model-viewer[data-src^="hcs://"]')) {
                  this.loadResource(element, "glb", Infinity);
                } else if (element.matches('link[data-src^="hcs://"]')) {
                  this.loadResource(element, "css", Infinity);
                }
              }
            });
            if (mutation.type === "attributes" && mutation.attributeName === "style") {
              const element = mutation.target;
              if ((_a = element.getAttribute("style")) == null ? void 0 : _a.includes("hcs://")) {
                this.processInlineStyles();
              }
            }
          });
        });
        if (document.body) {
          observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["style"]
          });
        } else {
          document.addEventListener("DOMContentLoaded", () => {
            observer.observe(document.body, {
              childList: true,
              subtree: true,
              attributes: true,
              attributeFilter: ["style"]
            });
          });
        }
        resolve();
      };
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initializeObserver);
      } else {
        initializeObserver();
      }
    });
  }
  async preloadImage(topicId) {
    this.log("Loading image:" + topicId);
    this.updateLoadingStatus("image: " + topicId, "loading");
    const blob = await this.retrieveHCS1Data(topicId);
    const objectURL = URL.createObjectURL(blob);
    this.LoadedImages[topicId] = objectURL;
    this.updateLoadingStatus("image: " + topicId, "loaded");
    return objectURL;
  }
  async preloadAudio(topicId) {
    const audioElement = document.createElement("audio");
    audioElement.setAttribute("data-topic-id", topicId);
    audioElement.setAttribute("data-src", "hcs://1/" + topicId);
    document.body.appendChild(audioElement);
    await this.loadMedia(audioElement, "audio");
    const cachedAudio = document.querySelector(
      'audio[data-topic-id="' + topicId + '"]'
    );
    if (cachedAudio) {
      this.LoadedAudioUrls[topicId] = cachedAudio.src;
    } else {
      console.error("Failed to preload audio: " + topicId);
    }
    return this.LoadedAudioUrls[topicId];
  }
  async playAudio(topicId, volume = 1) {
    const audioUrl = this.LoadedAudioUrls[topicId];
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.volume = volume;
      this.LoadedAudios[topicId] = audio;
      audio.play().catch((error) => {
        console.error("Failed to play audio:", error);
      });
      audio.addEventListener("ended", () => {
        audio.remove();
        delete this.LoadedAudios[topicId];
      });
    } else {
      console.error("Audio not preloaded: " + topicId);
    }
  }
  async pauseAudio(topicId) {
    var _a, _b;
    const audioElement = document.querySelector(
      'audio[data-topic-id="' + topicId + '"]'
    );
    if (audioElement) {
      console.log("found element", audioElement);
      audioElement.pause();
      (_a = this.LoadedAudios[topicId]) == null ? void 0 : _a.pause();
    } else {
      (_b = this.LoadedAudios[topicId]) == null ? void 0 : _b.pause();
    }
  }
  async loadAndPlayAudio(topicId, autoplay = false, volume = 1) {
    let existingAudioElement = document.querySelector(
      'audio[data-topic-id="' + topicId + '"]'
    );
    if (existingAudioElement) {
      existingAudioElement.volume = volume;
      await existingAudioElement.play();
    } else {
      const audioElement = document.createElement("audio");
      audioElement.volume = volume;
      if (autoplay) {
        audioElement.setAttribute("autoplay", "autoplay");
      }
      audioElement.setAttribute("data-topic-id", topicId);
      audioElement.setAttribute("data-src", "hcs://1/" + topicId);
      document.body.appendChild(audioElement);
      await this.loadMedia(audioElement, "audio");
      existingAudioElement = document.querySelector(
        'audio[data-topic-id="' + topicId + '"]'
      );
      if (!autoplay) {
        await existingAudioElement.play();
      }
    }
  }
}
window.HCS = new HCS();
window.HCS.init().then(() => {
  console.log("All HCS resources loaded");
  if (typeof window.HCSReady === "function") {
    console.log("Running HCSReady...");
    window.HCSReady();
  }
});
const index = window.HCS;
export {
  HCS,
  index as default,
  sleep
};
