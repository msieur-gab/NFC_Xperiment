// nfc-core.js - Core NFC infrastructure and scanning operations
import eventBus from './event-bus.js';
import statusDisplay from './status-display.js';
import tagMemoryService from './tag-memory-service.js';

class NFCCore {
    constructor() {
        // State for NFC operation tracking
        this.nfcOperationState = {
            mode: 'IDLE', // Possible values: 'IDLE', 'READING', 'WRITING', 'UPDATING'
            tagData: null, // Store tag data when needed across operations
            ownerToken: null // Store owner token for authenticated operations
        };
        this.ndef = null; // Store the NFC reader instance globally for debug access
        this.lastTagMessage = null; // Store last tag message for memory info updates
    }

    init() {
        // Subscribe to requestNFCPermission events
        document.addEventListener('click', event => {
            if (event.target && event.target.id === 'try-nfc-again-btn') {
                this.requestNFCPermission();
            }
        });
        
        eventBus.publish('log', { message: 'NFC core initialized', type: 'info' });
        
        // Check for NFC support
        if (!('NDEFReader' in window)) {
            eventBus.publish('log', { message: 'NFC not supported on this device', type: 'error' });
            statusDisplay.showStatus("NFC is not supported on this device or browser. Some features may not work.", true);
        } else {
            eventBus.publish('log', { message: 'NFC is supported on this device', type: 'success' });
        }
    }

    // Master NFC handler that handles all NFC operations based on current state
    async startNFCOperation(operation = 'READ', contextData = null) {
        if (!('NDEFReader' in window)) {
            statusDisplay.showStatus("NFC not supported on this device", true);
            eventBus.publish('log', { message: 'NFC not supported on this device', type: 'error' });
            return;
        }

        // Update global state
        this.nfcOperationState.mode = operation;
        if (contextData) {
            if (contextData.tagData) this.nfcOperationState.tagData = contextData.tagData;
            if (contextData.ownerToken) this.nfcOperationState.ownerToken = contextData.ownerToken;
        }
        
        eventBus.publish('log', { message: `Starting NFC operation: ${operation}`, type: 'info' });
        
        // Show scanning animation with appropriate instructions
        const scanningElement = document.getElementById('scanning-animation');
        scanningElement.style.display = 'block';
        
        // Clear any previous writing class
        scanningElement.classList.remove('writing');
        
        if (operation === 'WRITING') {
            document.querySelector('#scanning-animation p').textContent = 'Please bring the NFC tag to the back of your phone to write...';
            statusDisplay.showStatus('<span class="write-mode">WRITE MODE</span> Place tag against your device');
        } else if (operation === 'UPDATING') {
            document.querySelector('#scanning-animation p').textContent = 'Ready to update tag with new readers...';
            statusDisplay.showStatus('<span class="write-mode">UPDATE MODE</span> Place the same tag back against your device');
            // Clear previous operation status
            const statusElement = document.getElementById('tag-operation-status');
            if (statusElement) statusElement.innerHTML = '';
        } else {
            document.querySelector('#scanning-animation p').textContent = 'Waiting for NFC tag...';
            statusDisplay.showStatus('<span class="read-mode">READ MODE</span> Place tag against your device');
        }
        
        try {
            // Stop existing NFC reader if active
            if (this.ndef) {
                await this.safeStopNFC(this.ndef);
            }
            
            // Create new NFC reader
            this.ndef = new NDEFReader();
            
            eventBus.publish('log', { message: 'Created new NDEFReader instance', type: 'info' });
            
            // Set up central NFC tag detection handler
            this.ndef.addEventListener("reading", async ({ message, serialNumber }) => {
                eventBus.publish('log', { message: `Tag detected in ${operation} mode. Serial: ${serialNumber}`, type: 'info' });
                
                // Store the message for memory info display
                this.lastTagMessage = message;
                
                // Broadcast the tag detection event with all relevant info
                eventBus.publish('tagDetected', {
                    message: message,
                    serialNumber: serialNumber,
                    mode: this.nfcOperationState.mode,
                    ndefReader: this.ndef,
                    contextData: {
                        tagData: this.nfcOperationState.tagData,
                        ownerToken: this.nfcOperationState.ownerToken
                    }
                });
            });
            
            // Log error events
            this.ndef.addEventListener("error", (error) => {
                eventBus.publish('log', { message: `NFC error: ${error}`, type: 'error' });
                statusDisplay.showStatus(`NFC error: ${error.message || error}`, true);
            });
            
            // Show permission request message before scanning
            statusDisplay.showStatus('Requesting NFC permission...', false);
            
            // Start scanning
            try {
                await this.ndef.scan();
                eventBus.publish('log', { message: 'NFC scanning started', type: 'info' });
                statusDisplay.showStatus(`<span class="${operation === 'READING' ? 'read-mode' : 'write-mode'}">${operation} MODE</span> Place tag against your device`);
            } catch (scanError) {
                // Handle permission denied specifically
                if (scanError.name === 'NotAllowedError') {
                    document.getElementById('scanning-animation').style.display = 'none';
                    
                    // Show a more helpful error message with instructions
                    const permissionMessage = `
                        <div class="error-notification">
                            <div class="error-icon">!</div>
                            <div class="error-message">
                                <h3>NFC Permission Required</h3>
                                <p>This app needs permission to use your device's NFC reader.</p>
                                <p>Please check:</p>
                                <ul>
                                    <li>NFC is enabled in your device settings</li>
                                    <li>You've allowed this site to use NFC</li>
                                    <li>You're using a supported browser (Chrome for Android)</li>
                                </ul>
                                <button id="try-nfc-again-btn">Try Again</button>
                            </div>
                        </div>
                    `;
                    
                    const statusElement = document.getElementById('status-message');
                    statusElement.innerHTML = permissionMessage;
                    
                    eventBus.publish('log', { message: 'NFC permission denied by user or system', type: 'error' });
                    throw scanError;
                } else {
                    // Re-throw other errors to be caught by the outer catch
                    throw scanError;
                }
            }
            
        } catch (error) {
            document.getElementById('scanning-animation').style.display = 'none';
            
            if (error.name !== 'NotAllowedError') {
                // Only show generic error for non-permission errors (permission has its own UI)
                statusDisplay.showStatus(`Error with NFC: ${error.message || error}`, true);
            }
            
            eventBus.publish('log', { message: `NFC initialization error: ${error}`, type: 'error' });
            // Reset state on error
            this.nfcOperationState.mode = 'IDLE';
        }
    }

