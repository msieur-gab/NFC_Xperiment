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
let pendingTagData = null; // Store tag data temporarily before PIN entry

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
    
    // Set up password toggle buttons
    UI.setupPasswordToggles();
    
    // Check NFC support
    checkNfcSupport();
});

// Initialize element references
function initializeElements() {
    // Create tab elements
    elements.ownerKey = document.getElementById('ownerKey');
    elements.ownerPin = document.getElementById('ownerPin');
    elements.newPin = document.getElementById('newPin');
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
    prepareTagDataStructure(ownerKey, ownerPin)
        .then(tagData => {
            // Show preview
            UI.showTagPreview(tagData, ownerKey, ownerPin, readers);
        })
        .catch(error => {
            UI.showStatus(`Error preparing tag data: ${error.message}`, true);
        });
}

// Prepare tag data structure with encryption
async function prepareTagDataStructure(ownerKey, ownerPin, useExistingIV = false) {
    // Generate a random IV for AES-GCM or use existing one
    let iv, ivBase64;
    
    if (useExistingIV && currentTagData && currentTagData.metadata && currentTagData.metadata.iv) {
        // Use existing IV from current tag data (for updates)
        ivBase64 = currentTagData.metadata.iv;
        iv = Crypto.base64ToArrayBuffer(ivBase64);
    } else {
        // Generate new IV
        iv = Crypto.generateIV();
        ivBase64 = Crypto.arrayBufferToBase64(iv);
    }
    
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
    if (!checkNfcSupport()) return;
    
    currentNfcOperation = 'READING_FOR_MANAGE';
    
    // Show scanning animation
    UI.showScanningAnimation(false, 'Scanning for NFC tag...');
    UI.showStatus('Please bring the NFC tag to the back of your device');
    
    // Start NFC scanning
    await NFC.startNfcScan(
        async ({ message, serialNumber }) => {
            // Afficher immédiatement un message pour voir si on arrive ici
            UI.showStatus("Tag detected, processing...");
            
            try {
                // Tenter de récupérer les records bruts pour débogage
                let rawRecords = [];
                if (message && message.records) {
                    message.records.forEach((record, idx) => {
                        try {
                            if (record.recordType === 'text') {
                                const textDecoder = new TextDecoder();
                                const text = textDecoder.decode(record.data);
                                rawRecords.push(`Record ${idx}: ${text.substring(0, 50)}...`);
                            } else if (record.recordType === 'url') {
                                const textDecoder = new TextDecoder();
                                const url = textDecoder.decode(record.data);
                                rawRecords.push(`URL: ${url}`);
                            }
                        } catch (e) {
                            rawRecords.push(`Error reading record ${idx}`);
                        }
                    });
                }
                
                // Afficher les enregistrements bruts pour débogage
                if (rawRecords.length > 0) {
                    UI.showStatus(`Found ${rawRecords.length} records on tag`);
                } else {
                    UI.showStatus(`Tag detected but no records found`, true);
                }
                
                // Parse tag data
                const tagData = NFC.parseVaultTag(message);
                
                if (!tagData) {
                    throw new Error("Not a valid NFC Vault tag");
                }
                
                // Afficher un résumé des données récupérées
                UI.showStatus(`Tag parsed successfully. Found: metadata, owner, ${tagData.readers.length} readers`);
                
                // Store the tag data temporarily
                pendingTagData = tagData;
                
                // Hide scanning animation
                UI.hideScanningAnimation();
                
                // Stop NFC scanning
                await NFC.stopNfcScan();
                
                // Show PIN modal
                UI.showPinModal(
                    // On PIN submit
                    async (pin) => {
                        try {
                            // Afficher le PIN et l'IV pour débogage
                            UI.showStatus(`Testing with PIN: ${pin} and IV present: ${!!pendingTagData.metadata.iv}`);
                            
                            // Essaie de contourner le décryptage pour test
                            try {
                                await forceDecryptAndLoadTag(pendingTagData, pin);
                            } catch (decryptError) {
                                UI.showStatus(`Forced loading failed: ${decryptError.message}`, true);
                            }
                        } catch (error) {
                            UI.showStatus(`Error: ${error.message}`, true);
                        }
                    },
                    // On PIN cancel
                    () => {
                        pendingTagData = null;
                        UI.showStatus('Operation cancelled');
                        currentNfcOperation = 'IDLE';
                    }
                );
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

async function forceDecryptAndLoadTag(tagData, pin) {
    // Ajouter une version modifiée qui ignore les erreurs de déchiffrement
    
    // Informations de base pour déboguer
    UI.showStatus(`Force loading tag with PIN: ${pin}`);
    
    try {
        // Get metadata and IV
        const ivBase64 = tagData.metadata.iv;
        UI.showStatus(`IV found: ${ivBase64.substring(0, 10)}...`);
        
        // Try to convert IV - This might be where things break
        let iv;
        try {
            iv = Crypto.base64ToArrayBuffer(ivBase64);
            UI.showStatus('IV conversion successful');
        } catch (ivError) {
            UI.showStatus(`IV conversion failed: ${ivError.message}`, true);
            // Use a dummy IV for testing
            iv = new Uint8Array(12);
        }
        
        // Derive key from PIN
        let derivedKey;
        try {
            const result = await Crypto.deriveKey(pin.toString());
            derivedKey = result.derivedKey;
            UI.showStatus('Key derivation successful');
        } catch (keyError) {
            UI.showStatus(`Key derivation failed: ${keyError.message}`, true);
            return;
        }
        
        // Simulate successful decryption for testing
        const ownerKey = "DEBUG_OWNER_KEY";
        
        // Create mock reader data
        const decryptedReaders = tagData.readers.map(record => ({
            id: record.id,
            key: `DEBUG_KEY_FOR_${record.id}`
        }));
        
        // Store the data
        readers = decryptedReaders;
        currentTagData = tagData;
        
        // Show the UI
        UI.showManageContent(ownerKey, readers, removeReaderFromTag);
        UI.showStatus("FORCE TEST MODE: Data loaded with mocked keys");
        
        // Reset operation state
        currentNfcOperation = 'IDLE';
    } catch (error) {
        UI.showStatus(`Force loading failed: ${error.message}`, true);
        throw error;
    }
}

// Decrypt and load tag data with provided PIN
// Decrypt and load tag data with provided PIN
async function decryptAndLoadTag(tagData, pin) {
    // Get metadata and IV
    const ivBase64 = tagData.metadata.iv;
    const iv = Crypto.base64ToArrayBuffer(ivBase64);
    
    // Derive key from PIN
    const { derivedKey } = await Crypto.deriveKey(pin.toString()); // Assurez-vous que le PIN est une chaîne
    
    // Try to decrypt owner key
    let ownerKey = await Crypto.decrypt(tagData.owner.k, derivedKey, iv);
    
    // ====== MODE TEST - Contournement de la vérification du PIN ======
    // Si le déchiffrement échoue, on procède quand même avec une clé de test
    if (!ownerKey) {
        // On simule un succès pour voir si le reste du flux fonctionne
        ownerKey = "DEBUG_OWNER_KEY_" + new Date().getTime();
        
        // Afficher un message pour indiquer qu'on est en mode test
        UI.showStatus("MODE TEST: Contournement de la vérification PIN", false);
    }
    // ================================================================
    
    // Decrypt all reader keys
    const decryptedReaders = [];
    
    for (const record of tagData.readers) {
        // En mode test, on génère aussi des clés de lecteur factices
        let readerKey = await Crypto.decrypt(record.k, derivedKey, iv);
        
        // Si on ne peut pas déchiffrer mais qu'on est en mode test (ownerKey commence par DEBUG)
        if (!readerKey && ownerKey.startsWith("DEBUG_OWNER_KEY")) {
            readerKey = "DEBUG_READER_KEY_" + record.id;
        }
        
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
    UI.showStatus(ownerKey.startsWith("DEBUG_OWNER_KEY") ? 
                 "MODE TEST: Tag chargé avec clés simulées" : 
                 "Tag successfully decrypted and loaded");
    
    // Reset operation state
    currentNfcOperation = 'IDLE';
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
    
    if (!currentTagData) {
        UI.showStatus('No tag data loaded', true);
        return;
    }
    
    // Get owner key
    const ownerKey = document.getElementById('manage-owner-key').textContent;
    
    // Check if a new PIN was provided
    const newPin = elements.newPin.value;
    
    // If no new PIN, prompt for current PIN
    if (!newPin || newPin.trim() === '') {
        UI.showPinModal(
            // On PIN submit
            async (pin) => {
                try {
                    await performTagUpdate(ownerKey, pin);
                } catch (error) {
                    UI.showStatus(`Error: ${error.message}`, true);
                }
            },
            // On PIN cancel
            () => {
                UI.showStatus('Update cancelled');
            }
        );
    } else {
        // Use the new PIN
        try {
            await performTagUpdate(ownerKey, newPin);
            // Clear the new PIN field
            elements.newPin.value = '';
        } catch (error) {
            UI.showStatus(`Error: ${error.message}`, true);
        }
    }
}

// Perform the actual tag update
async function performTagUpdate(ownerKey, pin) {
    // Show scanning animation
    UI.showScanningAnimation(true, 'Updating NFC tag...');
    UI.showStatus('Please bring the same NFC tag to the back of your device');
    
    // Prepare updated tag data structure
    // Force using a new IV even when updating to add additional security
    const tagData = await prepareTagDataStructure(ownerKey, pin, false);
    
    // Prepare records for writing
    const records = NFC.prepareTagRecords(tagData);
    
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
                
                // Update current tag data
                currentTagData = tagData;
                
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