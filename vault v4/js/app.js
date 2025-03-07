/**
 * NFC Vault Main Application
 * Main controller that integrates all modules with cleaner component usage
 */

// Import modules
import * as Crypto from './crypto.js';
import * as NFC from './nfc.js';
import * as UI from './ui.js';

// State variables
let readers = [];
let currentNfcOperation = 'IDLE'; // IDLE, READING, WRITING, UPDATING
let currentTagData = null;
let pendingTagData = null;
let isWritingMode = false;
let appState = 'WELCOME'; // WELCOME, CREATE_TAG, EDIT_TAG
let cachedPin = null;
let pinCacheTimeout = null;
const PIN_CACHE_DURATION = 120000; // 2 minutes in milliseconds

// Component references
let toast;
let nfcScanAnimation;
let pinInput;

// DOM Elements
const elements = {};

// Store callbacks for PIN modal
let currentPinCallback = null;
let currentCancelCallback = null;

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    // Initialize custom components first
    initializeComponents();
    
    // Initialize DOM elements
    initializeElements();
    
    // Set up event listeners
    setupEventListeners();
    
    // Set up password toggle buttons
    UI.setupPasswordToggles();
    
    // Check NFC support
    checkNfcSupport();

    // Initialize app state
    initializeApp();
});

// Initialize custom components
function initializeComponents() {
    // Get toast notification component
    toast = document.getElementById('toast');
    
    // Get NFC scan animation component - ensure it's correctly cast
    nfcScanAnimation = document.getElementById('scanning-animation');
    if (!(nfcScanAnimation instanceof NfcScanAnimation)) {
      console.error('Scanning animation is not a proper custom element');
    }
    
    // Get PIN input component
    pinInput = document.getElementById('modalPinInput');
  }

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
    elements.showPreviewButton = document.getElementById('show-preview');
    elements.pinModal = document.getElementById('pin-modal');
    elements.submitPinButton = document.getElementById('submit-pin');
    elements.cancelPinButton = document.getElementById('cancel-pin');
}

// Set up event listeners
function setupEventListeners() {
    // Generate buttons
    document.getElementById('generate-owner-key').addEventListener('click', generateOwnerKey);
    document.getElementById('generate-pin').addEventListener('click', generatePin);
    
    // Reader management
    document.getElementById('add-reader').addEventListener('click', addReader);
    
    // Tag operations
    elements.submitButton.addEventListener('click', handleTagFormSubmit);
    elements.showPreviewButton.addEventListener('click', showTagPreview);
    elements.scanButton.addEventListener('click', scanTag);
    elements.cancelButton.addEventListener('click', showWelcomeScreen);
    
    // Set up the PIN modal handlers
    setupPinModalHandlers();
}

// Set up PIN modal event handlers
function setupPinModalHandlers() {
    // Set up the submit button handler - use direct reference
    elements.submitPinButton.onclick = handlePinSubmit;
    
    // Set up the cancel button handler - use direct reference
    elements.cancelPinButton.onclick = handlePinCancel;
    
    // If the PIN input component is available, set up its complete event
    if (pinInput) {
        // Remove previous listeners
        pinInput.removeEventListener('complete', handlePinComplete);
        // Add new listener
        pinInput.addEventListener('complete', handlePinComplete);
    }
}

// Show PIN modal
function showPinModal(onSubmit, onCancel) {
    // Store callbacks
    currentPinCallback = onSubmit;
    currentCancelCallback = onCancel;
    
    // Clear previous PIN
    if (pinInput && pinInput.clear && typeof pinInput.clear === 'function') {
        pinInput.clear();
    }
    
    // Show modal
    elements.pinModal.classList.add('active');
    
    // Focus the PIN input
    setTimeout(() => {
        if (pinInput && pinInput.shadowRoot) {
            const input = pinInput.shadowRoot.querySelector('input');
            if (input) {
                input.focus();
            }
        }
    }, 100);
}

// Handle PIN submission
function handlePinSubmit() {
    const pinInput = document.getElementById('modalPinInput');
    const pinValue = pinInput ? pinInput.value : '';
    
    if (pinValue && pinValue.length > 0) {
        // Call the callback with the PIN
        if (typeof currentPinCallback === 'function') {
            currentPinCallback(pinValue);
        }
        // Hide the modal
        hidePinModal();
    } else {
        // Show error
        showStatus('Please enter a PIN', true);
    }
}

