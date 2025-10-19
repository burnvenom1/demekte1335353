// index.js
const { chromium } = require('playwright');
const { randomUUID } = require('crypto');

// CONFIG
const headlessMode = (process.env.HEADLESS || 'true') === 'true';
const emailToSend = process.env.EMAIL_TO_SEND || 'deneme@example.com';

// 1. Session seed
const sessionSeed = randomUUID().slice(0,8);

// 2. User-Agent
const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// --- Spoofing functions ---
function getWebGLSpoofScript(sessionSeed) {
  const gpuPairs = [
    { vendor: 'Intel Inc.', renderers: [
        'Intel Iris Xe Graphics',
        'Intel UHD Graphics 770',
        'Intel Iris Plus Graphics 655'
      ]},
    { vendor: 'NVIDIA Corporation', renderers: [
        'NVIDIA GeForce RTX 4050/PCIe/SSE2',
        'NVIDIA GeForce RTX 4090/PCIe/SSE2',
        'NVIDIA GeForce RTX 4080/PCIe/SSE2',
        'NVIDIA GeForce RTX 4070 Ti/PCIe/SSE2'
      ]},
    { vendor: 'AMD', renderers: [
        'AMD Radeon RX 7900 XT',
        'AMD Radeon RX 6800 XT',
        'AMD Radeon RX Vega 11'
      ]},
    { vendor: 'Google Inc.', renderers: [
        'ANGLE (Google Inc., Vulkan 1.3, Vulkan)'
      ]}
  ];

  return `
    (() => {
      const gpuPairs = ${JSON.stringify(gpuPairs)};
      function hashStr(s) {
        let h = 0;
        for (let i = 0; i < s.length; i++) {
          h = ((h << 5) - h) + s.charCodeAt(i);
          h |= 0;
        }
        return Math.abs(h);
      }
      const baseHash = hashStr('${sessionSeed}');
      const vendorIndex = baseHash % gpuPairs.length;
      const vendor = gpuPairs[vendorIndex].vendor;
      const renderers = gpuPairs[vendorIndex].renderers;
      const renderer = renderers[(baseHash >> 3) % renderers.length];

      const getParam = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(param) {
        if (param === 37445) return vendor;   // UNMASKED_VENDOR_WEBGL
        if (param === 37446) return renderer; // UNMASKED_RENDERER_WEBGL
        return getParam.call(this, param);
      };
    })();
  `;
}

function getCanvasSpoofScript(sessionSeed) {
  return `
    (() => {
      const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
      const domain = location.hostname;
      const sessionSeed = '${sessionSeed}';

      function hashStr(s) {
        let h = 0;
        for (let i = 0; i < s.length; i++) {
          h = ((h << 5) - h) + s.charCodeAt(i);
          h |= 0;
        }
        return h;
      }

      const baseHash = hashStr(domain + sessionSeed);
      const r = Math.abs((baseHash >> 16) & 255);
      const g = Math.abs((baseHash >> 8) & 255);
      const b = Math.abs(baseHash & 255);

      HTMLCanvasElement.prototype.toDataURL = function(type) {
        const canvas = document.createElement('canvas');
        canvas.width = this.width;
        canvas.height = this.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(this, 0, 0);
        ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ', 0.03)';
        ctx.fillRect(0, 0, 1, 1);
        return originalToDataURL.call(canvas, type);
      };
    })();
  `;
}

