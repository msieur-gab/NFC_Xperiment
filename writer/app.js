// App state
let readers = [];
let contacts = [];
let currentOwnerToken = null;
let settings = {
    tokenFormat: 'readable',
    tokenLength: '12'
};

// Add a global state tracker for NFC operations
let nfcOperationState = {
    mode: 'IDLE', // Possible values: 'IDLE', 'READING', 'WRITING', 'UPDATING'
    tagData: null, // Store tag data when needed across operations
    ownerToken: null // Store owner token for authenticated operations
};

// Debug mode settings
let debugPanelVisible = false;
let logHistory = []; // Store logs even when debug panel is hidden
const MAX_LOG_HISTORY = 100; // Maximum number of log entries to keep
let ndef = null; // Store the NFC reader instance globally for debug access

// Debug logging - always log to history, only update UI when visible
function debugLog(message, type = 'info') {
    // Always add to log history
    const now = new Date();
    const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;
    
    // Create log entry
    const logEntry = {
        time: timeString,
        message: message,
        type: type
    };
    
    // Add to history
    logHistory.push(logEntry);
    
    // Trim history if needed
    if (logHistory.length > MAX_LOG_HISTORY) {
        logHistory = logHistory.slice(-MAX_LOG_HISTORY);
    }
    
    // Update debug console if visible
    if (debugPanelVisible) {
        updateDebugConsole(logEntry);
    }
    
    // Also log to browser console for dev tools
    console.log(`[${type.toUpperCase()}] ${message}`);
}

// Update debug console with new log entry
function updateDebugConsole(logEntry) {
    const debugConsole = document.getElementById('debug-console');
    if (!debugConsole) return;
    
    const logElement = document.createElement('div');
    logElement.className = `debug-log debug-log-${logEntry.type}`;
    logElement.innerHTML = `<span class="debug-log-time">${logEntry.time}</span> ${logEntry.message}`;
    
    debugConsole.appendChild(logElement);
    debugConsole.scrollTop = debugConsole.scrollHeight;
}

// Refresh the entire debug console with all history
function refreshDebugConsole() {
    const debugConsole = document.getElementById('debug-console');
    if (!debugConsole) return;
    
    // Clear console first
    debugConsole.innerHTML = '';
    
    // Add all history
    logHistory.forEach(entry => {
        updateDebugConsole(entry);
    });
}

// Initialize debug mode
function initDebugMode() {
    const debugToggle = document.getElementById('debug-mode-toggle');
    const debugPanel = document.getElementById('debug-panel');
    const clearDebugBtn = document.getElementById('clear-debug');
    const closeDebugBtn = document.getElementById('close-debug');
    
    // Set initial state
    debugPanelVisible = localStorage.getItem('nfc_debug_panel_visible') === 'true';
    debugToggle.checked = debugPanelVisible;
    debugPanel.style.display = debugPanelVisible ? 'block' : 'none';
    
    // Toggle debug panel visibility
    debugToggle.addEventListener('change', function() {
        debugPanelVisible = this.checked;
        localStorage.setItem('nfc_debug_panel_visible', debugPanelVisible);
        debugPanel.style.display = debugPanelVisible ? 'block' : 'none';
        
        // If showing panel, refresh with all history
        if (debugPanelVisible) {
            refreshDebugConsole();
            debugLog(`Debug panel shown with ${logHistory.length} log entries`, 'info');
        } else {
            debugLog(`Debug panel hidden, but logging continues`, 'info');
        }
    });
    
    // Clear button
    clearDebugBtn.addEventListener('click', function() {
        logHistory = [];
        document.getElementById('debug-console').innerHTML = '';
        debugLog('Debug log history cleared', 'info');
    });
    
    // Close button
    closeDebugBtn.addEventListener('click', function() {
        debugPanel.style.display = 'none';
        debugToggle.checked = false;
        debugPanelVisible = false;
        localStorage.setItem('nfc_debug_panel_visible', 'false');
        debugLog('Debug panel hidden, but logging continues', 'info');
    });
    
    debugLog("Debug system initialized", 'info');
}