// Handle PIN complete event
function handlePinComplete(e) {
    const pinInput = document.getElementById('modalPinInput');
    const pinValue = pinInput ? pinInput.value : '';
    
    if (pinValue && pinValue.length > 0) {
        // Call the callback with the PIN
        if (typeof currentPinCallback === 'function') {
            currentPinCallback(pinValue);
        }
        // Hide the modal
        hidePinModal();
    }
}

// Handle PIN cancel
function handlePinCancel() {
    hidePinModal();
    if (typeof currentCancelCallback === 'function') {
        currentCancelCallback();
    }
}

// Hide PIN modal
function hidePinModal() {
    elements.pinModal.classList.remove('active');
    
    // Clear callbacks
    currentPinCallback = null;
    currentCancelCallback = null;
}

// Check if NFC is supported
function checkNfcSupport() {
    const supported = NFC.isNfcSupported();
    
    if (!supported) {
        showStatus("NFC is not supported on this device or browser.", true);
    }
    
    return supported;
}

// Show status message with optional HTML notification fallback
function showStatus(message, isError = false) {
    // Use toast only for notifications
    if (toast) {
        if (isError) {
            toast.error(message);
        } else {
            toast.info(message);
        }
        return; // Don't update HTML status element
    }
    
    // Fallback to HTML status only if toast isn't available
    UI.showStatus(message, isError);
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
        showStatus(`Reader "${readerId}" already exists`, true);
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
    showStatus(`Reader "${readerId}" added`);
}

// Remove a reader
function removeReader(index) {
    const confirmRemove = confirm(`Remove reader "${readers[index].id}"?`);
    if (confirmRemove) {
        const readerName = readers[index].id;
        readers.splice(index, 1);
        UI.updateReadersList(readers, 'readersList', removeReader);
        showStatus(`Reader "${readerName}" removed`);
    }
}

