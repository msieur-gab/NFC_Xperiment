/**
 * NFC Vault NFC Module
 * Handles NFC operations
 */

// Store the global NFC reader instance
let ndefReader = null;
let currentScanMode = null;

// Check if NFC is supported on the device
function isNfcSupported() {
    return 'NDEFReader' in window;
}

// Start NFC scanning
async function startNfcScan(readingCallback, errorCallback, mode = 'READ') {
    if (!isNfcSupported()) {
        errorCallback('NFC not supported on this device or browser');
        return false;
    }
    
    try {
        // Always stop any existing scan first
        if (ndefReader) {
            try {
                await stopNfcScan();
                // Wait a moment for cleanup
                await new Promise(resolve => setTimeout(resolve, 300));
            } catch (e) {
                console.log('Error stopping previous NFC scan:', e);
            }
        }
        
        // Store the current scan mode
        currentScanMode = mode;
        console.log(`Starting NFC scan in ${mode} mode`);
        
        // Create a new reader
        ndefReader = new NDEFReader();
        
        // Set up reading event handler with proper mode check
        ndefReader.addEventListener('reading', (event) => {
            // Only process if we're in the right mode
            if (currentScanMode === mode) {
                readingCallback(event);
            } else {
                console.log(`Ignoring NFC event - current mode ${currentScanMode} doesn't match required mode ${mode}`);
            }
        });
        
        // Set up error handler
        ndefReader.addEventListener('error', (error) => {
            console.error('NFC Error:', error);
            errorCallback(`NFC error: ${error.message || error}`);
        });
        
        // Start scanning
        await ndefReader.scan();
        console.log('NFC scanning started');
        return true;
    } catch (error) {
        console.error('Error starting NFC scan:', error);
        if (error.name === 'NotAllowedError') {
            errorCallback('NFC permission denied. Make sure NFC is enabled in your device settings.');
        } else if (error.name === 'NotSupportedError') {
            errorCallback('NFC not supported by this device or browser.');
        } else {
            errorCallback(`Error starting NFC: ${error.message || error}`);
        }
        return false;
    }
}

// Stop NFC scanning (fixed version)
async function stopNfcScan() {
    if (ndefReader) {
        try {
            // Different browsers may implement different methods to stop scanning
            if (typeof ndefReader.stop === 'function') {
                try {
                    await ndefReader.stop();
                } catch (e) {
                    console.log('Error calling ndefReader.stop():', e);
                }
            } else if (typeof ndefReader.stopScan === 'function') {
                try {
                    await ndefReader.stopScan();
                } catch (e) {
                    console.log('Error calling ndefReader.stopScan():', e);
                }
            } else if (typeof ndefReader.close === 'function') {
                try {
                    await ndefReader.close();
                } catch (e) {
                    console.log('Error calling ndefReader.close():', e);
                }
            }
        } catch (error) {
            console.error('Error stopping NFC scan:', error);
        } finally {
            // Always clear the reader reference and mode to prevent stale state
            ndefReader = null;
            currentScanMode = null;
            console.log('NFC reader reference cleared');
        }
        return true;
    }
    console.log('No active NFC scan to stop');
    return true;
}

// Write records to NFC tag
async function writeNfcTag(records) {
    if (!ndefReader) {
        throw new Error('NFC reader not initialized');
    }
    
    try {
        console.log('Writing records to NFC tag...');
        await ndefReader.write({ records });
        console.log('Successfully wrote to NFC tag');
        return true;
    } catch (error) {
        console.error('Error writing to NFC tag:', error);
        // Provide more detailed error info
        let errorInfo = {
            message: error.message || 'Unknown error',
            name: error.name,
            code: error.code
        };
        console.error('Write error details:', errorInfo);
        throw error;
    }
}

// Extract all text records from NDEF message
function extractTextRecords(message) {
    if (!message || !message.records) {
        return [];
    }
    
    const textRecords = [];
    
    for (const record of message.records) {
        if (record.recordType === 'text') {
            try {
                const textDecoder = new TextDecoder();
                const text = textDecoder.decode(record.data);
                try {
                    // Try to parse as JSON
                    const data = JSON.parse(text);
                    textRecords.push(data);
                } catch (e) {
                    // If not valid JSON, add as string
                    textRecords.push(text);
                }
            } catch (e) {
                console.error('Error decoding text record:', e);
            }
        }
    }
    
    return textRecords;
}

// Extract URL from NDEF message
function extractUrl(message) {
    if (!message || !message.records) {
        return null;
    }
    
    for (const record of message.records) {
        if (record.recordType === 'url') {
            try {
                const textDecoder = new TextDecoder();
                return textDecoder.decode(record.data);
            } catch (e) {
                console.error('Error decoding URL record:', e);
            }
        }
    }
    
    return null;
}

// Parse NFC data structure from message
function parseVaultTag(message) {
    if (!message || !message.records || message.records.length < 3) {
        return null; // Need at least URL, metadata, and owner
    }
    
    const result = {
        serviceUrl: null,
        metadata: null,
        owner: null,
        readers: []
    };
    
    // Extract service URL
    result.serviceUrl = extractUrl(message);
    
    // Extract text records
    const textRecords = extractTextRecords(message);
    
    // Find and categorize records
    for (const record of textRecords) {
        if (record.version && record.iv) {
            result.metadata = record;
        } else if (record.t === 'o') {
            result.owner = record;
        } else if (record.t === 'r') {
            result.readers.push(record);
        }
    }
    
    // Check if we have the minimum required data
    if (!result.metadata || !result.owner) {
        console.log('Failed to parse vault tag: missing metadata or owner record');
        return null;
    }
    
    console.log('Successfully parsed vault tag');
    return result;
}

// Prepare tag records for writing
function prepareTagRecords(tagData) {
    const records = [];
    
    // First record: Service URL
    records.push({
        recordType: 'url',
        data: tagData.serviceUrl
    });
    
    // Second record: Metadata with version and IV
    records.push({
        recordType: 'text',
        data: JSON.stringify(tagData.metadata)
    });
    
    // Third record: Owner data
    records.push({
        recordType: 'text',
        data: JSON.stringify(tagData.owner)
    });
    
    // Additional records: Reader data (one per reader)
    for (const reader of tagData.readers) {
        records.push({
            recordType: 'text',
            data: JSON.stringify(reader)
        });
    }
    
    console.log(`Prepared ${records.length} records for writing`);
    return records;
}

// Get the current scan mode
function getCurrentScanMode() {
    return currentScanMode;
}

// Check if a scan is currently active
function isScanActive() {
    return ndefReader !== null;
}

// Export the functions
export {
    isNfcSupported,
    startNfcScan,
    stopNfcScan,
    writeNfcTag,
    parseVaultTag,
    prepareTagRecords,
    getCurrentScanMode,
    isScanActive
};