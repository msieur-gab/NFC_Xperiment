/**
 * NFC Vault Main Application
 * The main controller that integrates all modules
 */

// Import modules
import * as Crypto from './crypto.js';
import * as NFC from './nfc.js';
import * as ChunkedNFC from './nfc-chunked.js';
import * as UI from './ui.js';

// State variables
let readers = [];
let currentNfcOperation = 'IDLE'; // IDLE, READING, WRITING, UPDATING
let currentTagData = null;
let pendingTagData = null; // Store tag data temporarily before PIN entry
let isWritingMode = false; // New flag to track if we're in writing mode
let appState = 'WELCOME'; // WELCOME, CREATE_TAG, EDIT_TAG
let cachedPin = null;
let pinCacheTimeout = null;
const PIN_CACHE_DURATION = 120000; // 2 minutes in milliseconds
let globalWriteMode = false;

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

    // Initialize app with proper state based on URL
    initializeApp();
});

// Initialize element references
function initializeElements() {
    elements.ownerKey = document.getElementById('ownerKey');
    elements.ownerPin = document.getElementById('ownerPin');
    elements.newPin = document.getElementById('newPin');
    elements.tagPreview = document.getElementById('tagPreview');
    elements.submitButton = document.getElementById('submit-button');
    elements.scanButton = document.getElementById('scan-tag-button');
    elements.cancelButton = document.getElementById('cancel-button');
    elements.welcomeSection = document.getElementById('welcome-section');
    elements.tagForm = document.getElementById('tag-form');
    elements.changePinSection = document.getElementById('change-pin-section');
}

// Set up event listeners
function setupEventListeners() {
    // Generate buttons
    document.getElementById('generate-owner-key').addEventListener('click', generateOwnerKey);
    document.getElementById('generate-pin').addEventListener('click', generatePin);
    
    // Reader management buttons
    document.getElementById('add-reader').addEventListener('click', addReader);
    
    // Tag operation buttons
    document.getElementById('submit-button').addEventListener('click', handleTagFormSubmit);
    document.getElementById('show-preview').addEventListener('click', showTagPreview);
    document.getElementById('scan-tag-button').addEventListener('click', scanTag);
    document.getElementById('cancel-button').addEventListener('click', showWelcomeScreen);
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
            // Prepare records for size calculation
            const records = NFC.prepareTagRecords(tagData);
            const estimatedSize = ChunkedNFC.calculateRecordsSize(records);
            
            // Show size information in the preview
            tagData.estimatedSize = estimatedSize;
            tagData.tagSpecs = {
                'NTAG213': ChunkedNFC.getMaxWriteSize('NTAG213'),
                'NTAG215': ChunkedNFC.getMaxWriteSize('NTAG215'),
                'NTAG216': ChunkedNFC.getMaxWriteSize('NTAG216')
            };
            
            // Show preview
            UI.showTagPreview(tagData, ownerKey, ownerPin, readers);
        })
        .catch(error => {
            UI.showStatus(`Error preparing tag data: ${error.message}`, true);
        });
}

