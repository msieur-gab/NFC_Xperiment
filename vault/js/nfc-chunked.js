/**
 * NFC Vault Chunked NFC Operations Module
 * Handles NFC operations with size management and chunking for different tag types
 */

import * as NFC from './nfc.js';

// Tag type specifications
const TAG_SPECS = {
    'NTAG213': { size: 144 },  // 144 bytes of user memory
    'NTAG215': { size: 504 },  // 504 bytes of user memory
    'NTAG216': { size: 888 }   // 888 bytes of user memory
};

// Default to NTAG215 for safety if tag type can't be determined
const DEFAULT_TAG_TYPE = 'NTAG215';

// Safety margin for NDEF overhead (header, TLV structures, etc.)
const SAFETY_MARGIN = 40;

// Calculate the approximate size of NDEF records
function calculateRecordsSize(records) {
    let totalSize = 0;
    
    for (const record of records) {
        // Add overhead for NDEF record headers (approximately 4-8 bytes per record)
        totalSize += 8;
        
        if (record.recordType === 'url') {
            totalSize += (new TextEncoder().encode(record.data)).length;
        } else if (record.recordType === 'text') {
            totalSize += (new TextEncoder().encode(record.data)).length;
        }
    }
    
    return totalSize;
}

// Try to detect tag type based on serial number or other characteristics
function detectTagType(serialNumber) {
    // Some manufacturers encode the type in the serial number
    // This is a simplified version and may need adjustment
    if (serialNumber) {
        if (serialNumber.includes('216')) return 'NTAG216';
        if (serialNumber.includes('215')) return 'NTAG215';
        if (serialNumber.includes('213')) return 'NTAG213';
    }
    
    return DEFAULT_TAG_TYPE; // Default to a safer assumption
}

// Get maximum safe write size for a tag type
function getMaxWriteSize(tagType) {
    const spec = TAG_SPECS[tagType] || TAG_SPECS[DEFAULT_TAG_TYPE];
    return spec.size - SAFETY_MARGIN;
}

// Write records to NFC tag with size awareness and chunking if needed
async function writeNfcTagChunked(records, tagType = DEFAULT_TAG_TYPE) {
    if (!NFC.isNfcSupported()) {
        throw new Error('NFC not supported on this device');
    }
    
    // Get maximum safe write size for this tag
    const MAX_CHUNK_SIZE = getMaxWriteSize(tagType);
    
    // Calculate total size
    const totalSize = calculateRecordsSize(records);
    console.log(`Total data size: ${totalSize} bytes, Max size for ${tagType}: ${MAX_CHUNK_SIZE} bytes`);
    
    // If small enough, write in one go
    if (totalSize <= MAX_CHUNK_SIZE) {
        console.log('Writing all data in one operation');
        return await NFC.writeNfcTag(records);
    } else {
        console.log('Data exceeds tag capacity, using chunked writing');
        
        // Split the records into essential and non-essential
        // First 3 records are essential: URL, metadata, owner
        const essentialRecords = records.slice(0, 3);
        const readerRecords = records.slice(3);
        
        const essentialSize = calculateRecordsSize(essentialRecords);
        console.log(`Essential records size: ${essentialSize} bytes`);
        
        if (essentialSize > MAX_CHUNK_SIZE) {
            throw new Error(`Essential data (${essentialSize} bytes) exceeds tag capacity (${MAX_CHUNK_SIZE} bytes)`);
        }
        
        // Calculate how many readers we can fit
        const remainingSpace = MAX_CHUNK_SIZE - essentialSize;
        const readersToWrite = [];
        let currentSize = 0;
        
        for (const reader of readerRecords) {
            const readerSize = calculateRecordsSize([reader]);
            if (currentSize + readerSize <= remainingSpace) {
                readersToWrite.push(reader);
                currentSize += readerSize;
            } else {
                console.warn(`Cannot fit reader on tag, remaining space: ${remainingSpace - currentSize} bytes, needed: ${readerSize} bytes`);
            }
        }
        
        console.log(`Writing ${readersToWrite.length} of ${readerRecords.length} readers`);
        
        // Combine essential records with readers that fit
        const recordsToWrite = [...essentialRecords, ...readersToWrite];
        
        // Write the final set of records
        return await NFC.writeNfcTag(recordsToWrite);
    }
}

// Start NFC scan with tag type detection and chunked writing support
async function startNfcScanWithChunking(readingCallback, errorCallback, mode = 'READ') {
    // Wrap the reading callback to include tag type detection
    const wrappedCallback = async (event) => {
        const { message, serialNumber } = event;
        
        // Detect tag type
        const tagType = detectTagType(serialNumber);
        console.log(`Detected tag type: ${tagType}`);
        
        // Add tag type to the event
        const enhancedEvent = {
            ...event,
            tagType: tagType,
            maxSize: getMaxWriteSize(tagType)
        };
        
        // Call the original callback with enhanced event
        await readingCallback(enhancedEvent);
    };
    
    // Start the scan with our wrapped callback
    return await NFC.startNfcScan(wrappedCallback, errorCallback, mode);
}

// Export the functions
export {
    calculateRecordsSize,
    detectTagType,
    getMaxWriteSize,
    writeNfcTagChunked,
    startNfcScanWithChunking,
    // Re-export basic functions from NFC module
    isNfcSupported: NFC.isNfcSupported,
    stopNfcScan: NFC.stopNfcScan,
    parseVaultTag: NFC.parseVaultTag,
    prepareTagRecords: NFC.prepareTagRecords
};
