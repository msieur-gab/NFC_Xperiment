/**
 * NFC Vault Main Application
 * Main controller that integrates all modules with state management
 */

// Import modules
import * as Crypto from './crypto.js';
import * as NFC from './nfc.js';
import * as UI from './ui.js';
import { NFCStateManager, NFC_OPERATION, APP_STATE, TAG_TYPE } from './state-manager.js';

// State variables
let readers = [];
let currentPinCallback = null;
let currentCancelCallback = null;

// Component references
let toast;
let nfcScanAnimation;
let pinInput;

// DOM Elements
const elements = {};

// Initialize the state manager
let stateManager;

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    // Initialize custom components first
    initializeComponents();
    
    // Initialize DOM elements
    initializeElements();
    
    // Initialize state manager
    initializeStateManager();
    
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
    
    // Get NFC scan animation component
    nfcScanAnimation = document.getElementById('scanning-animation');
    
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

// Initialize state manager
function initializeStateManager() {
    const callbacks = {
        onAppStateChange: handleAppStateChange,
        onTagTypeChange: handleTagTypeChange
    };
    
    stateManager = new NFCStateManager(callbacks, elements);
    
    // Subscribe to state changes
    stateManager.subscribe((property, newValue, oldValue) => {
        console.debug(`State changed: ${property}`, newValue);
        
        // Handle specific state changes
        if (property === 'nfcOperation') {
            updateNfcOperationUI(newValue);
        }
    });
}

// Update UI based on NFC operation changes
function updateNfcOperationUI(operation) {
    // Update scanning animation based on operation
    if (operation === NFC_OPERATION.READING) {
        nfcScanAnimation.show('scan', 'Scanning NFC tag...');
    } else if (operation === NFC_OPERATION.WRITING) {
        nfcScanAnimation.show('write', 'Writing to NFC tag...');
    } else if (operation === NFC_OPERATION.UPDATING) {
        nfcScanAnimation.show('write', 'Updating NFC tag...');
    } else if (operation === NFC_OPERATION.IDLE) {
        // Explicitly hide animation when transitioning to IDLE
        nfcScanAnimation.hide();
    }
}

// Handle app state changes
function handleAppStateChange(newState, oldState) {
    // Update UI based on app state
    if (newState === APP_STATE.WELCOME) {
        elements.tagForm.style.display = 'none';
        elements.welcomeSection.style.display = 'block';
        elements.tagPreview.style.display = 'none';
    } else if (newState === APP_STATE.CREATE_TAG || newState === APP_STATE.EDIT_TAG) {
        const isEditing = newState === APP_STATE.EDIT_TAG;
        
        elements.welcomeSection.style.display = 'none';
        elements.tagForm.style.display = 'block';
        elements.tagPreview.style.display = 'none';
        
        // Update UI elements based on mode
        document.getElementById('form-title').textContent = isEditing ? 'Edit NFC Tag' : 'Create New NFC Tag';
        elements.submitButton.textContent = isEditing ? 'Update Tag' : 'Write to NFC Tag';
        
        // Show/hide the change PIN section based on mode
        elements.changePinSection.style.display = isEditing ? 'block' : 'none';
        
        // In edit mode, some fields might be read-only
        elements.ownerKey.readOnly = isEditing;
        
        // Reset form fields if creating new tag
        if (!isEditing) {
            resetFormFields();
        }
    }
}

// Handle tag type changes
function handleTagTypeChange(tagType, serialNumber) {
    if (tagType === TAG_TYPE.VAULT) {
        showStatus(`Detected NFC Vault tag: ${serialNumber || 'Unknown'}`, 'info');
    } else if (tagType === TAG_TYPE.EMPTY) {
        showStatus('Empty NFC tag detected. You can now create new content.', 'success');
    } else if (tagType === TAG_TYPE.INVALID) {
        showStatus('Invalid tag format detected. This tag contains data not compatible with NFC Vault.', 'warning');
    }
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
    // Set up the submit button handler
    elements.submitPinButton.onclick = handlePinSubmit;
    
    // Set up the cancel button handler
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
        showStatus('Please enter a PIN', 'error');
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
        showStatus("NFC is not supported on this device or browser.", 'error');
    }
    
    return supported;
}

