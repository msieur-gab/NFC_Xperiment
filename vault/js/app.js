/**
 * NFC Vault Main Application
 * The main controller that integrates all modules
 */

// Import modules
import * as Crypto from './crypto.js';
import * as NFC from './nfc.js';
import * as UI from './ui.js';

// State variables
let readers = [];
let currentNfcOperation = 'IDLE'; // IDLE, READING, WRITING, UPDATING
let currentTagData = null;

// DOM Elements
const elements = {};

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    // Set up UI elements
    initializeElements();
    
    // Set up event listeners
    setupEventListeners();
    
    // Set up tabs
    UI.setupTabs();
    
    // Check NFC support
    checkNfcSupport();
});

// Initialize element references
function initializeElements() {
    // Create tab elements
    elements.ownerKey = document.getElementById('ownerKey');
    elements.ownerPin = document.getElementById('ownerPin');
    elements.managePin = document.getElementById('managePin');
    elements.accessKey = document.getElementById('accessKey');
    elements.tagPreview = document.getElementById('tagPreview');
    elements.manageContent = document.getElementById('manage-content');
    elements.writeTagButton = document.getElementById('write-tag-button');
}

// Set up event listeners
function setupEventListeners() {
    // Generate buttons
    document.getElementById('generate-owner-key').addEventListener('click', generateOwnerKey);
    document.getElementById('generate-pin').addEventListener('click', generatePin);
    
    // Reader management buttons
    document.getElementById('add-reader').addEventListener('click', addReader);
    document.getElementById('add-reader-to-tag').addEventListener('click', addReaderToExistingTag);
    
    // Tag operation buttons
    document.getElementById('write-tag-button').addEventListener('click', startNFCWrite);
    document.getElementById('show-preview').addEventListener('click', showTagPreview);
    document.getElementById('scan-for-manage').addEventListener('click', scanTagForManage);
    document.getElementById('access-tag-button').addEventListener('click', accessTag);
    document.getElementById('update-tag-button').addEventListener('click', updateTag);
}

// Check if NFC is supported on this device
function checkNfcSupport() {
    const supported = NFC.isNfcSupported();
    
    if (!supported) {
        UI.showStatus("NFC is not supported on this device or browser. Some features may not work.", true);
        if (elements.writeTagButton) elements.writeTagButton.disabled = true;
    }
    
    return supported;
}

// Generate random owner key
function generateOwnerKey() {
    elements.ownerKey.value = Crypto.generateReadableKey(12);
}

// Generate random PIN
function generatePin() {
    elements.ownerPin.value = Crypto.generateRandomPin();
}

// Add a new reader
function addReader() {
    const readerId = prompt("Enter Reader ID:");
    if (!readerId || readerId.trim() === '') return;
    
    // Check if reader ID already exists
    if (readers.some(r => r.id === readerId)) {
        UI.showStatus(`Reader "${readerId}" already exists`, true);
        return;
    }
    
    // Ask if they want to generate or enter a key
    const generateOrEnter = confirm("Click OK to auto-generate a key, or Cancel to enter manually");
    
    let readerKey;
    if (generateOrEnter) {
        readerKey = Crypto.generateReadableKey(8);
    } else {
        readerKey = prompt("Enter Reader Key:");
        if (!readerKey || readerKey.trim() === '') return;
    }
    
    readers.push({ id: readerId, key: readerKey });
    UI.updateReadersList(readers, 'readersList', removeReader);
    UI.showStatus(`Reader "${readerId}" added`);
}

// Remove a reader
function removeReader(index) {
    const confirmRemove = confirm(`Remove reader "${readers[index].id}"?`);
    if (confirmRemove) {
        readers.splice(index, 1);
        UI.updateReadersList(readers, 'readersList', removeReader);
        UI.showStatus('Reader removed');
    }
}

// Show tag data preview
function showTagPreview() {
    const ownerKey = elements.ownerKey.value;
    const ownerPin = elements.ownerPin.value;

    if (!ownerKey || !ownerPin) {
        UI.showStatus('Owner key and PIN are required', true);
        return;
    }

    if (readers.length === 0) {
        UI.showStatus('Please add at least one reader', true);
        return;
    }

    // Generate a sample tag structure
    const tagData = prepareTagDataStructure(ownerKey, ownerPin);
    
    // Show preview
    UI.showTagPreview(tagData, ownerKey, ownerPin, readers);
}

