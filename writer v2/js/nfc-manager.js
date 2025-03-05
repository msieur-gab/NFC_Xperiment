// nfc-manager.js
class NFCManager {
    constructor(eventBus, encryptionService) {
        this.eventBus = eventBus;
        this.encryptionService = encryptionService;
        
        // NFC state tracking
        this.nfcState = {
            mode: 'IDLE',
            tagData: null,
            ndef: null
        };

        // Binding methods to ensure correct context
        this.startNFCOperation = this.startNFCOperation.bind(this);
        this.handleNFCTag = this.handleNFCTag.bind(this);
        this.writeTagData = this.writeTagData.bind(this);
    }

    /**
     * Start NFC operation (read, write, update)
     * @param {string} operation - Type of NFC operation
     * @param {Object} [contextData] - Additional context for the operation
     */
    async startNFCOperation(operation = 'READ', contextData = null) {
        // Check NFC support
        if (!('NDEFReader' in window)) {
            this.eventBus.emit('status:error', "NFC not supported on this device");
            return;
        }

        // Update global state
        this.nfcState.mode = operation.toUpperCase();
        
        // Store additional context if provided
        if (contextData) {
            if (contextData.tagData) this.nfcState.tagData = contextData.tagData;
        }
        
        this.eventBus.emit('status:info', `Starting NFC operation: ${operation}`);
        
        // Show scanning animation
        this.showScanningAnimation(operation);

        try {
            // Stop any existing NFC reader
            if (this.nfcState.ndef) {
                await this.safeStopNFC();
            }
            
            // Create new NFC reader
            this.nfcState.ndef = new NDEFReader();
            
            // Setup reading event handler
            this.nfcState.ndef.addEventListener("reading", this.handleNFCTag);
            
            // Setup error event handler
            this.nfcState.ndef.addEventListener("error", (error) => {
                this.eventBus.emit('status:error', `NFC error: ${error.message}`);
            });
            
            // Start scanning
            await this.nfcState.ndef.scan();
            
            this.eventBus.emit('status:info', `NFC scanning started in ${operation} mode`);
        } catch (error) {
            this.handleNFCError(error);
        }
    }

    /**
     * Handle NFC tag based on current operation mode
     * @param {Object} event - NFC reading event
     */
    async handleNFCTag(event) {
        const { message, serialNumber } = event;
        
        try {
            switch (this.nfcState.mode) {
                case 'WRITING':
                    await this.handleTagWriteMode(this.nfcState.ndef, message, serialNumber);
                    break;
                case 'UPDATING':
                    await this.handleTagUpdateMode(this.nfcState.ndef, message, serialNumber);
                    break;
                default: // 'READING' or other modes
                    await this.handleTagReadMode(message, serialNumber);
            }
        } catch (error) {
            this.eventBus.emit('status:error', `Error handling NFC tag: ${error.message}`);
        }
    }

    /**
     * Write data to NFC tag
     * @param {NDEFWriter} ndef - NFC writer instance
     * @param {Object} [existingMessage] - Existing tag message
     * @param {string} [serialNumber] - Tag serial number
     */
    async writeTagData(ndef) {
        const ownerTokenInput = document.getElementById('ownerToken');
        
        if (!ownerTokenInput) {
            this.eventBus.emit('status:error', 'Owner token input not found');
            return false;
        }

        const ownerToken = ownerTokenInput.value;

        if (!ownerToken) {
            this.eventBus.emit('status:error', 'Owner token is required');
            return false;
        }

        // Get the current URL (without query parameters) to use as the app URL
        const appUrl = window.location.origin + window.location.pathname + "?action=read";

        // Prepare records
        const records = [
            // First record is always the URL
            {
                recordType: "url",
                data: new TextEncoder().encode(appUrl)
            }
        ];

        // Create owner record (encrypted)
        const ownerRecord = this.encryptionService.createEncryptedRecord('owner', {
            id: "owner",
            token: ownerToken
        }, ownerToken);
        records.push(ownerRecord);

        // Get readers and add encrypted reader records
        const readers = document.getElementById('readersList') 
            ? Array.from(document.getElementById('readersList').children).map(readerElement => {
                const idElement = readerElement.querySelector('strong');
                const tokenElement = readerElement.querySelector('.token-display');
                return {
                    id: idElement ? idElement.textContent : '',
                    token: tokenElement ? tokenElement.textContent : ''
                };
            })
            : [];

        // Add reader records
        const readerRecords = readers.map(reader => 
            this.encryptionService.createEncryptedRecord('reader', {
                id: reader.id,
                token: reader.token
            }, ownerToken)
        );
        records.push(...readerRecords);

        try {
            // Attempt to write all records
            await ndef.write({ records });
            
            this.eventBus.emit('status:success', 'Tag successfully written');
            
            // Hide scanning animation
            this.hideScanningAnimation();
            
            return true;
        } catch (error) {
            this.eventBus.emit('status:error', `Error writing to tag: ${error.message}`);
            this.hideScanningAnimation();
            throw error;
        }
    }

    /**
     * Handle tag in write mode
     * @param {NDEFWriter} ndef - NFC writer instance
     * @param {Object} message - Existing tag message
     * @param {string} serialNumber - Tag serial number
     */
    async handleTagWriteMode(ndef, message, serialNumber) {
        try {
            await this.writeTagData(ndef);
        } catch (error) {
            this.eventBus.emit('status:error', `Write mode error: ${error.message}`);
        }
    }

    /**
     * Handle tag in update mode
     * @param {NDEFWriter} ndef - NFC writer instance
     * @param {Object} message - Existing tag message
     * @param {string} serialNumber - Tag serial number
     */
    async handleTagUpdateMode(ndef, message, serialNumber) {
        // TODO: Implement specific update logic if needed
        this.eventBus.emit('status:info', 'Tag update not fully implemented');
    }

    /**
     * Handle tag in read mode
     * @param {Object} message - NFC tag message
     * @param {string} serialNumber - Tag serial number
     */
    async handleTagReadMode(message, serialNumber) {
        this.eventBus.emit('status:info', `Read tag with ${message.records.length} records`);
        // Implement read mode logic
    }

    /**
     * Safely stop NFC reader
     */
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

    /**
     * Show scanning animation based on operation mode
     * @param {string} operation - NFC operation mode
     */
    showScanningAnimation(operation) {
        const scanningElement = document.getElementById('scanning-animation');
        if (!scanningElement) return;

        scanningElement.style.display = 'block';
        scanningElement.classList.remove('writing');

        const textElement = scanningElement.querySelector('p');
        if (!textElement) return;

        switch(operation.toUpperCase()) {
            case 'WRITING':
                scanningElement.classList.add('writing');
                textElement.textContent = 'Bring NFC tag to write...';
                break;
            case 'UPDATING':
                textElement.textContent = 'Bring NFC tag to update...';
                break;
            default:
                textElement.textContent = 'Tap your NFC tag...';
        }
    }

    /**
     * Hide scanning animation
     */
    hideScanningAnimation() {
        const scanningElement = document.getElementById('scanning-animation');
        if (scanningElement) {
            scanningElement.style.display = 'none';
        }
    }

    /**
     * Handle NFC initialization errors
     * @param {Error} error - Error object
     */
    handleNFCError(error) {
        if (error.name === 'NotAllowedError') {
            this.eventBus.emit('status:error', 'NFC permission denied. Check browser settings.');
        } else {
            this.eventBus.emit('status:error', `NFC initialization error: ${error.message}`);
        }
        
        // Hide scanning animation
        this.hideScanningAnimation();
    }
}

export default NFCManager;