// Prepare tag data structure with encryption
async function prepareTagDataStructure(ownerKey, ownerPin, useExistingIV = false) {
    // Generate a random IV for AES or use existing one
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
    // Make sure we include the action=read parameter
    const serviceUrl = window.location.origin + window.location.pathname + "?action=read";

    // Prepare metadata record
    const metadataRecord = {
        version: "1.0",
        iv: ivBase64
    };
    
    // With CryptoJS, we use PIN directly as key
    const { derivedKey } = await Crypto.deriveKey(ownerPin);
    
    // Encrypt owner data - using PIN directly
    const encryptedOwnerKey = await Crypto.encrypt(ownerKey, ownerPin, iv);
    
    // Create owner record
    const ownerRecord = {
        t: "o", // type: owner
        id: "owner",
        k: encryptedOwnerKey
    };
    
    // Encrypt reader data - using PIN directly
    const readerRecords = [];
    
    for (const reader of readers) {
        const encryptedReaderKey = await Crypto.encrypt(reader.key, ownerPin, iv);
        
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
    if (!ChunkedNFC.isNfcSupported()) return;
    
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
    
    // Set writing mode to true
    isWritingMode = true;
    
    // Prepare tag data
    const tagData = await prepareTagDataStructure(ownerKey, ownerPin);
    
    // Prepare records for writing
    const records = NFC.prepareTagRecords(tagData);
    
    // Get the approximate size
    const estimatedSize = ChunkedNFC.calculateRecordsSize(records);
    
    // Start NFC operation
    currentNfcOperation = 'WRITING';
    
    // Show scanning animation
    UI.showScanningAnimation(true, 'Writing to NFC tag...');
    UI.showStatus(`Please bring the NFC tag to the back of your device to write data (${estimatedSize} bytes)`);
    
    // Start NFC scanning with WRITE mode
    await ChunkedNFC.startNfcScanWithChunking(
        async (event) => {
            const { message, serialNumber, tagType, maxSize } = event;
            console.log(`Tag detected for writing. Serial: ${serialNumber}, Type: ${tagType}, Max Size: ${maxSize} bytes`);
            
            try {
                // Check if data will fit
                if (estimatedSize > maxSize) {
                    UI.showStatus(`Warning: Data size (${estimatedSize} bytes) exceeds tag capacity (${maxSize} bytes). Some readers may not be written.`, true);
                }
                
                // Write records to tag using chunked writer
                await ChunkedNFC.writeNfcTagChunked(records, tagType);
                
                // Hide scanning animation
                UI.hideScanningAnimation();
                
                // Show success notification instead of simple status
                UI.showSuccessNotification(
                    'Tag Created Successfully', 
                    `Your NFC tag has been written with the new information. ${estimatedSize <= maxSize ? 'All data was written successfully.' : 'Some readers may have been omitted due to size constraints.'}`
                );
                
                // Stop scanning
                await NFC.stopNfcScan();
                
                // Reset operation state
                currentNfcOperation = 'IDLE';
                isWritingMode = false;
            } catch (error) {
                UI.hideScanningAnimation();
                UI.showStatus(`Error writing to tag: ${error.message || error}`, true);
                console.error(`Write Error:`, error);
                currentNfcOperation = 'IDLE';
                isWritingMode = false;
                await NFC.stopNfcScan();
            }
        },
        (error) => {
            UI.hideScanningAnimation();
            UI.showStatus(error, true);
            currentNfcOperation = 'IDLE';
            isWritingMode = false;
        },
        'WRITE' // Specify WRITE mode
    );
}

// Check if app was launched from a tag scan
function checkForTagScanURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');
    
    // If the app was launched with action=read parameter
    if (action === 'read') {
        UI.showStatus('Tag detected, scanning...');
        // Automatically start scanning for tag
        scanTag();
    }
}