// Prepare tag data structure with encryption
async function prepareTagDataStructure(ownerKey, ownerPin) {
    // Generate a random IV for AES-GCM
    const iv = Crypto.generateIV();
    const ivBase64 = Crypto.arrayBufferToBase64(iv);
    
    // Get the current URL to use as the service URL
    const serviceUrl = window.location.origin + window.location.pathname;
    
    // Prepare metadata record
    const metadataRecord = {
        version: "1.0",
        iv: ivBase64
    };
    
    // Derive key from PIN
    const { derivedKey } = await Crypto.deriveKey(ownerPin);
    
    // Encrypt owner data
    const encryptedOwnerKey = await Crypto.encrypt(ownerKey, derivedKey, iv);
    
    // Create owner record
    const ownerRecord = {
        t: "o", // type: owner
        id: "owner",
        k: encryptedOwnerKey
    };
    
    // Encrypt reader data
    const readerRecords = [];
    
    for (const reader of readers) {
        const encryptedReaderKey = await Crypto.encrypt(reader.key, derivedKey, iv);
        
        readerRecords.push({
            t: "r", // type: reader
            id: reader.id,
            k: encryptedReaderKey
        });
    }
    
    // Create the complete structure
    return {
        serviceUrl: serviceUrl,
        metadata: metadataRecord,
        owner: ownerRecord,
        readers: readerRecords
    };
}

// Start NFC write operation
async function startNFCWrite() {
    if (!checkNfcSupport()) return;
    
    const ownerKey = elements.ownerKey.value;
    const ownerPin = elements.ownerPin.value;
    
    if (!ownerKey || !ownerPin) {
        UI.showStatus('Owner key and PIN are required', true);
        return;
    }
    
    if (readers.length === 0) {
        UI.showStatus('Please add at least one reader', true);
        return;
    }
    
    // Prepare tag data
    const tagData = await prepareTagDataStructure(ownerKey, ownerPin);
    
    // Prepare records for writing
    const records = NFC.prepareTagRecords(tagData);
    
    // Start NFC operation
    currentNfcOperation = 'WRITING';
    
    // Show scanning animation
    UI.showScanningAnimation(true, 'Writing to NFC tag...');
    UI.showStatus('Please bring the NFC tag to the back of your device to write data');
    
    // Start NFC scanning
    await NFC.startNfcScan(
        async ({ message, serialNumber }) => {
            console.log(`Tag detected for writing. Serial: ${serialNumber}`);
            
            try {
                // Write records to tag
                await NFC.writeNfcTag(records);
                
                // Hide scanning animation
                UI.hideScanningAnimation();
                
                // Show success message
                UI.showStatus('Tag successfully written!');
                
                // Stop scanning
                await NFC.stopNfcScan();
                
                // Reset operation state
                currentNfcOperation = 'IDLE';
            } catch (error) {
                UI.hideScanningAnimation();
                UI.showStatus(`Error writing to tag: ${error.message || error}`, true);
                console.error(`Write Error:`, error);
                currentNfcOperation = 'IDLE';
                await NFC.stopNfcScan();
            }
        },
        (error) => {
            UI.hideScanningAnimation();
            UI.showStatus(error, true);
            currentNfcOperation = 'IDLE';
        }
    );
}