function getAudioContextSpoofScript(sessionSeed) {
  return `
    (() => {
      const domain = location.hostname;
      const sessionSeed = '${sessionSeed}';

      function hashStr(s) {
        let h = 0;
        for (let i = 0; i < s.length; i++) {
          h = ((h << 5) - h) + s.charCodeAt(i);
          h |= 0;
        }
        return Math.abs(h);
      }

      const baseHash = hashStr(domain + sessionSeed);
      function noise(i) {
        return ((baseHash >> (i % 24)) & 15) * 1e-5;
      }

      const originalGetChannelData = AudioBuffer.prototype.getChannelData;
      AudioBuffer.prototype.getChannelData = function() {
        const data = originalGetChannelData.apply(this, arguments);
        for (let i = 0; i < data.length; i += 100) {
          data[i] = data[i] + noise(i);
        }
        return data;
      };

      const originalCreateAnalyser = AudioContext.prototype.createAnalyser;
      AudioContext.prototype.createAnalyser = function() {
        const analyser = originalCreateAnalyser.apply(this, arguments);

        const originalGetFloatFrequencyData = analyser.getFloatFrequencyData;
        analyser.getFloatFrequencyData = function(array) {
          originalGetFloatFrequencyData.call(this, array);
          for (let i = 0; i < array.length; i++) {
            array[i] = array[i] + noise(i);
          }
        };

        const originalGetByteFrequencyData = analyser.getByteFrequencyData;
        analyser.getByteFrequencyData = function(array) {
          originalGetByteFrequencyData.call(this, array);
          for (let i = 0; i < array.length; i++) {
            array[i] = array[i] + noise(i);
          }
        };

        return analyser;
      };

      const originalOscillatorStart = OscillatorNode.prototype.start;
      OscillatorNode.prototype.start = function() {
        try {
          const originalFrequency = this.frequency.value;
          this.frequency.value = originalFrequency + noise(0) * 1e5;
        } catch (e) {}
        originalOscillatorStart.apply(this, arguments);
      };
    })();
  `;
}

function getHardwareInfoSpoofScript(sessionSeed) {
  const platforms = ['Win32', 'Linux x86_64', 'MacIntel', 'Win64', 'Linux aarch64'];
  const concurrencies = [4, 8];
  const memories = [4, 8, 16];

  return `
    (() => {
      const platforms = ${JSON.stringify(platforms)};
      const concurrencies = ${JSON.stringify(concurrencies)};
      const memories = ${JSON.stringify(memories)};
      const domain = location.hostname;

      function hashStr(s) {
        let h = 0;
        for (let i = 0; i < s.length; i++) {
          h = ((h << 5) - h) + s.charCodeAt(i);
          h |= 0;
        }
        return Math.abs(h);
      }

      const baseHashDomain = hashStr(domain + '${sessionSeed}');
      const baseHashSession = hashStr('${sessionSeed}');

      Object.defineProperty(navigator, 'platform', {
        get: () => platforms[baseHashDomain % platforms.length],
        configurable: true
      });

      Object.defineProperty(navigator, 'hardwareConcurrency', {
        get: () => concurrencies[baseHashDomain % concurrencies.length],
        configurable: true
      });

      Object.defineProperty(navigator, 'deviceMemory', {
        get: () => memories[baseHashSession % memories.length],
        configurable: true
      });

      Object.defineProperty(window, 'chrome', {
        get: () => ({ runtime: {} }),
        configurable: true
      });
    })();
  `;
}

function getWebdriverSpoofScript() {
  return `
    (() => {
      const originalGetter = Object.getOwnPropertyDescriptor(Navigator.prototype, 'webdriver')?.get;
      Object.defineProperty(Navigator.prototype, 'webdriver', {
        get: function() { return false; },
        configurable: true
      });
    })();
  `;
}