// Show status message with toast notification
function showStatus(message, type = 'info') {
    // Always use standard status display first
    UI.showStatus(message, type === 'error');
    
    // Also show toast when available with proper type
    if (toast) {
        switch (type) {
            case 'success':
                toast.success(message);
                break;
            case 'error':
                toast.error(message);
                break;
            case 'warning':
                toast.warning(message);
                break;
            case 'info':
            default:
                toast.info(message);
                break;
        }
    }
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
        showStatus(`Reader "${readerId}" already exists`, 'error');
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
    showStatus(`Reader "${readerId}" added`, 'success');
}

// Remove a reader
function removeReader(index) {
    const confirmRemove = confirm(`Remove reader "${readers[index].id}"?`);
    if (confirmRemove) {
        const readerName = readers[index].id;
        readers.splice(index, 1);
        UI.updateReadersList(readers, 'readersList', removeReader);
        showStatus(`Reader "${readerName}" removed`, 'success');
    }
}

// Show tag data preview
function showTagPreview() {
    const ownerKey = elements.ownerKey.value;
    const ownerPin = elements.ownerPin.value;

    if (!ownerKey || !ownerPin) {
        showStatus('Owner key and PIN are required', 'error');
        return;
    }

    if (readers.length === 0) {
        showStatus('Please add at least one reader', 'warning');
        return;
    }

    // Generate a sample tag structure
    prepareTagDataStructure(ownerKey, ownerPin)
        .then(tagData => {
            // Show preview
            UI.showTagPreview(tagData, ownerKey, ownerPin, readers);
            elements.tagPreview.style.display = 'block';
        })
        .catch(error => {
            showStatus(`Error preparing tag data: ${error.message}`, 'error');
        });
}

// Prepare tag data structure with encryption
async function prepareTagDataStructure(ownerKey, ownerPin, useExistingIV = false) {
    // Get current tag data from state manager
    const currentTagData = stateManager.currentTagData;
    
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
    
    // Encrypt owner data - using PIN directly as key
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
        showStatus('Owner key and PIN are required', 'error');
        return;
    }
    
    if (readers.length === 0) {
        showStatus('Please add at least one reader', 'warning');
        return;
    }
    
    // Check if we can start writing
    if (!stateManager.canStartOperation(NFC_OPERATION.WRITING)) {
        showStatus(`Cannot start writing while in ${stateManager.nfcOperation} state`, 'error');
        return;
    }
    
    try {
        // Prepare tag data
        const tagData = await prepareTagDataStructure(ownerKey, ownerPin);
        
        // Prepare records for writing
        const records = NFC.prepareTagRecords(tagData);
        
        // Start NFC operation
        stateManager.startWriting(false);
        
        // Show status message
        showStatus('Please bring the NFC tag to the back of your device to write data', 'info');
        
        // Start NFC scanning
        await NFC.startNfcScan(
            async ({ message, serialNumber }) => {
                console.log(`Tag detected for writing. Serial: ${serialNumber}`);
                
                try {
                    // Write records to tag
                    await NFC.writeNfcTag(records);
                    
                    // Show success notification with toast
                    showStatus('Tag Created Successfully! Your NFC tag has been written with the new information.', 'success');
                    
                    // Also show success notification in UI
                    UI.showSuccessNotification(
                        'Tag Created Successfully', 
                        'Your NFC tag has been written with the new information.'
                    );
                    
                    // Stop scanning
                    await NFC.stopNfcScan();
                    // Hide the animation explicitly - THIS IS MISSING
                    nfcScanAnimation.hide();
                    
                    // Reset operation state
                    stateManager.finishOperation();
                } catch (error) {
                    showStatus(`Error writing to tag: ${error.message || error}`, 'error');
                    console.error(`Write Error:`, error);
                    stateManager.finishOperation();
                    await NFC.stopNfcScan();
                }
            },
            (error) => {
                showStatus(error, 'error');
                stateManager.finishOperation();
            },
            'WRITE' // Specify WRITE mode
        );
    } catch (error) {
        showStatus(`Error preparing tag data: ${error.message || error}`, 'error');
        stateManager.finishOperation();
    }
}

// Initialize the app based on URL parameters
function initializeApp() {
    // Check if we were launched from a tag scan
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');
    
    if (action === 'read') {
        // Start scanning immediately
        showStatus('Tag detected, scanning...', 'info');
        scanTag();
    } else {
        // Show welcome screen
        showWelcomeScreen();
    }
}