// Scan tag for management
async function scanTagForManage() {
    const pin = elements.managePin.value;
    
    if (!pin) {
        UI.showStatus('Owner PIN is required', true);
        return;
    }
    
    currentNfcOperation = 'READING_FOR_MANAGE';
    
    // Show scanning animation
    UI.showScanningAnimation(false, 'Scanning for NFC tag...');
    UI.showStatus('Please bring the NFC tag to the back of your device');
    
    // Start NFC scanning
    await NFC.startNfcScan(
        async ({ message, serialNumber }) => {
            console.log(`Tag detected for management. Serial: ${serialNumber}`);
            
            try {
                // Parse tag data
                const tagData = NFC.parseVaultTag(message);
                
                if (!tagData) {
                    throw new Error("Not a valid NFC Vault tag");
                }
                
                // Get metadata and IV
                const ivBase64 = tagData.metadata.iv;
                const iv = Crypto.base64ToArrayBuffer(ivBase64);
                
                // Derive key from PIN
                const { derivedKey } = await Crypto.deriveKey(pin);
                
                // Try to decrypt owner key
                const ownerKey = await Crypto.decrypt(tagData.owner.k, derivedKey, iv);
                
                if (!ownerKey) {
                    throw new Error("Invalid PIN - cannot decrypt tag");
                }
                
                // Decrypt all reader keys
                const decryptedReaders = [];
                
                for (const record of tagData.readers) {
                    const readerKey = await Crypto.decrypt(record.k, derivedKey, iv);
                    
                    if (readerKey) {
                        decryptedReaders.push({
                            id: record.id,
                            key: readerKey
                        });
                    }
                }
                
                // Store current readers and tag data
                readers = decryptedReaders;
                currentTagData = tagData;
                
                // Update UI
                UI.showManageContent(ownerKey, readers, removeReaderFromTag);
                UI.hideScanningAnimation();
                UI.showStatus("Tag successfully decrypted and loaded");
                
                // Stop scanning
                await NFC.stopNfcScan();
                
                // Reset operation state
                currentNfcOperation = 'IDLE';
                
            } catch (error) {
                UI.hideScanningAnimation();
                UI.showStatus(`Error: ${error.message || error}`, true);
                UI.hideManageContent();
                console.error(`Read Error:`, error);
                currentNfcOperation = 'IDLE';
                await NFC.stopNfcScan();
            }
        },
        (error) => {
            UI.hideScanningAnimation();
            UI.showStatus(error, true);
            currentNfcOperation = 'IDLE';
        }
    );
}

// Remove a reader from an existing tag
function removeReaderFromTag(index) {
    const confirmRemove = confirm(`Remove reader "${readers[index].id}"?`);
    if (confirmRemove) {
        readers.splice(index, 1);
        UI.updateReadersList(readers, 'manage-readers-list', removeReaderFromTag);
        UI.showStatus('Reader removed. Click "Update Tag" to save changes.');
    }
}

// Add a reader to an existing tag
function addReaderToExistingTag() {
    const readerId = prompt("Enter Reader ID:");
    if (!readerId || readerId.trim() === '') return;
    
    // Check if reader ID already exists
    if (readers.some(r => r.id === readerId)) {
        UI.showStatus(`Reader "${readerId}" already exists`, true);
        return;
    }
    
    // Ask if they want to generate or enter a key
    const generateOrEnter = confirm("Click OK to auto-generate a key, or Cancel to enter manually");
    
    let readerKey;
    if (generateOrEnter) {
        readerKey = Crypto.generateReadableKey(8);
    } else {
        readerKey = prompt("Enter Reader Key:");
        if (!readerKey || readerKey.trim() === '') return;
    }
    
    readers.push({ id: readerId, key: readerKey });
    UI.updateReadersList(readers, 'manage-readers-list', removeReaderFromTag);
    UI.showStatus(`Reader "${readerId}" added. Click "Update Tag" to save changes.`);
}

// Update an existing tag
async function updateTag() {
    if (!checkNfcSupport()) return;
    
    const pin = elements.managePin.value;
    
    if (!pin) {
        UI.showStatus('Owner PIN is required', true);
        return;
    }
    
    if (!currentTagData) {
        UI.showStatus('No tag data loaded', true);
        return;
    }
    
    // Show scanning animation
    UI.showScanningAnimation(true, 'Updating NFC tag...');
    UI.showStatus('Please bring the same NFC tag to the back of your device');
    
    // Get owner key
    const ownerKey = document.getElementById('manage-owner-key').textContent;
    
    // Get metadata and IV
    const ivBase64 = currentTagData.metadata.iv;
    const iv = Crypto.base64ToArrayBuffer(ivBase64);
    
    // Derive key from PIN
    const { derivedKey } = await Crypto.deriveKey(pin);
    
    // Encrypt owner data
    const encryptedOwnerKey = await Crypto.encrypt(ownerKey, derivedKey, iv);
    
    // Re-create owner record
    const ownerRecord = {
        t: "o",
        id: "owner",
        k: encryptedOwnerKey
    };
    
    // Encrypt reader data
    const readerRecords = [];
    
    for (const reader of readers) {
        const encryptedReaderKey = await Crypto.encrypt(reader.key, derivedKey, iv);
        
        readerRecords.push({
            t: "r",
            id: reader.id,
            k: encryptedReaderKey
        });
    }
    
    // Update the tag data
    const updatedTagData = {
        serviceUrl: currentTagData.serviceUrl,
        metadata: currentTagData.metadata,
        owner: ownerRecord,
        readers: readerRecords
    };
    
    // Prepare records for writing
    const records = NFC.prepareTagRecords(updatedTagData);
    
    // Start NFC operation
    currentNfcOperation = 'UPDATING';
    
    // Start NFC scanning
    await NFC.startNfcScan(
        async ({ message, serialNumber }) => {
            console.log(`Tag detected for updating. Serial: ${serialNumber}`);
            
            try {
                // Write records to tag
                await NFC.writeNfcTag(records);
                
                // Hide scanning animation
                UI.hideScanningAnimation();
                
                // Show success message
                UI.showStatus('Tag successfully updated!');
                
                // Stop scanning
                await NFC.stopNfcScan();
                
                // Reset operation state
                currentNfcOperation = 'IDLE';
            } catch (error) {
                UI.hideScanningAnimation();
                UI.showStatus(`Error updating tag: ${error.message || error}`, true);
                console.error(`Update Error:`, error);
                currentNfcOperation = 'IDLE';
                await NFC.stopNfcScan();
            }
        },
        (error) => {
            UI.hideScanningAnimation();
            UI.showStatus(error, true);
            currentNfcOperation = 'IDLE';
        }
    );
}

