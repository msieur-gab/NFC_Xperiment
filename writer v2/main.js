/**
 * main.js
 * Entry point for the NFC Tag Application
 * Initializes and connects all modules
 */

// Import modules
import { AppState, initState } from './js/state.js';
import { debugLog, initDebugMode, injectDebugStyles } from './js/debug.js';
import { 
  initUIListeners, 
  setupTabs, 
  showStatus, 
  switchToCreateNewTagUI, 
  addTagTypeSelector 
} from './js/ui.js';
import { 
  startNFCOperation, 
  initTagsModule, 
  checkForRecoveryData,
  accessTag
} from './js/tags.js';
import { initReadersModule } from './js/readers.js';
import { initStorageModule } from './js/storage.js';

/**
 * Initialize the application
 */
function initApp() {
  debugLog("Starting application initialization...", 'info');

  try {
    // Initialize debug system first to enable logging
    injectDebugStyles();
    initDebugMode();
    debugLog("Debug system initialized", 'info');
    
    // Initialize application state
    initState();
    debugLog("Application state initialized", 'info');
    
    // Initialize UI
    setupTabs();
    initUIListeners();
    debugLog("UI initialized", 'info');
    
    // Initialize modules
    initTagsModule();
    initReadersModule();
    initStorageModule();
    
    // Add tag type selector to advanced settings
    addTagTypeSelector();
    
    // Check for recovery data from previous writes
    checkForRecoveryData();
    
    // Set up custom event handlers
    setupCustomEventHandlers();
    
    // Check for URL parameters
    handleUrlParameters();
    
    // Check for NFC support
    checkNFCSupport();
    
    debugLog("Application initialization complete", 'success');
  } catch (error) {
    console.error("Error during application initialization:", error);
    showStatus("Error initializing application. Please check console for details.", true);
  }
}

/**
 * Set up custom event handlers
 */
function setupCustomEventHandlers() {
  // Add global event handlers for tag operations
  window.accessTag = accessTag;
  
  // Write tag button
  const writeTagButton = document.getElementById('write-tag-button');
  if (writeTagButton) {
    writeTagButton.addEventListener('click', () => {
      debugLog("Write tag button clicked", 'info');
      startNFCOperation('WRITING');
    });
  }
  
  // Read tag button (if any)
  const readTagButton = document.getElementById('read-tag-button');
  if (readTagButton) {
    readTagButton.addEventListener('click', () => {
      debugLog("Read tag button clicked", 'info');
      startNFCOperation('READING');
    });
  }
  
  // Settings changes
  const tokenFormatSelect = document.getElementById('tokenFormat');
  const tokenLengthSelect = document.getElementById('tokenLength');
  
  if (tokenFormatSelect) {
    tokenFormatSelect.addEventListener('change', () => {
      AppState.updateSetting('tokenFormat', tokenFormatSelect.value);
    });
  }
  
  if (tokenLengthSelect) {
    tokenLengthSelect.addEventListener('change', () => {
      AppState.updateSetting('tokenLength', tokenLengthSelect.value);
    });
  }
  
  debugLog("Custom event handlers set up", 'info');
}

/**
 * Process URL parameters for actions
 */
function handleUrlParameters() {
  const urlParams = new URLSearchParams(window.location.search);
  const action = urlParams.get('action');
  
  if (action === 'read') {
    // Auto-start scanning if launched from a tag
    debugLog("Auto-starting scan from URL parameter", 'info');
    startNFCOperation('READING');
  } else {
    // Default to create new tag UI
    switchToCreateNewTagUI();
  }
}

/**
 * Check if NFC is supported on this device
 */
function checkNFCSupport() {
  if (!('NDEFReader' in window)) {
    debugLog("NFC not supported on this device", 'error');
    showStatus("NFC is not supported on this device or browser. Some features may not work.", true);
  } else {
    debugLog("NFC is supported on this device", 'success');
  }
}

// Start the app when the page loads
window.addEventListener('load', initApp);

// Expose central NFC operation function globally
window.startNFCOperation = startNFCOperation;

// Add service worker registration for PWA support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      console.log('ServiceWorker registration successful with scope: ', registration.scope);
    }, err => {
      console.log('ServiceWorker registration failed: ', err);
    });
  });
}