// Initialize settings from localStorage
function initSettings() {
    const savedSettings = localStorage.getItem('nfc_writer_settings');
    if (savedSettings) {
        try {
            settings = JSON.parse(savedSettings);
            
            // Apply settings to UI
            document.getElementById('tokenFormat').value = settings.tokenFormat;
            document.getElementById('tokenLength').value = settings.tokenLength;
        } catch (e) {
            console.error('Failed to parse settings', e);
            debugLog(`Failed to parse settings: ${e}`, 'error');
        }
    }
}

// Save settings
function saveSettings() {
    settings.tokenFormat = document.getElementById('tokenFormat').value;
    settings.tokenLength = document.getElementById('tokenLength').value;
    
    localStorage.setItem('nfc_writer_settings', JSON.stringify(settings));
    showStatus('Settings saved successfully');
}

// Reset settings
function resetSettings() {
    settings = {
        tokenFormat: 'readable',
        tokenLength: '12'
    };
    
    document.getElementById('tokenFormat').value = settings.tokenFormat;
    document.getElementById('tokenLength').value = settings.tokenLength;
    
    localStorage.setItem('nfc_writer_settings', JSON.stringify(settings));
    showStatus('Settings reset to defaults');
}

// Tab functionality
function setupTabs() {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const tabContents = document.querySelectorAll('.tab-content');
            tabContents.forEach(content => content.classList.remove('active'));
            
            const tabName = tab.getAttribute('data-tab');
            const tabContent = document.getElementById(`${tabName}-tab`);
            if (tabContent) {
                tabContent.classList.add('active');
            }
            
            // Handle basic mode tab separately since it doesn't follow the same pattern
            if (tabName === 'basic') {
                // Just show whichever tag access section is currently active
                // This preserves the state of the basic mode view
            }
        });
    });
}

// Status message
function showStatus(message, isError = false) {
    const statusElement = document.getElementById('status-message');
    statusElement.innerHTML = `<div class="${isError ? 'error' : 'status'}">${message}</div>`;
    
    debugLog(`Status: ${message}`, isError ? 'error' : 'info');
    
    // Clear after 5 seconds
    setTimeout(() => {
        statusElement.innerHTML = '';
    }, 5000);
}

// Update operation status - specific to tag operations
function updateOperationStatus(message, isSuccess = true) {
    const statusElement = document.getElementById('tag-operation-status');
    if (!statusElement) return;
    
    if (isSuccess) {
        statusElement.innerHTML = `
            <div class="success-notification">
                <div class="success-icon">✓</div>
                <div class="success-message">
                    <h3>Operation Successful</h3>
                    <p>${message}</p>
                </div>
            </div>
        `;
    } else {
        statusElement.innerHTML = `
            <div class="error">
                <p>${message}</p>
            </div>
        `;
    }
    
    // Log the operation status
    debugLog(`Operation Status: ${message}`, isSuccess ? 'success' : 'error');
}

// Generate token based on settings
function generateToken() {
    const format = settings.tokenFormat;
    const length = parseInt(settings.tokenLength);
    
    if (format === 'readable') {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            if (i > 0 && i % 4 === 0) result += '-';
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    } else {
        return CryptoJS.lib.WordArray.random(length / 2).toString();
    }
}

// Generate owner token
function generateOwnerToken() {
    document.getElementById('ownerToken').value = generateToken();
}

// Add a new reader to current session
function addReader() {
    const readerId = prompt("Enter Reader ID:");
    if (!readerId) return;
    
    // Ask if they want to generate or enter a token
    const generateOrEnter = confirm("Click OK to auto-generate a token, or Cancel to enter manually");
    
    let readerToken;
    if (generateOrEnter) {
        readerToken = generateToken();
    } else {
        readerToken = prompt("Enter Reader Token:");
        if (!readerToken) return;
    }
    
    readers.push({ id: readerId, token: readerToken });
    updateReadersList();
    showStatus(`Reader "${readerId}" added`);
}

