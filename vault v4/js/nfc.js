/**
 * NFC Vault NFC Module
 * Handles NFC operations
 */

// Store the global NFC reader instance
let ndefReader = null;

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
        if (ndefReader) {
            await stopNfcScan();
        }
        
        ndefReader = new NDEFReader();
        
        // Set up reading event handler
        ndefReader.addEventListener('reading', readingCallback);
        
        // Set up error handler
        ndefReader.addEventListener('error', (error) => {
            console.error('NFC Error:', error);
            errorCallback(`NFC error: ${error.message || error}`);
        });
        
        // Start scanning
        await ndefReader.scan();
        console.log(`NFC scanning started in ${mode} mode`);
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

// Stop NFC scanning
async function stopNfcScan() {
    if (ndefReader) {
        try {
            // Different browsers may implement different methods to stop scanning
            if (typeof ndefReader.stop === 'function') {
                await ndefReader.stop();
            } else if (typeof ndefReader.stopScan === 'function') {
                await ndefReader.stopScan();
            } else if (typeof ndefReader.close === 'function') {
                await ndefReader.close();
            }
            
            // Clear event listeners
            ndefReader = null;
            return true;
        } catch (error) {
            console.error('Error stopping NFC scan:', error);
            return false;
        }
    }
    return true;
}

// Write records to NFC tag
async function writeNfcTag(records) {
    if (!ndefReader) {
        throw new Error('NFC reader not initialized');
    }
    
    try {
        await ndefReader.write({ records });
        return true;
    } catch (error) {
        console.error('Error writing to NFC tag:', error);
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
function parseVaultTag(message, isWritingMode = false) {
    // If we're in write mode, don't try to parse the tag
    if (isWritingMode) {
        console.log('In write mode, skipping tag parsing');
        return null;
    }

    // Check if we have valid message data
    if (!message || !message.records) {
        console.log('No message or records found');
        return null;
    }
    
    // Check if this looks like a valid vault tag
    // Vault tags should have at least 3 records (URL, metadata, owner)
    if (message.records.length < 3) {
        console.log('Too few records for a vault tag:', message.records.length);
        return null;
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
    
    if (textRecords.length < 2) {
        console.log('Not enough text records for a valid tag');
        return null;
    }
    
    // Find and categorize records
    for (const record of textRecords) {
        // Check if this is a metadata record (has version and iv)
        if (record && typeof record === 'object') {
            if (record.version && record.iv) {
                result.metadata = record;
            } else if (record.t === 'o') {
                // Owner record
                result.owner = record;
            } else if (record.t === 'r') {
                // Reader record
                result.readers.push(record);
            }
        }
    }
    
    // Check if we have the minimum required data
    if (!result.metadata || !result.owner) {
        console.log('Missing metadata or owner information');
        return null;
    }
    
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
    
    return records;
}

// Export the functions
export {
    isNfcSupported,
    startNfcScan,
    stopNfcScan,
    writeNfcTag,
    parseVaultTag,
    prepareTagRecords
};