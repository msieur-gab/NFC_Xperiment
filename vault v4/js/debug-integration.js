/**
 * Debug Console Integration for NFC Vault
 * This script helps integrate the debug console into your application
 */

// Create and initialize the debug console component
function initializeDebugConsole() {
  // Create the debug console element if it doesn't exist
  let debugConsole = document.querySelector('debug-console');
  if (!debugConsole) {
    debugConsole = document.createElement('debug-console');
    debugConsole.setAttribute('max-logs', '500'); // Store up to 500 logs
    document.body.appendChild(debugConsole);
  }
  
  // Create the FAB button for opening the console
  let fabButton = document.querySelector('.debug-fab');
  if (!fabButton) {
    fabButton = document.createElement('div');
    fabButton.className = 'debug-fab';
    fabButton.innerHTML = '⚙️'; // Gear emoji
    fabButton.title = 'Open Debug Console (Ctrl+`)';
    document.body.appendChild(fabButton);
    
    // Add click event to toggle debug console
    fabButton.addEventListener('click', () => {
      debugConsole.toggleVisibility();
    });
  }
  
  // Create a global helper for logging from anywhere in the app
  window.DebugLogger = {
    log: (...args) => console.log(...args),
    info: (...args) => console.info(...args),
    warn: (...args) => console.warn(...args),
    error: (...args) => console.error(...args),
    debug: (...args) => console.debug(...args),
    clear: () => debugConsole.clear(),
    show: () => debugConsole.toggleVisibility(),
    hide: () => {
      if (debugConsole.isVisible) {
        debugConsole.toggleVisibility();
      }
    }
  };
  
  // Add helper method to log NFC operations specially
  window.DebugLogger.nfc = (message) => {
    console.info(`[NFC] ${message}`);
  };
  
  // Augment each module with debug logging methods
  addDebugLoggingToModules();
  
  console.info('Debug console initialized. Press Ctrl+` or tap the gear icon to toggle.');
}

// Add debug logging methods to app modules
function addDebugLoggingToModules() {
  // Add logging methods to NFC module
  if (window.NFC) {
    const originalStartNfcScan = window.NFC.startNfcScan;
    window.NFC.startNfcScan = function(...args) {
      console.info('[NFC] Starting NFC scan...');
      return originalStartNfcScan.apply(this, args);
    };
    
    const originalStopNfcScan = window.NFC.stopNfcScan;
    window.NFC.stopNfcScan = function(...args) {
      console.info('[NFC] Stopping NFC scan');
      return originalStopNfcScan.apply(this, args);
    };
    
    const originalWriteNfcTag = window.NFC.writeNfcTag;
    window.NFC.writeNfcTag = function(...args) {
      console.info('[NFC] Writing to NFC tag');
      return originalWriteNfcTag.apply(this, args);
    };
  }
  
  // Add logging to Crypto operations
  if (window.Crypto) {
    const originalEncrypt = window.Crypto.encrypt;
    window.Crypto.encrypt = function(...args) {
      console.debug('[Crypto] Encrypting data');
      return originalEncrypt.apply(this, args);
    };
    
    const originalDecrypt = window.Crypto.decrypt;
    window.Crypto.decrypt = function(...args) {
      console.debug('[Crypto] Decrypting data');
      return originalDecrypt.apply(this, args);
    };
  }
}

// Helper function to log errors from event handlers
function logUnhandledErrors() {
  window.addEventListener('error', (event) => {
    console.error('[Unhandled Error]', event.error?.message || event.message, event.error);
  });
  
  window.addEventListener('unhandledrejection', (event) => {
    console.error('[Unhandled Promise Rejection]', event.reason);
  });
}

// Initialize the debug console when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // Check if debug mode is enabled via global variable
  const debugMode = 
    // First check for the global debug variable (set in index.html)
    (typeof window.DEBUG_MODE !== 'undefined' && window.DEBUG_MODE === true) ||
    // Fall back to URL parameter
    (new URLSearchParams(window.location.search).get('debug') === 'true');
  
  // Check if we should initialize debug mode
  if (debugMode) {
    // Load debug console component first
    const debugScript = document.createElement('script');
    debugScript.src = 'components/debug-console.js';
    debugScript.onload = () => {
      // Load integration script after component is loaded
      initializeDebugConsole();
      logUnhandledErrors();
    };
    document.head.appendChild(debugScript);
    
    // Add debug indicator to page title
    document.title = `[DEBUG] ${document.title}`;
  }
});