// Update the readers list in the UI
function updateReadersList() {
    const list = document.getElementById('readersList');
    list.innerHTML = '';
    
    if (readers.length === 0) {
        list.innerHTML = '<p>No readers added yet.</p>';
        return;
    }
    
    readers.forEach((reader, index) => {
        const readerDiv = document.createElement('div');
        readerDiv.className = 'reader-item';
        readerDiv.innerHTML = `
            <div class="reader-info">
                <strong>${reader.id}</strong><br>
                <span class="token-display">${reader.token}</span>
            </div>
            <div class="reader-actions">
                <button class="danger" onclick="removeReader(${index})">Remove</button>
            </div>
        `;
        list.appendChild(readerDiv);
    });
}

// Remove a reader
function removeReader(index) {
    const confirmRemove = confirm(`Remove reader "${readers[index].id}"?`);
    if (confirmRemove) {
        readers.splice(index, 1);
        updateReadersList();
        showStatus('Reader removed');
    }
}

// Show preview of the NFC tag data
function showTagPreview() {
    const ownerToken = document.getElementById('ownerToken').value;

    if (!ownerToken) {
        showStatus('Owner token is required', true);
        return;
    }

    // Create NFC tag payload
    const nfcPayload = {
        owner: {
            id: "owner",
            token: ownerToken
        },
        readers: readers.map(reader => ({
            id: reader.id,
            token: reader.token
        })),
        timestamp: Date.now()
    };
    
    // Encrypt the payload
    const encryptedPayload = CryptoJS.AES.encrypt(
        JSON.stringify(nfcPayload),
        ownerToken
    ).toString();
    
    // Create wrapper
    const tagData = {
        type: "encrypted_nfc_multi_user",
        version: "1.0",
        data: encryptedPayload
    };

    const previewElement = document.getElementById('preview-content');
    
    // Show both encrypted and decrypted views
    previewElement.innerHTML = `
        <h4>Encrypted Data (This is what will be written to tag):</h4>
        <pre style="background-color: #f3f4f6; padding: 10px; overflow-x: auto;">${JSON.stringify(tagData, null, 2)}</pre>
        
        <h4 style="margin-top: 15px;">Decrypted Data (Only visible with correct token):</h4>
        <pre style="background-color: #f3f4f6; padding: 10px; overflow-x: auto;">${JSON.stringify(nfcPayload, null, 2)}</pre>
    `;
    document.getElementById('tagPreview').style.display = 'block';
    
    debugLog('Generated tag preview', 'info');
}

