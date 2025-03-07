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
        // Stop any existing scan
        if (ndefReader) {
            try {
                await stopNfcScan();
            } catch (stopError) {
                console.warn('Error stopping previous NFC scan:', stopError);
            }
        }
        
        // Create a new reader
        ndefReader = new NDEFReader();
        
        // Modify reading event handler to check current mode
        const wrappedReadingCallback = (event) => {
            // If in writing mode, ignore read events
            if (mode === 'WRITE') {
                console.log('Ignoring read event during write mode');
                return;
            }
            
            // Call original reading callback for read mode
            readingCallback(event);
        };
        
        // Set up reading event handler
        ndefReader.addEventListener('reading', wrappedReadingCallback);
        
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
            
            // Clear event listeners and reset reader
            ndefReader = null;
            return true;
        } catch (error) {
            console.error('Error stopping NFC scan:', error);
            // Force reset the reader
            ndefReader = null;
            return false;
        }
    }
    return true;
}

// Write records to NFC tag
async function writeNfcTag(records) {
    // Validate records
    if (!records || records.length < 3) {
        throw new Error('Insufficient records for NFC tag writing');
    }

    // Ensure NFC reader is initialized
    if (!ndefReader) {
        try {
            ndefReader = new NDEFReader();
            console.log('NFC reader reinitialized');
        } catch (initError) {
            console.error('Failed to initialize NFC reader:', initError);
            throw new Error(`NFC reader initialization failed: ${initError.message}`);
        }
    }
    
    try {
        // Write records to tag
        await ndefReader.write({ records });
        console.log('Records successfully written to tag');
        
        return true;
    } catch (error) {
        console.error('Detailed Write Tag Error:', {
            name: error.name,
            message: error.message,
            stack: error.stack
        });
        
        // More specific error handling
        if (error.name === 'NotAllowedError') {
            throw new Error('NFC permission denied. Check device settings.');
        } else if (error.name === 'NotSupportedError') {
            throw new Error('NFC writing not supported on this device.');
        } else if (error.name === 'NetworkError') {
            throw new Error('NFC write failed: Unable to communicate with the tag.');
        } else {
            throw new Error(`NFC write failed: ${error.message}`);
        }
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
// Parse NFC data structure from message
function parseVaultTag(message, isWritingMode = false) {
    console.log('Parsing Vault Tag - Writing Mode:', isWritingMode);
    
    // If we're in write mode, always return null to allow writing
    if (isWritingMode === true) {
        console.log('In write mode, allowing tag writing');
        return null;
    }

    // If no message or no records, consider it a new/blank tag
    if (!message || !message.records || message.records.length === 0) {
        console.log('Blank or empty NFC tag detected');
        return null;
    }

    // Minimum number of records needed for a valid vault tag
    if (message.records.length < 3) {
        console.log('Not enough records (need at least 3)');
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
    console.log('Extracted Service URL:', result.serviceUrl);
    
    // Extract text records
    const textRecords = extractTextRecords(message);
    console.log('Extracted Text Records:', textRecords);
    
    // Find and categorize records
    for (const record of textRecords) {
        console.log('Processing record:', record);
        
        if (record.version && record.iv) {
            result.metadata = record;
            console.log('Metadata found:', result.metadata);
        } else if (record.t === 'o') {
            result.owner = record;
            console.log('Owner record found:', result.owner);
        } else if (record.t === 'r') {
            result.readers.push(record);
            console.log('Reader record found:', record);
        }
    }
    
    // Check if we have the minimum required data
    if (!result.metadata || !result.owner) {
        console.log('Missing metadata or owner record');
        return null;
    }
    
    console.log('Final parsed result:', result);
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