// Show tag data preview
function showTagPreview() {
    const ownerKey = elements.ownerKey.value;
    const ownerPin = elements.ownerPin.value;

    if (!ownerKey || !ownerPin) {
        showStatus('Owner key and PIN are required', true);
        return;
    }

    if (readers.length === 0) {
        showStatus('Please add at least one reader', true);
        return;
    }

    // Generate a sample tag structure
    prepareTagDataStructure(ownerKey, ownerPin)
        .then(tagData => {
            // Show preview
            UI.showTagPreview(tagData, ownerKey, ownerPin, readers);
        })
        .catch(error => {
            showStatus(`Error preparing tag data: ${error.message}`, true);
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
    if (!checkNfcSupport()) return;
    
    const ownerKey = elements.ownerKey.value;
    const ownerPin = elements.ownerPin.value;
    
    if (!ownerKey || !ownerPin) {
        showStatus('Owner key and PIN are required', true);
        return;
    }
    
    if (readers.length === 0) {
        showStatus('Please add at least one reader', true);
        return;
    }
    
    // Set writing mode
    isWritingMode = true;
    
    try {
        // Prepare tag data
        const tagData = await prepareTagDataStructure(ownerKey, ownerPin);
        
        // Prepare records for writing
        const records = NFC.prepareTagRecords(tagData);
        
        // Start NFC operation
        currentNfcOperation = 'WRITING';
        
        // Show scanning animation
        nfcScanAnimation.show('write', 'Writing to NFC tag...');
        showStatus('Please bring the NFC tag to the back of your device to write data');
        
        // Start NFC scanning
        await NFC.startNfcScan(
            async ({ message, serialNumber }) => {
                console.log(`Tag detected for writing. Serial: ${serialNumber}`);
                
                try {
                    // Write records to tag
                    await NFC.writeNfcTag(records);
                    
                    // Hide scanning animation
                    nfcScanAnimation.hide();
                    
                    // Show success notification
                    // UI.showSuccessNotification(
                    //     'Tag Created Successfully', 
                    //     'Your NFC tag has been written with the new information.'
                    // );
                    showStatus('Tag Created Successfully');
                    
                    // Stop scanning
                    await NFC.stopNfcScan();
                    
                    // Reset operation state
                    currentNfcOperation = 'IDLE';
                    isWritingMode = false;
                } catch (error) {
                    nfcScanAnimation.hide();
                    showStatus(`Error writing to tag: ${error.message || error}`, true);
                    console.error(`Write Error:`, error);
                    currentNfcOperation = 'IDLE';
                    isWritingMode = false;
                    await NFC.stopNfcScan();
                }
            },
            (error) => {
                nfcScanAnimation.hide();
                showStatus(error, true);
                currentNfcOperation = 'IDLE';
                isWritingMode = false;
            },
            'WRITE' // Specify WRITE mode
        );
    } catch (error) {
        nfcScanAnimation.hide();
        showStatus(`Error preparing tag data: ${error.message || error}`, true);
        isWritingMode = false;
    }
}

// Initialize the app based on URL parameters
function initializeApp() {
    // Check if we were launched from a tag scan
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');
    
    if (action === 'read') {
        // Start scanning immediately
        showStatus('Tag detected, scanning...');
        scanTag();
    } else {
        // Show welcome screen
        showWelcomeScreen();
    }
}

// Cache PIN temporarily
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

// Clear the PIN cache
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
        showStatus(`Reading tag data...`, false);
        
        const iv = Crypto.base64ToArrayBuffer(ivBase64);
        
        // Try to decrypt owner key
        const ownerKey = await Crypto.decrypt(tagData.owner.k, pin, iv);
        
        if (!ownerKey) {
            showStatus(`Invalid PIN - cannot decrypt tag. Please check your PIN.`, true);
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
        elements.changePinSection.style.display = 'block';
        UI.updateReadersList(readers, 'readersList', removeReader);
        
        showStatus("Tag successfully decrypted and loaded");
        
        // Reset operation state
        currentNfcOperation = 'IDLE';
        
        // If decryption was successful, cache the PIN temporarily
        cachePin(pin);
        
        return true;
    } catch (error) {
        showStatus(`Decryption error: ${error.message}`, true);
        throw error;
    }
}

// Update an existing tag
async function updateExistingTag() {
    if (!checkNfcSupport()) return;
    
    if (!currentTagData) {
        showStatus('No tag data loaded', true);
        return;
    }
    
    // Get owner key
    const ownerKey = elements.ownerKey.value;
    
    // Check if a new PIN was provided
    const newPin = elements.newPin.value;
    
    // If a new PIN is provided, use it directly
    if (newPin && newPin.trim() !== '') {
        try {
            await performTagUpdate(ownerKey, newPin);
            // Clear the new PIN field
            elements.newPin.value = '';
        } catch (error) {
            showStatus(`Error: ${error.message}`, true);
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
            showStatus(`Error: ${error.message}`, true);
            // If there was an error, maybe the PIN is wrong, so clear it
            clearPinCache();
        }
        return;
    }
    
    // If no cached PIN and no new PIN, prompt for current PIN
    showPinModal(
        // On PIN submit
        async (pin) => {
            try {
                await performTagUpdate(ownerKey, pin);
                // Cache the PIN for future operations
                cachePin(pin);
            } catch (error) {
                showStatus(`Error: ${error.message}`, true);
            }
        },
        // On PIN cancel
        () => {
            showStatus('Update cancelled');
        }
    );
}

// Perform tag update with given PIN
// Perform tag update with given PIN
async function performTagUpdate(ownerKey, pin) {
    // Set writing mode
    isWritingMode = true;
    
    // Show scanning animation
    nfcScanAnimation.show('write', 'Updating NFC tag...');
    showStatus('Please bring the same NFC tag to the back of your device');
    
    try {
        // Prepare updated tag data structure
        const tagData = await prepareTagDataStructure(ownerKey, pin, false);
        
        // Prepare records for writing
        const records = NFC.prepareTagRecords(tagData);
        
        // Start NFC operation
        currentNfcOperation = 'UPDATING';
        
        // Make sure any existing NFC scan is stopped
        try {
            // if (ndefReader) { // This assumes ndefReader is accessible, if not, use NFC.stopNfcScan()
                await NFC.stopNfcScan();
                console.log('Stopped existing NFC scan');
            // }
        } catch (e) {
            console.log('No active NFC scan to stop');
        }
        
        // Wait a moment to ensure NFC system is reset
        await new Promise(resolve => setTimeout(resolve, 500));
        
        try {
            console.log('Starting NFC scan for writing...');
            // Initialize NFC reader
            await NFC.startNfcScan(
                async ({ message, serialNumber }) => {
                    console.log(`Tag detected for updating. Serial: ${serialNumber}`);
                    
                    try {
                        // Write records to tag
                        await NFC.writeNfcTag(records);
                        
                        // Hide scanning animation
                        nfcScanAnimation.hide();
                        
                        // Show success notification
                        UI.showSuccessNotification(
                            'Tag Updated Successfully', 
                            'Your NFC tag has been updated with the new information.'
                        );
                        
                        // Update current tag data
                        currentTagData = tagData;
                        
                        // Stop scanning
                        await NFC.stopNfcScan();
                        
                        // Reset operation state
                        currentNfcOperation = 'IDLE';
                        isWritingMode = false;
                        
                        // Clear any pending tag data
                        pendingTagData = null;
                    } catch (error) {
                        nfcScanAnimation.hide();
                        showStatus(`Error updating tag: ${error.message || error}`, true);
                        console.error(`Update Error:`, error);
                        currentNfcOperation = 'IDLE';
                        isWritingMode = false;
                        await NFC.stopNfcScan();
                    }
                },
                (error) => {
                    nfcScanAnimation.hide();
                    showStatus(`NFC error: ${error}`, true);
                    currentNfcOperation = 'IDLE';
                    isWritingMode = false;
                },
                'WRITE' // Specify WRITE mode
            );
        } catch (error) {
            nfcScanAnimation.hide();
            showStatus(`Failed to start NFC scan: ${error.message || error}`, true);
            currentNfcOperation = 'IDLE';
            isWritingMode = false;
        }
    } catch (error) {
        nfcScanAnimation.hide();
        showStatus(`Error preparing tag data: ${error.message || error}`, true);
        isWritingMode = false;
    }
}

// Show welcome/onboarding screen
function showWelcomeScreen() {
    appState = 'WELCOME';
    elements.tagForm.style.display = 'none';
    elements.welcomeSection.style.display = 'block';
    
    // Clear PIN cache when returning to welcome screen
    clearPinCache();
}

// Show tag form (either for creation or editing)
function showTagForm(isEditing = false) {
    appState = isEditing ? 'EDIT_TAG' : 'CREATE_TAG';
    
    elements.welcomeSection.style.display = 'none';
    elements.tagForm.style.display = 'block';
    
    // Update UI elements based on mode
    document.getElementById('form-title').textContent = isEditing ? 'Edit NFC Tag' : 'Create New NFC Tag';
    elements.submitButton.textContent = isEditing ? 'Update Tag' : 'Write to NFC Tag';
    
    // In edit mode, some fields might be read-only
    if (isEditing) {
        elements.ownerKey.readOnly = true;
    } else {
        elements.ownerKey.readOnly = false;
        resetFormFields();
    }
}

// Main scan function that handles both new and existing tags
async function scanTag() {
    if (!checkNfcSupport()) return;
    
    // Check if we're already in writing mode
    if (isWritingMode) {
        console.log('Already in writing mode, skipping read operation');
        return;
    }
    
    // Show scanning animation
    nfcScanAnimation.show('scan', 'Scanning NFC tag...');
    showStatus('Please bring the NFC tag to the back of your device');
    
    // Start NFC scanning with READ mode
    await NFC.startNfcScan(
        async ({ message, serialNumber }) => {
            // If we entered writing mode while waiting for a tag, abort the read operation
            if (isWritingMode) {
                console.log('Entered writing mode, aborting read operation');
                nfcScanAnimation.hide();
                await NFC.stopNfcScan();
                return;
            }
            
            try {
                // Try to parse as a vault tag
                const tagData = NFC.parseVaultTag(message);
                
                // Hide scanning animation
                nfcScanAnimation.hide();
                
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
                    showPinModal(
                        // On PIN submit
                        async (pin) => {
                            try {
                                await decryptAndLoadTag(pendingTagData, pin);
                                // Show edit form
                                showTagForm(true);
                            } catch (error) {
                                showStatus(`Error: ${error.message}`, true);
                                showWelcomeScreen();
                            }
                        },
                        // On PIN cancel
                        () => {
                            pendingTagData = null;
                            showStatus('Operation cancelled');
                            showWelcomeScreen();
                        }
                    );
                } else {
                    // It's a new tag
                    showStatus('New tag detected. You can now create content for this tag.');
                    showTagForm(false);
                }
            } catch (error) {
                nfcScanAnimation.hide();
                showStatus(`Error reading tag: ${error.message || error}`, true);
                showWelcomeScreen();
                await NFC.stopNfcScan();
            }
        },
        (error) => {
            nfcScanAnimation.hide();
            showStatus(error, true);
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
    elements.changePinSection.style.display = 'none';
}



// Patch NFC.parseVaultTag to handle writing mode
// Store original function
const originalParseVaultTag = NFC.parseVaultTag;

// Override the function
NFC.parseVaultTag = function(message, isWritingMode) {
  if (isWritingMode) {
    console.log('In write mode, skipping tag parsing');
    return null;
  }
  return originalParseVaultTag(message);
};