// Master NFC handler that handles all NFC operations based on current state
async function startNFCOperation(operation = 'READ', contextData = null) {
    if (!('NDEFReader' in window)) {
        showStatus("NFC not supported on this device", true);
        debugLog("NFC not supported on this device", "error");
        return;
    }

    // Update global state
    nfcOperationState.mode = operation;
    if (contextData) {
        if (contextData.tagData) nfcOperationState.tagData = contextData.tagData;
        if (contextData.ownerToken) nfcOperationState.ownerToken = contextData.ownerToken;
    }
    
    debugLog(`Starting NFC operation: ${operation}`, 'info');
    if (contextData) {
        debugLog(`Operation context: ${JSON.stringify({
            hasTagData: !!contextData.tagData,
            hasOwnerToken: !!contextData.ownerToken,
            readerCount: contextData.tagData ? contextData.tagData.readers.length : 0
        })}`, 'info');
    }
    
    // Show scanning animation with appropriate instructions
    const scanningElement = document.getElementById('scanning-animation');
    scanningElement.style.display = 'block';
    
    // Clear any previous writing class
    scanningElement.classList.remove('writing');
    
    if (operation === 'WRITING') {
        document.querySelector('#scanning-animation p').textContent = 'Please bring the NFC tag to the back of your phone to write...';
        showStatus('<span class="write-mode">WRITE MODE</span> Place tag against your device');
    } else if (operation === 'UPDATING') {
        document.querySelector('#scanning-animation p').textContent = 'Ready to update tag with new readers...';
        showStatus('<span class="write-mode">UPDATE MODE</span> Place the same tag back against your device');
        // Clear previous operation status
        const statusElement = document.getElementById('tag-operation-status');
        if (statusElement) statusElement.innerHTML = '';
    } else {
        document.querySelector('#scanning-animation p').textContent = 'Waiting for NFC tag...';
        showStatus('<span class="read-mode">READ MODE</span> Place tag against your device');
    }
    
    try {
        // Stop existing NFC reader if active
        if (ndef) {
            try {
                await ndef.stop();
                debugLog('Stopped previous NFC reader', 'info');
            } catch (stopError) {
                debugLog(`Error stopping previous NFC reader: ${stopError}`, 'warning');
            }
        }
        
        // Create new NFC reader
        ndef = new NDEFReader();
        
        debugLog('Created new NDEFReader instance', 'info');
        
        // Set up central NFC tag detection handler
        ndef.addEventListener("reading", async ({ message, serialNumber }) => {
            debugLog(`Tag detected in ${operation} mode. Serial: ${serialNumber}`, 'info');
            
            // Handle the tag based on current operation state
            switch (nfcOperationState.mode) {
                case 'WRITING':
                    await handleTagInWriteMode(ndef, message, serialNumber);
                    break;
                case 'UPDATING':
                    await handleTagInUpdateMode(ndef, message, serialNumber);
                    break;
                default: // 'READING' or other states default to read
                    await handleTagInReadMode(message, serialNumber);
            }
        });
        
        // Log error events
        ndef.addEventListener("error", (error) => {
            debugLog(`NFC error: ${error}`, 'error');
        });
        
        // Start scanning
        await ndef.scan();
        debugLog('NFC scanning started', 'info');
        
    } catch (error) {
        document.getElementById('scanning-animation').style.display = 'none';
        showStatus(`Error with NFC: ${error}`, true);
        debugLog(`NFC initialization error: ${error}`, 'error');
        // Reset state on error
        nfcOperationState.mode = 'IDLE';
    }
}

// Handle tag in write mode (new tag)
async function handleTagInWriteMode(ndef, message, serialNumber) {
    debugLog(`Handling tag in WRITE mode. Serial: ${serialNumber}`, 'info');
    
    // Check if the tag has any existing data
    let hasAnyData = message.records && message.records.length > 0;
    let isOurFormat = false;
    
    if (hasAnyData) {
        debugLog(`Tag has ${message.records.length} records`, 'info');
        
        // Check if it matches our format
        for (const record of message.records) {
            if (record.recordType === "text") {
                try {
                    const textDecoder = new TextDecoder();
                    const text = textDecoder.decode(record.data);
                    debugLog(`Text record: ${text.substring(0, 50)}...`, 'info');
                    try {
                        const data = JSON.parse(text);
                        if (data.type === "encrypted_nfc_multi_user") {
                            isOurFormat = true;
                            debugLog(`Recognized our tag format`, 'info');
                            break;
                        }
                    } catch (jsonError) {
                        debugLog(`Not JSON data: ${jsonError}`, 'warning');
                    }
                } catch (e) {
                    debugLog(`Error decoding text: ${e}`, 'error');
                }
            } else {
                debugLog(`Record type: ${record.recordType}`, 'info');
            }
        }
    } else {
        debugLog(`Tag appears to be empty`, 'info');
    }
    
    // If it has data, confirm overwrite
    if (hasAnyData) {
        let confirmMessage = isOurFormat ? 
            "This tag already contains encrypted data from this app. Do you want to overwrite it?" :
            "This tag contains data in an unknown format. Overwriting will erase all existing data on the tag. Continue?";
        
        debugLog(`Asking for confirmation: ${confirmMessage}`, 'info');
        
        const confirmOverwrite = confirm(confirmMessage);
        if (!confirmOverwrite) {
            document.getElementById('scanning-animation').style.display = 'none';
            showStatus("Writing cancelled - existing data preserved", true);
            debugLog("User cancelled writing", 'info');
            nfcOperationState.mode = 'IDLE';
            return;
        }
    }
    
    try {
        // Show writing animation
        const scanningElement = document.getElementById('scanning-animation');
        scanningElement.classList.add('writing');
        document.querySelector('#scanning-animation p').textContent = 'Writing tag...';
        
        debugLog("About to write tag data", 'info');
        
        await writeTagData(ndef);
        document.getElementById('scanning-animation').style.display = 'none';
        
        debugLog("Tag successfully written", 'success');
        
        // Show success notification
        const statusElement = document.getElementById('status-message');
        statusElement.innerHTML = `
            <div class="success-notification">
                <div class="success-icon">✓</div>
                <div class="success-message">
                    <h3>Tag Successfully Written!</h3>
                    <p>Your NFC tag has been initialized with your settings.</p>
                    <p>Owner token: ${document.getElementById('ownerToken').value}</p>
                    <p>Number of readers: ${readers.length}</p>
                </div>
            </div>
        `;
        
        // Make this message stay visible longer (10 seconds)
        setTimeout(() => {
            if (statusElement.querySelector('.success-notification')) {
                statusElement.innerHTML = '';
            }
        }, 10000);
        
    } catch (error) {
        document.getElementById('scanning-animation').style.display = 'none';
        showStatus(`❌ Error writing to tag: ${error}`, true);
        debugLog(`Write error: ${error}`, 'error');
    }
    
    // Reset state
    nfcOperationState.mode = 'IDLE';
}