// Decrypt and load tag data with provided PIN
async function decryptAndLoadTag(tagData, pin) {
    try {
        // Get metadata and IV
        const ivBase64 = tagData.metadata.iv;
        showStatus(`Reading tag data...`, 'info');
        
        const iv = Crypto.base64ToArrayBuffer(ivBase64);
        
        // Try to decrypt owner key
        const ownerKey = await Crypto.decrypt(tagData.owner.k, pin, iv);
        
        if (!ownerKey) {
            showStatus(`Invalid PIN - cannot decrypt tag. Please check your PIN.`, 'error');
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
        stateManager.setCurrentTagData(tagData);
        
        // Update UI for edit mode
        elements.ownerKey.value = ownerKey;
        UI.updateReadersList(readers, 'readersList', removeReader);
        
        showStatus("Tag successfully decrypted and loaded", 'success');
        
        // Reset operation state
        stateManager.finishOperation();
        
        // If decryption was successful, cache the PIN temporarily
        stateManager.cachePin(pin);
        
        return true;
    } catch (error) {
        showStatus(`Decryption error: ${error.message}`, 'error');
        throw error;
    }
}

// Update an existing tag
async function updateExistingTag() {
    if (!checkNfcSupport()) return;
    
    if (!stateManager.currentTagData) {
        showStatus('No tag data loaded', 'error');
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
            showStatus(`Error: ${error.message}`, 'error');
        }
        return;
    }
    
    // If we have a cached PIN, use it without prompting
    if (stateManager.hasCachedPin()) {
        try {
            await performTagUpdate(ownerKey, stateManager.getCachedPin());
            // PIN already cached in state manager, no need to re-cache
        } catch (error) {
            showStatus(`Error: ${error.message}`, 'error');
            // If there was an error, maybe the PIN is wrong, so clear it
            stateManager.clearPinCache();
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
                stateManager.cachePin(pin);
            } catch (error) {
                showStatus(`Error: ${error.message}`, 'error');
            }
        },
        // On PIN cancel
        () => {
            showStatus('Update cancelled', 'info');
        }
    );
}

// Perform tag update with given PIN
async function performTagUpdate(ownerKey, pin) {
    // Check if we can start updating
    if (!stateManager.canStartOperation(NFC_OPERATION.UPDATING)) {
        showStatus(`Cannot start updating while in ${stateManager.nfcOperation} state`, 'error');
        return;
    }
    
    // Start update operation
    stateManager.startWriting(true); // true = update mode
    
    // Show status message
    showStatus('Please bring the same NFC tag to the back of your device', 'info');
    
    try {
        // Prepare updated tag data structure
        const tagData = await prepareTagDataStructure(ownerKey, pin, true);
        
        // Prepare records for writing
        const records = NFC.prepareTagRecords(tagData);
        
        // Make sure any existing NFC scan is stopped
        try {
            await NFC.stopNfcScan();
            console.log('Stopped existing NFC scan');
        } catch (e) {
            console.log('No active NFC scan to stop');
        }
        
        // Wait a moment to ensure NFC system is reset
        await new Promise(resolve => setTimeout(resolve, 500));
        
        try {
            console.log('Starting NFC scan for updating...');
            // Initialize NFC reader
            await NFC.startNfcScan(
                async ({ message, serialNumber }) => {
                    console.log(`Tag detected for updating. Serial: ${serialNumber}`);
                    
                    try {
                        // Write records to tag
                        await NFC.writeNfcTag(records);
                        
                        // Show success notification with toast
                        showStatus('Tag Updated Successfully! Your NFC tag has been updated with the new information.', 'success');
                        
                        // Also show success notification in UI
                        UI.showSuccessNotification(
                            'Tag Updated Successfully', 
                            'Your NFC tag has been updated with the new information.'
                        );
                        
                        // Update current tag data
                        stateManager.setCurrentTagData(tagData);
                        
                        // Stop scanning
                        await NFC.stopNfcScan();
                        
                        // Reset operation state
                        stateManager.finishOperation();
                    } catch (error) {
                        showStatus(`Error updating tag: ${error.message || error}`, 'error');
                        console.error(`Update Error:`, error);
                        stateManager.finishOperation();
                        await NFC.stopNfcScan();
                    }
                },
                (error) => {
                    showStatus(`NFC error: ${error}`, 'error');
                    stateManager.finishOperation();
                },
                'WRITE' // Specify WRITE mode
            );
        } catch (error) {
            showStatus(`Failed to start NFC scan: ${error.message || error}`, 'error');
            stateManager.finishOperation();
        }
    } catch (error) {
        showStatus(`Error preparing tag data: ${error.message || error}`, 'error');
        stateManager.finishOperation();
    }
}