// Improved scan tag for management with automatic detection
async function scanTagForManage() {
    if (!ChunkedNFC.isNfcSupported()) return;
    
    currentNfcOperation = 'READING_FOR_MANAGE';
    
    // Show scanning animation
    UI.showScanningAnimation(false, 'Scanning for NFC tag...');
    UI.showStatus('Please bring the NFC tag to the back of your device');
    
    // Start NFC scanning with READ mode
    await ChunkedNFC.startNfcScanWithChunking(
        async (event) => {
            const { message, serialNumber, tagType } = event;
            console.log(`Tag detected for management. Serial: ${serialNumber}, Type: ${tagType}`);
            
            try {
                // Parse tag data
                const tagData = NFC.parseVaultTag(message);
                
                if (!tagData) {
                    throw new Error("Not a valid NFC Vault tag");
                }
                
                // Store the tag data temporarily
                pendingTagData = tagData;
                
                // Hide scanning animation
                UI.hideScanningAnimation();
                
                // Stop NFC scanning
                await NFC.stopNfcScan();
                
                // Only show PIN modal if we're not in writing mode
                if (!isWritingMode) {
                    // Show PIN modal immediately
                    UI.showPinModal(
                        // On PIN submit
                        async (pin) => {
                            try {
                                await decryptAndLoadTag(pendingTagData, pin);
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
                }
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
        },
        'READ' // Specify READ mode
    );
}

// Function to cache the PIN temporarily
function cachePin(pin) {
    // Clear any existing timeout
    if (pinCacheTimeout) {
        clearTimeout(pinCacheTimeout);
    }
    
    // Store the PIN in memory
    cachedPin = pin;
    
    // Set a timeout to clear the PIN
    pinCacheTimeout = setTimeout(() => {
        clearPinCache();
    }, PIN_CACHE_DURATION);
    
    console.log('PIN cached temporarily for update operations');
}

// Function to clear the PIN cache
function clearPinCache() {
    cachedPin = null;
    if (pinCacheTimeout) {
        clearTimeout(pinCacheTimeout);
        pinCacheTimeout = null;
    }
    console.log('PIN cache cleared');
}

// Decrypt and load tag data with provided PIN
async function decryptAndLoadTag(tagData, pin) {
    try {
        // Get metadata and IV
        const ivBase64 = tagData.metadata.iv;
        UI.showStatus(`Reading tag data...`, false);
        
        const iv = Crypto.base64ToArrayBuffer(ivBase64);
        
        // With CryptoJS, we use the PIN directly as the key
        const { derivedKey } = await Crypto.deriveKey(pin);
        
        // Try to decrypt owner key
        const ownerKey = await Crypto.decrypt(tagData.owner.k, pin, iv);
        
        if (!ownerKey) {
            UI.showStatus(`Invalid PIN - cannot decrypt tag. Please check your PIN.`, true);
            throw new Error("Invalid PIN - cannot decrypt tag");
        }
        
        // Decrypt all reader keys
        const decryptedReaders = [];
        
        for (const record of tagData.readers) {
            const readerKey = await Crypto.decrypt(record.k, pin, iv);
            
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
        
        // Update UI for edit mode
        elements.ownerKey.value = ownerKey;
        document.getElementById('change-pin-section').style.display = 'block';
        UI.updateReadersList(readers, 'readersList', removeReader);
        
        UI.showStatus("Tag successfully decrypted and loaded");
        
        // Reset operation state
        currentNfcOperation = 'IDLE';
        
        // If decryption was successful, cache the PIN temporarily
        cachePin(pin);
        
        return true;
    } catch (error) {
        UI.showStatus(`Decryption error: ${error.message}`, true);
        throw error;
    }
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
async function updateExistingTag() {
    if (!ChunkedNFC.isNfcSupported()) return;
    
    if (!currentTagData) {
        UI.showStatus('No tag data loaded', true);
        return;
    }
    
    // Get owner key
    const ownerKey = elements.ownerKey.value;
    
    // Check if a new PIN was provided
    const newPin = document.getElementById('newPin').value;
    
    // If a new PIN is provided, use it directly
    if (newPin && newPin.trim() !== '') {
        try {
            await performTagUpdate(ownerKey, newPin);
            // Clear the new PIN field
            document.getElementById('newPin').value = '';
        } catch (error) {
            UI.showStatus(`Error: ${error.message}`, true);
        }
        return;
    }
    
    // If we have a cached PIN, use it without prompting
    if (cachedPin) {
        try {
            await performTagUpdate(ownerKey, cachedPin);
            // Extend the PIN cache time since we just used it
            cachePin(cachedPin);
        } catch (error) {
            UI.showStatus(`Error: ${error.message}`, true);
            // If there was an error, maybe the PIN is wrong, so clear it
            clearPinCache();
        }
        return;
    }
    
    // If no cached PIN and no new PIN, prompt for current PIN
    UI.showPinModal(
        // On PIN submit
        async (pin) => {
            try {
                await performTagUpdate(ownerKey, pin);
                // Cache the PIN for future operations
                cachePin(pin);
            } catch (error) {
                UI.showStatus(`Error: ${error.message}`, true);
            }
        },
        // On PIN cancel
        () => {
            UI.showStatus('Update cancelled');
        }
    );
}

// Modify the performTagUpdate function to handle NFC reader initialization better
async function performTagUpdate(ownerKey, pin) {
    // Set both writing flags to true
    isWritingMode = true;
    globalWriteMode = true;
    
    // Show scanning animation
    UI.showScanningAnimation(true, 'Updating NFC tag...');
    UI.showStatus('Please bring the same NFC tag to the back of your device');
    
    try {
        // Prepare updated tag data structure
        const tagData = await prepareTagDataStructure(ownerKey, pin, false);
        
        // Prepare records for writing
        const records = NFC.prepareTagRecords(tagData);
        
        // Get the approximate size
        const estimatedSize = ChunkedNFC.calculateRecordsSize(records);
        
        // Start NFC operation
        currentNfcOperation = 'UPDATING';
        
        // Make sure any existing NFC scan is stopped before starting a new one
        try {
            await NFC.stopNfcScan();
            console.log('Stopped any existing NFC scan before update');
        } catch (e) {
            console.log('No existing NFC scan to stop');
        }
        
        // Start NFC scanning with a small delay to ensure clean initialization
        setTimeout(async () => {
            try {
                await ChunkedNFC.startNfcScanWithChunking(
                    async (event) => {
                        const { message, serialNumber, tagType, maxSize } = event;
                        console.log(`Tag detected for updating. Serial: ${serialNumber}, Type: ${tagType}, Max Size: ${maxSize} bytes`);
                        
                        try {
                            // Check if data will fit
                            if (estimatedSize > maxSize) {
                                UI.showStatus(`Warning: Data size (${estimatedSize} bytes) exceeds tag capacity (${maxSize} bytes). Some readers may not be written.`, true);
                            }
                            
                            // Write records to tag
                            await ChunkedNFC.writeNfcTagChunked(records, tagType);
                            
                            // Hide scanning animation
                            UI.hideScanningAnimation();
                            
                            // Show success notification
                            UI.showSuccessNotification(
                                'Tag Updated Successfully', 
                                `Your NFC tag has been updated with the new information. ${estimatedSize <= maxSize ? 'All data was written successfully.' : 'Some readers may have been omitted due to size constraints.'}`
                            );
                            
                            // Update current tag data
                            currentTagData = tagData;
                            
                            // Stop scanning
                            await NFC.stopNfcScan();
                            
                            // Reset operation state
                            currentNfcOperation = 'IDLE';
                            isWritingMode = false;
                            globalWriteMode = false;
                            
                            // Clear any pending tag data
                            pendingTagData = null;
                        } catch (error) {
                            UI.hideScanningAnimation();
                            UI.showStatus(`Error updating tag: ${error.message || error}`, true);
                            console.error(`Update Error:`, error);
                            currentNfcOperation = 'IDLE';
                            isWritingMode = false;
                            globalWriteMode = false;
                            await NFC.stopNfcScan();
                        }
                    },
                    (error) => {
                        UI.hideScanningAnimation();
                        UI.showStatus(`NFC error: ${error}`, true);
                        currentNfcOperation = 'IDLE';
                        isWritingMode = false;
                        globalWriteMode = false;
                    },
                    'WRITE' // Specify WRITE mode
                );
            } catch (error) {
                UI.hideScanningAnimation();
                UI.showStatus(`Failed to start NFC scan: ${error.message || error}`, true);
                currentNfcOperation = 'IDLE';
                isWritingMode = false;
                globalWriteMode = false;
            }
        }, 300); // Small delay to ensure clean initialization
    } catch (error) {
        UI.hideScanningAnimation();
        UI.showStatus(`Error preparing tag data: ${error.message || error}`, true);
        isWritingMode = false;
        globalWriteMode = false;
    }
}

// Update the initialization function to set up the initial UI state
function initializeApp() {
    // Check if we were launched from a tag scan
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');
    
    if (action === 'read') {
        // Start scanning immediately
        UI.showStatus('Tag detected, scanning...');
        scanTag();
    } else {
        // Show welcome screen
        showWelcomeScreen();
    }
}

// Show welcome/onboarding screen
function showWelcomeScreen() {
    appState = 'WELCOME';
    // Hide tag form sections
    document.getElementById('tag-form').style.display = 'none';
    // Show welcome section
    document.getElementById('welcome-section').style.display = 'block';
    
    // Clear PIN cache when returning to welcome screen
    clearPinCache();
}

// Show tag form (either for creation or editing)
function showTagForm(isEditing = false) {
    appState = isEditing ? 'EDIT_TAG' : 'CREATE_TAG';
    
    // Hide welcome section
    document.getElementById('welcome-section').style.display = 'none';
    // Show tag form
    document.getElementById('tag-form').style.display = 'block';
    
    // Update UI elements based on mode
    document.getElementById('form-title').textContent = isEditing ? 'Edit NFC Tag' : 'Create New NFC Tag';
    document.getElementById('submit-button').textContent = isEditing ? 'Update Tag' : 'Write to NFC Tag';
    
    // In edit mode, some fields might be read-only
    if (isEditing) {
        document.getElementById('ownerKey').readOnly = true;
        // Maybe show a "Change PIN" section that's initially collapsed
    } else {
        document.getElementById('ownerKey').readOnly = false;
        // Reset form fields
        resetFormFields();
    }
}

// Main scan function that handles both new and existing tags
async function scanTag() {
    if (!ChunkedNFC.isNfcSupported()) return;
    
    // Check both flags to be extra safe
    if (isWritingMode || globalWriteMode) {
        console.log('Already in writing mode, skipping read operation');
        return;
    }
    
    // Show scanning animation
    UI.showScanningAnimation(false, 'Scanning NFC tag...');
    UI.showStatus('Please bring the NFC tag to the back of your device');
    
    // Start NFC scanning with READ mode
    await ChunkedNFC.startNfcScanWithChunking(
        async (event) => {
            const { message, serialNumber, tagType } = event;
            // If we entered writing mode while waiting for a tag, abort the read operation
            if (isWritingMode) {
                console.log('Entered writing mode, aborting read operation');
                UI.hideScanningAnimation();
                await NFC.stopNfcScan();
                return;
            }
            
            try {
                // Try to parse as a vault tag
                const tagData = NFC.parseVaultTag(message);
                
                // Hide scanning animation
                UI.hideScanningAnimation();
                
                // Stop NFC scanning
                await NFC.stopNfcScan();
                
                // If we entered writing mode while processing, abort
                if (isWritingMode) {
                    console.log('Entered writing mode, aborting read operation');
                    return;
                }
                
                if (tagData) {
                    // It's an existing tag
                    pendingTagData = tagData;
                    
                    // If we have a cached PIN, try to use it automatically
                    if (cachedPin && !isWritingMode) {
                        try {
                            const success = await decryptAndLoadTag(pendingTagData, cachedPin);
                            if (success) {
                                // Show edit form
                                showTagForm(true);
                                return;
                            }
                        } catch (error) {
                            // If decryption fails with cached PIN, clear it and continue to PIN prompt
                            clearPinCache();
                        }
                    }
                    
                    // Show PIN modal if no cached PIN or if cached PIN failed
                    UI.showPinModal(
                        // On PIN submit
                        async (pin) => {
                            try {
                                await decryptAndLoadTag(pendingTagData, pin);
                                // Show edit form
                                showTagForm(true);
                            } catch (error) {
                                UI.showStatus(`Error: ${error.message}`, true);
                                showWelcomeScreen();
                            }
                        },
                        // On PIN cancel
                        () => {
                            pendingTagData = null;
                            UI.showStatus('Operation cancelled');
                            showWelcomeScreen();
                        }
                    );
                } else {
                    // It's a new tag
                    UI.showStatus('New tag detected. You can now create content for this tag.');
                    showTagForm(false);
                }
            } catch (error) {
                UI.hideScanningAnimation();
                UI.showStatus(`Error reading tag: ${error.message || error}`, true);
                showWelcomeScreen();
                await NFC.stopNfcScan();
            }
        },
        (error) => {
            UI.hideScanningAnimation();
            UI.showStatus(error, true);
            showWelcomeScreen();
        },
        'READ' // Specify READ mode
    );
}

// Handle form submission (either create or update)
async function handleTagFormSubmit() {
    if (appState === 'EDIT_TAG') {
        await updateExistingTag();
    } else {
        await startNFCWrite();
    }
}

// Reset form fields
function resetFormFields() {
    elements.ownerKey.value = '';
    elements.ownerPin.value = '';
    document.getElementById('readersList').innerHTML = '';
    readers = [];
    
    // Hide change PIN section in create mode
    document.getElementById('change-pin-section').style.display = 'none';
}

// Also update the NFC.parseVaultTag function to check the global flag
// We'll need to monkey-patch this function
const originalParseVaultTag = NFC.parseVaultTag;
NFC.parseVaultTag = function(message) {
    // If we're in write mode, don't try to parse the tag
    if (globalWriteMode) {
        console.log('In write mode, skipping tag parsing');
        return null;
    }
    
    // Otherwise, use the original function
    return originalParseVaultTag(message);
};