// Handle tag in update mode (adding readers to existing tag)
async function handleTagInUpdateMode(ndef, message, serialNumber) {
    debugLog(`Handling tag in UPDATE mode. Serial: ${serialNumber}`, 'info');
    
    try {
        // We already have the tag data and owner token in the state
        const tagData = nfcOperationState.tagData;
        const ownerToken = nfcOperationState.ownerToken;
        
        if (!tagData || !ownerToken) {
            throw new Error("Missing tag data or owner token");
        }
        
        debugLog(`Update context: owner token present, tag data has ${tagData.readers ? tagData.readers.length : 0} readers`, 'info');
        
        // Show writing status - more prominent
        const scanningElement = document.getElementById('scanning-animation');
        scanningElement.classList.add('writing');
        document.querySelector('#scanning-animation p').textContent = 'Writing to tag...';
        showStatus('<span class="write-mode">WRITING...</span> Updating tag with new readers');
        
        // Encrypt the updated data
        const encryptedPayload = CryptoJS.AES.encrypt(
            JSON.stringify(tagData),
            ownerToken
        ).toString();
        
        debugLog("Encrypted updated payload", 'info');
        
        // Create wrapper
        const newTagData = {
            type: "encrypted_nfc_multi_user",
            version: "1.0",
            data: encryptedPayload
        };
        
        // Get the current URL (without query parameters) to use as the app URL
        const appUrl = window.location.origin + window.location.pathname;
        
        debugLog(`About to write updated tag data with ${tagData.readers.length} readers`, 'info');
        
        const writeStartTime = Date.now();
        
        // Write directly without further confirmation since we're in update mode
        await ndef.write({
            records: [
                {
                    recordType: "text",
                    data: JSON.stringify(newTagData)
                },
                {
                    recordType: "url",
                    data: appUrl + "?action=read"
                }
            ]
        });
        
        const writeEndTime = Date.now();
        debugLog(`Tag updated in ${writeEndTime - writeStartTime}ms`, 'success');
        
        // Update UI with a more persistent and visible success message
        document.getElementById('scanning-animation').style.display = 'none';
        
        // Show success in the status message
        showStatus(`✅ Tag successfully updated with ${tagData.readers.length} readers!`);
        
        // Create a persistent success notification in the operation status area
        updateOperationStatus(`Tag successfully updated with ${tagData.readers.length} readers!`, true);
        
        // Also, let's add a permanent record in the UI
        const manageSection = document.getElementById('manage-tag-section');
        const lastUpdateInfo = document.createElement('div');
        lastUpdateInfo.className = 'last-update-info';
        lastUpdateInfo.innerHTML = `
            <p>Tag last updated: ${new Date().toLocaleTimeString()} (${tagData.readers.length} readers)</p>
        `;
        
        // Replace any existing update info or add new one
        const existingInfo = manageSection.querySelector('.last-update-info');
        if (existingInfo) {
            existingInfo.replaceWith(lastUpdateInfo);
        } else {
            manageSection.appendChild(lastUpdateInfo);
        }
        
        // Try to stop the NFC reader
        try {
            await ndef.stop();
            debugLog('Stopped NFC reader after update', 'info');
        } catch (stopError) {
            debugLog(`Error stopping NFC reader: ${stopError}`, 'warning');
        }
        
    } catch (error) {
        document.getElementById('scanning-animation').style.display = 'none';
        // More detailed error message
        const errorMessage = `Error updating tag: ${error.message || error}. Please try again.`;
        showStatus(`❌ ${errorMessage}`, true);
        updateOperationStatus(errorMessage, false);
        debugLog(`Update error: ${error}`, 'error');
    }
    
    // Reset state
    nfcOperationState.mode = 'IDLE';
}