function getPluginAndPermissionsSpoofScript() {
  return `
    (() => {
      const fakePlugins = [
        {
          name: 'Chrome PDF Plugin',
          filename: 'internal-pdf-viewer',
          description: 'PDF Görüntüleyici',
          version: '1.0.0'
        },
        {
          name: 'Chrome PDF Viewer',
          filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',
          description: '',
          version: ''
        },
        {
          name: 'Native Client',
          filename: 'internal-nacl-plugin',
          description: '',
          version: ''
        }
      ];

      const fakePluginsProto = Object.create(PluginArray.prototype);
      fakePluginsProto.push = Array.prototype.push;
      fakePlugins.__proto__ = fakePluginsProto;
      fakePlugins.item = function(index) { return this[index] || null; };
      fakePlugins.namedItem = function(name) {
        return this.find(plugin => plugin.name === name) || null;
      };
      fakePlugins.refresh = function() {};

      Object.defineProperty(navigator, 'plugins', {
        get: () => fakePlugins,
        configurable: true,
        enumerable: true
      });

      Object.defineProperty(navigator, 'permissions', {
        get: () => ({
          query: () => Promise.resolve({ state: 'granted', onchange: null }),
          __proto__: Permissions.prototype
        }),
        configurable: true,
        enumerable: true
      });

      const fakeMimeTypes = [
        {
          type: 'application/pdf',
          suffixes: 'pdf',
          description: '',
          enabledPlugin: fakePlugins[0]
        }
      ];

      fakeMimeTypes.__proto__ = MimeTypeArray.prototype;
      fakeMimeTypes.item = function(index) { return this[index] || null; };
      fakeMimeTypes.namedItem = function(name) {
        return this.find(mime => mime.type === name) || null;
      };

      Object.defineProperty(navigator, 'mimeTypes', {
        get: () => fakeMimeTypes,
        configurable: true,
        enumerable: true
      });
    })();
  `;
}

// --- Main runner ---
(async () => {
  let browser;
  try {
    const launchOptions = {
      headless: headlessMode,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--lang=tr-TR',
        '--disable-web-security',
        '--disable-extensions',
        '--disable-popup-blocking',
        '--disable-infobars',
        `--window-size=1280,720`
      ]
    };

    // If you want to use system Chrome, uncomment and set path:
    // launchOptions.executablePath = '/usr/bin/google-chrome';

    browser = await chromium.launch(launchOptions);

    const context = await browser.newContext({
      userAgent,
      locale: 'tr-TR',
      timezoneId: 'Europe/Istanbul',
      viewport: { width: 1280, height: 720 },
      permissions: [],
      geolocation: { latitude: 41.0082, longitude: 28.9784 }
    });

    const page = await context.newPage();

    // add init scripts
    await page.addInitScript(getWebGLSpoofScript(sessionSeed));
    await page.addInitScript(getHardwareInfoSpoofScript(sessionSeed));
    await page.addInitScript(getWebdriverSpoofScript());
    await page.addInitScript(getCanvasSpoofScript(sessionSeed));
    await page.addInitScript(getAudioContextSpoofScript(sessionSeed));
    await page.addInitScript(getPluginAndPermissionsSpoofScript());

    // go to target URL
    const target = 'https://giris.hepsiburada.com/?ReturnUrl=https%3A%2F%2Foauth.hepsiburada.com%2Fconnect%2Fauthorize%2Fcallback%3Fclient_id%3DSPA%26redirect_uri%3Dhttps%253A%252F%252Fwww.hepsiburada.com%252Fuyelik%252Fcallback%26response_type%3Dcode%26scope%3Dopenid%2520profile%26state%3Df883eaadc71d42c8bfe3aa90bc07585a%26code_challenge%3DI4Ihs_2x7BPCMgYoGd7YrazWUqIYgxTzIGMQVovpJfg%26code_challenge_method%3DS256%26response_mode%3Dquery%26customizeSegment%3DORDERS%26ActivePage%3DPURE_LOGIN%26oidcReturnUrl%3D%252Fsiparislerim';

    await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // example: fill email and click submit — selectors may need adjustment for the real page
    try {
      await page.fill('input[type="email"], input[name="email"], input[id*="email"]', emailToSend);
      await page.click('button[type="submit"], button[id*="login"], button[class*="submit"]');
    } catch (e) {
      console.log('Form alanı bulunamadı veya gönderme başarısız:', e.message);
    }

    // screenshot for debugging
    await page.screenshot({ path: `hepsiburada_${sessionSeed}.png`, fullPage: false });

    await browser.close();
    console.log('Done');
  } catch (err) {
    console.error('Error:', err);
    if (browser) await browser.close();
    process.exit(1);
  }
})();
