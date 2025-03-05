// app.js - Main application initializer
import eventBus from './event-bus.js';
import debugPanel from './debug-panel.js';
import tabManager from './tab-manager.js';
import nfcManager from './nfc-manager.js';
import encryptionService from './encryption-service.js';
import readerManager from './reader-manager.js';
import statusDisplay from './status-display.js';
import uiManager from './ui-manager.js';
import settingsManager from './settings-manager.js';
import tagMemoryService from './tag-memory-service.js';

// Main initialization function
function initApp() {
    // Initialize all modules in dependency order
    debugPanel.init();
    eventBus.publish('log', { message: "Initializing app...", type: 'info' });
    
    // Core services
    encryptionService.init();
    statusDisplay.init();
    tabManager.init();
    
    // UI and feature managers
    uiManager.init();
    settingsManager.init();
    tagMemoryService.init();
    readerManager.init();
    
    // NFC operations - initialize last as it may need other services
    nfcManager.init();
    
    // Check for recovery data from previous failed writes
    nfcManager.checkForRecoveryData();
    
    // Default to create new tag UI initially
    uiManager.switchToCreateNewTagUI();
    
    eventBus.publish('log', { message: "App initialization complete", type: 'success' });
}

// Start the application when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', initApp);

// This allows access to event bus for debugging (via console)
window._eventBus = eventBus;