// Handle tag in read mode
async function handleTagInReadMode(message, serialNumber) {
    debugLog(`Handling tag in READ mode. Serial: ${serialNumber}`, 'info');
    
    document.getElementById('scanning-animation').style.display = 'none';
    
    // Process the message
    processNFCTag(message);
    
    // Reset state
    nfcOperationState.mode = 'IDLE';
}

// Write the tag data using current UI state
async function writeTagData(ndef) {
    const ownerToken = document.getElementById('ownerToken').value;

    if (!ownerToken) {
        showStatus('Owner token is required', true);
        return;
    }

    debugLog(`Preparing tag data with owner token and ${readers.length} readers`, 'info');
    
    // Create NFC tag payload
    const nfcPayload = {
        owner: {
            id: "owner",
            token: ownerToken
        },
        readers: readers.map(reader => ({
            id: reader.id,
            token: reader.token
        })),
        timestamp: Date.now()
    };
    
    // Encrypt the payload with the owner's token as the key
    const encryptedPayload = CryptoJS.AES.encrypt(
        JSON.stringify(nfcPayload),
        ownerToken
    ).toString();
    
    // Create a wrapper object
    const tagData = {
        type: "encrypted_nfc_multi_user",
        version: "1.0",
        data: encryptedPayload
    };
    
    // Get the current URL (without query parameters) to use as the app URL
    const appUrl = window.location.origin + window.location.pathname;

    debugLog("Writing tag data...", 'info');
    
    // Write to NFC tag
    try {
        await ndef.write({
            records: [
                {
                    recordType: "text",
                    data: JSON.stringify(tagData)
                },
                {
                    recordType: "url",
                    data: appUrl + "?action=read"
                }
            ]
        });
        debugLog("Write operation completed successfully", 'success');
        return true;
    } catch (error) {
        debugLog(`Write operation failed: ${error}`, 'error');
        throw error;
    }
}

