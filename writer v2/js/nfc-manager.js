// nfc-manager.js
class NFCManager {
    constructor(eventBus, encryptionService) {
        this.eventBus = eventBus;
        this.encryptionService = encryptionService;
        this.nfcState = {
            mode: 'IDLE',
            tagData: null,
            ndef: null
        };
    }

    async startNFCOperation(operation = 'READ', contextData = null) {
        // Check NFC support
        if (!('NDEFReader' in window)) {
            this.eventBus.emit('status:error', "NFC not supported on this device");
            return;
        }

        // Update state
        this.nfcState.mode = operation;
        if (contextData) {
            this.nfcState.tagData = contextData.tagData;
        }

        // Emit operation start event
        this.eventBus.emit('nfc:operation:start', {
            mode: operation,
            contextData
        });

        try {
            // Create new NFC reader
            this.nfcState.ndef = new NDEFReader();

            // Set up reading event
            this.nfcState.ndef.addEventListener("reading", async (event) => {
                await this.handleNFCTag(event);
            });

            // Set up error event
            this.nfcState.ndef.addEventListener("error", (error) => {
                this.eventBus.emit('status:error', `NFC error: ${error.message}`);
            });

            // Start scanning
            await this.nfcState.ndef.scan();
            this.eventBus.emit('status:info', `Started NFC operation: ${operation}`);
        } catch (error) {
            this.eventBus.emit('status:error', `NFC operation failed: ${error.message}`);
        }
    }

    async handleNFCTag(event) {
        const { message, serialNumber } = event;
        
        switch (this.nfcState.mode) {
            case 'WRITING':
                await this.handleTagWriteMode(this.nfcState.ndef, message, serialNumber);
                break;
            case 'UPDATING':
                await this.handleTagUpdateMode(this.nfcState.ndef, message, serialNumber);
                break;
            default:
                await this.handleTagReadMode(message, serialNumber);
        }
    }

    async handleTagWriteMode(ndef, message, serialNumber) {
        // Implement write mode logic
        this.eventBus.emit('nfc:write', { message, serialNumber });
    }

    async handleTagUpdateMode(ndef, message, serialNumber) {
        // Implement update mode logic
        this.eventBus.emit('nfc:update', { message, serialNumber });
    }

    async handleTagReadMode(message, serialNumber) {
        // Implement read mode logic
        this.eventBus.emit('nfc:read', { message, serialNumber });
    }

    // Additional NFC-related utility methods
    async safeStopNFC() {
        if (!this.nfcState.ndef) return;

        try {
            const stopMethods = ['stop', 'stopScan', 'close', 'abortScan'];
            
            for (const method of stopMethods) {
                if (typeof this.nfcState.ndef[method] === 'function') {
                    try {
                        await this.nfcState.ndef[method]();
                        this.eventBus.emit('status:info', `Stopped NFC reader using ${method}()`);
                        return;
                    } catch (error) {
                        this.eventBus.emit('status:warning', `Error using ${method}(): ${error}`);
                    }
                }
            }
        } catch (error) {
            this.eventBus.emit('status:error', `Unexpected error stopping NFC reader: ${error}`);
        } finally {
            this.nfcState.ndef = null;
        }
    }
}

export default NFCManager;