// Access tag with reader key
async function accessTag() {
    const readerKey = elements.accessKey.value;
    
    if (!readerKey) {
        UI.showStatus('Reader key is required', true);
        return;
    }
    
    currentNfcOperation = 'READING_FOR_ACCESS';
    
    // Show scanning animation
    UI.showScanningAnimation(false, 'Scanning for NFC tag...');
    UI.showStatus('Please bring the NFC tag to the back of your device');
    
    // Hide previous access result
    UI.hideAccessResult();
    
    // Start NFC scanning
    await NFC.startNfcScan(
        async ({ message, serialNumber }) => {
            console.log(`Tag detected for access. Serial: ${serialNumber}`);
            
            try {
                // Parse tag data
                const tagData = NFC.parseVaultTag(message);
                
                if (!tagData) {
                    throw new Error("Not a valid NFC Vault tag");
                }
                
                // Get metadata and IV
                const ivBase64 = tagData.metadata.iv;
                const iv = Crypto.base64ToArrayBuffer(ivBase64);
                
                // We need to try all PIN possibilities (brute force method for access)
                // In a more secure implementation, you'd have a better way to handle this
                // This is a simplification for demo purposes
                
                let accessGranted = false;
                let accessReaderId = null;
                
                // Start with attempt to use PIN as direct decryption key for owner
                for (let pin = 1000; pin <= 9999; pin++) {
                    // Try to derive key from this PIN
                    const { derivedKey } = await Crypto.deriveKey(pin.toString());
                    
                    // Try to decrypt owner key first
                    const ownerKey = await Crypto.decrypt(tagData.owner.k, derivedKey, iv);
                    
                    // If owner key decryption failed, try next PIN
                    if (!ownerKey) continue;
                    
                    // Now try all readers with this PIN and key
                    for (const reader of tagData.readers) {
                        const currentReaderKey = await Crypto.decrypt(reader.k, derivedKey, iv);
                        
                        // Check if this decrypted key matches the entered key
                        if (currentReaderKey === readerKey) {
                            accessGranted = true;
                            accessReaderId = reader.id;
                            break;
                        }
                    }
                    
                    if (accessGranted) break;
                }
                
                // Handle access result
                if (accessGranted) {
                    UI.showAccessGranted(accessReaderId);
                } else {
                    UI.showStatus("Access denied - Invalid reader key", true);
                }
                
                // Hide scanning animation
                UI.hideScanningAnimation();
                
                // Stop scanning
                await NFC.stopNfcScan();
                
                // Reset operation state
                currentNfcOperation = 'IDLE';
                
            } catch (error) {
                UI.hideScanningAnimation();
                UI.showStatus(`Error: ${error.message || error}`, true);
                console.error(`Access Error:`, error);
                currentNfcOperation = 'IDLE';
                await NFC.stopNfcScan();
            }
        },
        (error) => {
            UI.hideScanningAnimation();
            UI.showStatus(error, true);
            currentNfcOperation = 'IDLE';
        }
    );
}