// Show welcome/onboarding screen
function showWelcomeScreen() {
    stateManager.goToWelcome();
}

// Show tag form (either for creation or editing)
function showTagForm(isEditing = false) {
    if (isEditing) {
        stateManager.goToEditTag();
    } else {
        stateManager.goToCreateTag();
    }
}

// Main scan function that handles both new and existing tags
async function scanTag() {
    if (!checkNfcSupport()) return;
    
    // Check if we can start scanning
    if (!stateManager.canStartOperation(NFC_OPERATION.READING)) {
        showStatus(`Cannot start scanning while in ${stateManager.nfcOperation} state`, 'error');
        return;
    }
    
    // Start NFC reading operation
    stateManager.startReading();
    
    // Show status message
    showStatus('Please bring the NFC tag to the back of your device', 'info');
    
    // Start NFC scanning with READ mode
    await NFC.startNfcScan(
        async ({ message, serialNumber }) => {
            // If we're not in reading mode, abort (might have transitioned to writing)
            if (stateManager.nfcOperation !== NFC_OPERATION.READING) {
                console.log('No longer in reading mode, aborting read operation');
                await NFC.stopNfcScan();
                return;
            }
            
            try {
                // Try to parse as a vault tag
                const tagData = NFC.parseVaultTag(message, stateManager.isWritingMode);
                
                // Stop NFC scanning
                await NFC.stopNfcScan();
                
                // Process based on tag type
                if (tagData) {
                    // It's a recognized vault tag
                    stateManager.setTagType(TAG_TYPE.VAULT, serialNumber);
                    stateManager.setPendingTagData(tagData);
                    showStatus(`NFC Vault tag detected. Serial: ${serialNumber || 'Unknown'}`, 'info');
                    
                    // If we have a cached PIN, try to use it automatically
                    if (stateManager.hasCachedPin()) {
                        try {
                            const success = await decryptAndLoadTag(tagData, stateManager.getCachedPin());
                            if (success) {
                                // Show edit form
                                showTagForm(true);
                                return;
                            }
                        } catch (error) {
                            // If decryption fails with cached PIN, clear it and continue to PIN prompt
                            stateManager.clearPinCache();
                        }
                    }
                    
                    // Show PIN modal if no cached PIN or if cached PIN failed
                    showPinModal(
                        // On PIN submit
                        async (pin) => {
                            try {
                                const success = await decryptAndLoadTag(tagData, pin);
                                if (success) {
                                    // Show edit form
                                    showTagForm(true);
                                }
                            } catch (error) {
                                showStatus(`Error: ${error.message}`, 'error');
                                showWelcomeScreen();
                            }
                        },
                        // On PIN cancel
                        () => {
                            stateManager.setPendingTagData(null);
                            showStatus('Operation cancelled', 'info');
                            showWelcomeScreen();
                        }
                    );
                } else if (message.records && message.records.length > 0) {
                    // It has content but not in our format
                    stateManager.setTagType(TAG_TYPE.INVALID, serialNumber);
                    showStatus('This tag contains data not compatible with NFC Vault. You must clear this tag before using it.', 'warning');
                    stateManager.finishOperation();
                } else {
                    // It's an empty tag
                    stateManager.setTagType(TAG_TYPE.EMPTY, serialNumber);
                    showStatus('New empty tag detected. You can now create content for this tag.', 'success');
                    showTagForm(false);
                    stateManager.finishOperation();
                }
            } catch (error) {
                showStatus(`Error reading tag: ${error.message || error}`, 'error');
                stateManager.finishOperation();
                showWelcomeScreen();
            }
        },
        (error) => {
            showStatus(error, 'error');
            stateManager.finishOperation();
            showWelcomeScreen();
        },
        'READ' // Specify READ mode
    );
}

// Handle form submission (either create or update)
async function handleTagFormSubmit() {
    if (stateManager.appState === APP_STATE.EDIT_TAG) {
        await updateExistingTag();
    } else {
        await startNFCWrite();
    }
}

// Reset form fields
function resetFormFields() {
    elements.ownerKey.value = '';
    elements.ownerPin.value = '';
    elements.newPin.value = '';
    document.getElementById('readersList').innerHTML = '';
    readers = [];
}

// Export if needed for other modules
export {
    stateManager,
    scanTag,
    showTagForm,
    showWelcomeScreen
};