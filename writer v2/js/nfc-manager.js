// nfc-manager.js - Main NFC module that integrates core and operations
import eventBus from './event-bus.js';
import nfcCore from './nfc-core.js';
import nfcOperations from './nfc-operations.js';

class NFCManager {
    constructor() {
        // This manager just combines the core and operations modules
    }

    init() {
        // Initialize both NFC modules
        nfcCore.init();
        nfcOperations.init();
        
        eventBus.publish('log', { message: 'NFC manager initialized', type: 'info' });
    }
    
    // Check for recovery data from previous failed writes
    checkForRecoveryData() {
        nfcOperations.checkForRecoveryData();
    }
    
    // Expose core methods
    startNFCOperation(operation, contextData) {
        return nfcCore.startNFCOperation(operation, contextData);
    }
    
    // Utility method to check NFC support
    isNFCSupported() {
        return nfcCore.isNFCSupported();
    }
    
    // Method to get last detected tag
    getLastTagMessage() {
        return nfcCore.getLastTagMessage();
    }
}

// Create and export a singleton instance
const nfcManager = new NFCManager();
export default nfcManager;