// Process an NFC tag and determine the correct UI to show
async function processNFCTag(message) {
    debugLog("Processing NFC tag message", 'info');
    
    // Check if the tag has any records
    if (!message.records || message.records.length === 0) {
        debugLog("No records found on tag", 'info');
        switchToCreateNewTagUI();
        return;
    }
    
    let tagData = null;
    let hasURLRecord = false;
    let urlTarget = '';
    let isOurFormat = false;
    
    // Log all records for debugging
    debugLog(`Found ${message.records.length} records on tag`, 'info');
    
    // Examine all records on the tag
    for (const record of message.records) {
        debugLog(`Record type: ${record.recordType}`, 'info');
        
        if (record.recordType === "text") {
            try {
                const textDecoder = new TextDecoder();
                const text = textDecoder.decode(record.data);
                debugLog(`Text record content: ${text.substring(0, 50)}...`, 'info');
                
                try {
                    tagData = JSON.parse(text);
                    debugLog("Successfully parsed JSON data from tag", 'info');
                    
                    // Check if it's our format
                    if (tagData && tagData.type === "encrypted_nfc_multi_user") {
                        isOurFormat = true;
                        debugLog("Recognized our encrypted format", 'success');
                    }
                } catch (jsonError) {
                    debugLog(`Failed to parse JSON: ${jsonError}`, 'warning');
                }
            } catch (e) {
                debugLog(`Error decoding text data: ${e}`, 'error');
            }
        } else if (record.recordType === "url") {
            hasURLRecord = true;
            const textDecoder = new TextDecoder();
            urlTarget = textDecoder.decode(record.data);
            debugLog(`URL record found: ${urlTarget}`, 'info');
        }
    }
    
    // CASE 1: Tag has our encrypted format
    if (isOurFormat) {
        debugLog("Processing tag with our encrypted format", 'info');
        showStatus("Encrypted tag detected");
        
        // Show token entry UI
        switchToTokenEntryUI(tagData);
        return;
    }
    
    // CASE 2: Tag has some data but not our format
    if (tagData || hasURLRecord) {
        debugLog("Tag has data but not in our format", 'warning');
        showStatus("Found tag with existing data", true);
        
        // Show confirmation dialog with more information
        if (confirm("This tag contains data in a format not recognized by this app. Would you like to create a new tag? (This will erase existing data when you write to the tag)")) {
            switchToCreateNewTagUI();
        }
        return;
    }
    
    // CASE 3: Tag appears to be empty or we couldn't read any meaningful data
    debugLog("Tag appears to be empty", 'info');
    showStatus("Empty tag detected");
    switchToCreateNewTagUI();
}

// Switch to token entry UI for existing encrypted tags
function switchToTokenEntryUI(tagData) {
    debugLog("Switching to token entry UI", 'info');
    
    // Hide other UI sections
    document.getElementById('create-tag-section').style.display = 'none';
    document.getElementById('manage-tag-section').style.display = 'none';
    
    // Show token entry section
    const tokenSection = document.getElementById('token-entry-section');
    tokenSection.style.display = 'block';
    
    // Clear previous token input
    document.getElementById('accessToken').value = '';
    
    // Store the encrypted data for later use
    tokenSection.dataset.encryptedData = JSON.stringify(tagData);
    
    // Set up the access button
    document.getElementById('accessButton').onclick = () => {
        const token = document.getElementById('accessToken').value;
        if (!token) {
            showStatus("Please enter a token", true);
            return;
        }
        
        // Try to decrypt and access the tag
        accessTag(tagData, token);
    };
}

// Rest of the code remains the same...

// Initialize the app
function initApp() {
    // Setup debug mode
    initDebugMode();
    debugLog("Initializing app...", 'info');
    
    // Setup tabs
    setupTabs();
    
    // Initialize settings
    initSettings();
    
    // Check for URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');
    
    if (action === 'read') {
        // Auto-start scanning if launched from a tag
        debugLog("Auto-starting scan from URL parameter", 'info');
        startNFCOperation('READING');
    } else {
        // Default to create new tag UI
        switchToCreateNewTagUI();
    }
    
    // Check for NFC support
    if (!('NDEFReader' in window)) {
        debugLog("NFC not supported on this device", 'error');
        showStatus("NFC is not supported on this device or browser. Some features may not work.", true);
    } else {
        debugLog("NFC is supported on this device", 'success');
    }
    
    debugLog("App initialization complete", 'success');
}

// Call initApp when the page loads
window.addEventListener('load', initApp);