    // Function to request NFC permission again
    requestNFCPermission() {
        eventBus.publish('log', { message: 'User requested to try NFC permission again', type: 'info' });
        
        // Clear previous error message
        document.getElementById('status-message').innerHTML = '';
        
        // Try to start NFC operation again
        this.startNFCOperation(this.nfcOperationState.mode || 'READING');
    }

    // Safe NFC reader stop function
    async safeStopNFC(reader) {
        if (!reader) return;
        
        try {
            // Multiple methods to try stopping the NFC reader
            const stopMethods = [
                'stop',         // Standard method
                'stopScan',     // Alternative method
                'close',        // Generic close method
                'abortScan'     // Direct abort method
            ];
            
            let stopped = false;
            
            for (const method of stopMethods) {
                if (typeof reader[method] === 'function') {
                    try {
                        await reader[method]();
                        eventBus.publish('log', { message: `Stopped NFC reader using ${method}()`, type: 'info' });
                        stopped = true;
                        break;
                    } catch (methodError) {
                        eventBus.publish('log', { message: `Error using ${method}(): ${methodError}`, type: 'warning' });
                    }
                }
            }
            
            // If no standard methods work, try an alternative approach
            if (!stopped) {
                // Some browsers might require manually removing event listeners
                if (reader.removeEventListener) {
                    try {
                        // Create empty handlers to avoid reference errors
                        const emptyReadingHandler = () => {};
                        const emptyErrorHandler = () => {};
                        
                        reader.removeEventListener('reading', emptyReadingHandler);
                        reader.removeEventListener('error', emptyErrorHandler);
                        eventBus.publish('log', { message: 'Removed NFC event listeners', type: 'info' });
                    } catch (listenerError) {
                        eventBus.publish('log', { message: `Error removing listeners: ${listenerError}`, type: 'warning' });
                    }
                }
                
                eventBus.publish('log', { message: 'No standard stop method available on this NFC reader', type: 'warning' });
            }
        } catch (error) {
            eventBus.publish('log', { message: `Unexpected error stopping NFC reader: ${error}`, type: 'error' });
        } finally {
            // Always reset the global NFC reader reference
            this.ndef = null;
        }
    }

    // Get current operation state
    getNFCOperationState() {
        return { ...this.nfcOperationState };
    }

    // Reset operation state
    resetOperationState() {
        this.nfcOperationState = {
            mode: 'IDLE',
            tagData: null,
            ownerToken: null
        };
        
        eventBus.publish('log', { message: 'NFC operation state reset', type: 'info' });
    }

    // Check if NFC is supported
    isNFCSupported() {
        return 'NDEFReader' in window;
    }

    // Get last detected tag message
    getLastTagMessage() {
        return this.lastTagMessage;
    }
}

// Create and export a singleton instance
const nfcCore = new NFCCore();
export default nfcCore;
