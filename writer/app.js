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

// Flag to track if a write operation is in progress
let isWriting = false;

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

// Safe NFC reader stop function
async function safeStopNFC(reader) {
    if (!reader) return;
    
    try {
        // Multiple methods to try stopping the NFC reader
        const stopMethods = [
            'stop',         // Standard method
            'stopScan',     // Alternative method
            'close',        // Generic close method
            'abortScan'     // Direct abort method
        ];
        
        let stopped = false;
        
        for (const method of stopMethods) {
            if (typeof reader[method] === 'function') {
                try {
                    await reader[method]();
                    debugLog(`Stopped NFC reader using ${method}()`, 'info');
                    stopped = true;
                    break;
                } catch (methodError) {
                    debugLog(`Error using ${method}(): ${methodError}`, 'warning');
                }
            }
        }
        
        // If no standard methods work, try an alternative approach
        if (!stopped) {
            // Some browsers might require manually removing event listeners
            if (reader.removeEventListener) {
                try {
                    reader.removeEventListener('reading', handleNFCReading);
                    reader.removeEventListener('error', handleNFCError);
                    debugLog('Removed NFC event listeners', 'info');
                } catch (listenerError) {
                    debugLog(`Error removing listeners: ${listenerError}`, 'warning');
                }
            }
            
            debugLog('No standard stop method available on this NFC reader', 'warning');
        }
    } catch (error) {
        debugLog(`Unexpected error stopping NFC reader: ${error}`, 'error');
    } finally {
        // Always reset the global NFC reader reference
        ndef = null;
    }
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
            await safeStopNFC(ndef);
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
            showStatus(`NFC error: ${error.message || error}`, true);
        });
        
        // Show permission request message before scanning
        showStatus('Requesting NFC permission...', false);
        
        // Start scanning
        try {
            await ndef.scan();
            debugLog('NFC scanning started', 'info');
            showStatus(`<span class="${operation === 'READING' ? 'read-mode' : 'write-mode'}">${operation} MODE</span> Place tag against your device`);
        } catch (scanError) {
            // Handle permission denied specifically
            if (scanError.name === 'NotAllowedError') {
                document.getElementById('scanning-animation').style.display = 'none';
                
                // Show a more helpful error message with instructions
                const permissionMessage = `
                    <div class="error-notification">
                        <div class="error-icon">!</div>
                        <div class="error-message">
                            <h3>NFC Permission Required</h3>
                            <p>This app needs permission to use your device's NFC reader.</p>
                            <p>Please check:</p>
                            <ul>
                                <li>NFC is enabled in your device settings</li>
                                <li>You've allowed this site to use NFC</li>
                                <li>You're using a supported browser (Chrome for Android)</li>
                            </ul>
                            <button onclick="requestNFCPermission()">Try Again</button>
                        </div>
                    </div>
                `;
                
                const statusElement = document.getElementById('status-message');
                statusElement.innerHTML = permissionMessage;
                
                debugLog('NFC permission denied by user or system', 'error');
                throw scanError;
            } else {
                // Re-throw other errors to be caught by the outer catch
                throw scanError;
            }
        }
        
    } catch (error) {
        document.getElementById('scanning-animation').style.display = 'none';
        
        if (error.name !== 'NotAllowedError') {
            // Only show generic error for non-permission errors (permission has its own UI)
            showStatus(`Error with NFC: ${error.message || error}`, true);
        }
        
        debugLog(`NFC initialization error: ${error}`, 'error');
        // Reset state on error
        nfcOperationState.mode = 'IDLE';
    }
}

// Function to request NFC permission again
function requestNFCPermission() {
    debugLog('User requested to try NFC permission again', 'info');
    
    // Clear previous error message
    document.getElementById('status-message').innerHTML = '';
    
    // Try to start NFC operation again
    startNFCOperation(nfcOperationState.mode || 'READING');
}

// Add CSS for error notification
document.head.insertAdjacentHTML('beforeend', `
<style>
.error-notification {
    display: flex;
    background-color: #fef2f2;
    border: 1px solid #ef4444;
    border-radius: 8px;
    padding: 15px;
    margin: 15px 0;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
}

.error-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    background-color: #ef4444;
    border-radius: 50%;
    color: white;
    font-size: 20px;
    font-weight: bold;
    margin-right: 15px;
    flex-shrink: 0;
}

.error-message {
    flex: 1;
}

.error-message h3 {
    margin: 0 0 5px 0;
    color: #ef4444;
}

.error-message p {
    margin: 0 0 10px 0;
    color: #374151;
}

.error-message ul {
    margin: 0 0 15px 0;
    padding-left: 20px;
}

.error-message li {
    margin-bottom: 5px;
}
</style>
`);

// Utility function to create a record for a reader
function createReaderRecord(reader) {
    return {
        recordType: "text",
        data: JSON.stringify({
            type: "reader",
            id: reader.id,
            token: reader.token
        })
    };
}

// Create the owner record
function createOwnerRecord(ownerToken) {
    return {
        recordType: "text",
        data: JSON.stringify({
            type: "owner",
            token: ownerToken
        })
    };
}

// Write tag data with multiple records
async function writeTagData(ndef) {
    const ownerToken = document.getElementById('ownerToken').value;

    if (!ownerToken) {
        showStatus('Owner token is required', true);
        return;
    }

    // Get the current URL (without query parameters) to use as the app URL
    const appUrl = window.location.origin + window.location.pathname;

    // Prepare records
    const records = [
        // First record is always the URL
        {
            recordType: "url",
            data: appUrl + "?action=read"
        },
        // Owner record
        createOwnerRecord(ownerToken)
    ];

    // Add reader records
    const readerRecords = readers.map(createReaderRecord);
    records.push(...readerRecords);

    // Log payload details for debugging
    debugLog('Preparing to write NFC tag', 'info');
    debugLog(`Total records: ${records.length}`, 'info');
    records.forEach((record, index) => {
        try {
            const recordSize = new Blob([record.data]).size;
            debugLog(`Record ${index + 1}: Type ${record.recordType}, Size ${recordSize} bytes`, 'info');
        } catch (sizeError) {
            debugLog(`Could not calculate record ${index + 1} size`, 'warning');
        }
    });

    try {
        // Attempt to write all records
        const writeStartTime = Date.now();
        
        await ndef.write({ records });

        const writeEndTime = Date.now();
        debugLog(`Tag write completed in ${writeEndTime - writeStartTime}ms`, 'success');
        
        return true;
    } catch (error) {
        debugLog(`Comprehensive write error: ${error}`, 'error');
        
        // Enhanced error feedback
        showStatus(`❌ Error writing to tag: ${error.message || error}`, true);
        throw error;
    }
}

// Handle tag in write mode (new tag)
async function handleTagInWriteMode(ndef, message, serialNumber) {
    debugLog(`Handling tag in WRITE mode. Serial: ${serialNumber}`, 'info');
    
    // Set writing flag to prevent multiple operations
    isWriting = true;
    
    // Extensive pre-write checks
    let hasAnyData = message.records && message.records.length > 0;
    let isOurFormat = false;
    let existingTagDetails = {
        recordCount: 0,
        recordTypes: [],
        potentialDataSizes: []
    };
    
    if (hasAnyData) {
        debugLog(`Existing tag has ${message.records.length} records`, 'info');
        
        // Detailed existing data logging
        for (const record of message.records) {
            try {
                // Log record type
                existingTagDetails.recordCount++;
                existingTagDetails.recordTypes.push(record.recordType);
                
                // Try to get record size
                try {
                    const recordSize = new Blob([record.data]).size;
                    existingTagDetails.potentialDataSizes.push(recordSize);
                    debugLog(`Record type: ${record.recordType}, Size: ${recordSize} bytes`, 'info');
                } catch (sizeError) {
                    debugLog(`Could not calculate record size: ${sizeError}`, 'warning');
                }
                
                // Attempt to decode text records
                if (record.recordType === "text") {
                    const textDecoder = new TextDecoder();
                    const text = textDecoder.decode(record.data);
                    
                    // Try to parse and log existing data structure
                    try {
                        const existingData = JSON.parse(text);
                        debugLog(`Existing record content type: ${existingData.type || 'Unknown'}`, 'info');
                        
                        if (existingData.type === "owner") {
                            isOurFormat = true;
                            debugLog('Recognized existing tag format', 'info');
                        }
                    } catch (parseError) {
                        debugLog(`Could not parse record content: ${parseError}`, 'warning');
                    }
                }
            } catch (decodeError) {
                debugLog(`Could not process record: ${decodeError}`, 'warning');
            }
        }
    } else {
        debugLog(`Tag appears to be empty`, 'info');
    }
    
    // If it has data, confirm overwrite
    if (hasAnyData) {
        // Prepare confirmation message based on tag contents
        let confirmMessage = isOurFormat ? 
            `This tag already contains data from this app (${existingTagDetails.recordCount} records). Overwrite?` :
            `This tag contains ${existingTagDetails.recordCount} records in an unknown format. Overwriting will erase all existing data. Continue?`;
        
        debugLog(`Asking for confirmation: ${confirmMessage}`, 'info');
        
        const confirmOverwrite = confirm(confirmMessage);
        if (!confirmOverwrite) {
            document.getElementById('scanning-animation').style.display = 'none';
            showStatus("Writing cancelled - existing data preserved", true);
            debugLog("User cancelled writing", 'info');
            nfcOperationState.mode = 'IDLE';
            isWriting = false;
            return;
        }
    }
    
    try {
        // Show writing animation
        const scanningElement = document.getElementById('scanning-animation');
        scanningElement.classList.add('writing');
        document.querySelector('#scanning-animation p').textContent = 'Writing tag...';
        
        debugLog("About to write tag data", 'info');
        
        // Comprehensive write attempt with detailed logging
        const writeStartTime = Date.now();
        
        try {
            await writeTagData(ndef);
        } catch (writeError) {
            // Detailed write error logging
            debugLog(`Write Error Details:`, 'error');
            debugLog(`- Error Name: ${writeError.name}`, 'error');
            debugLog(`- Error Message: ${writeError.message}`, 'error');
            
            // Specific error type handling
            if (writeError.name === 'NotSupportedError') {
                debugLog('The tag may not support this write operation', 'warning');
            } else if (writeError.name === 'SecurityError') {
                debugLog('Security restrictions prevented writing', 'warning');
            }
            
            // Throw to trigger catch block
            throw writeError;
        }
        
        const writeEndTime = Date.now();
        const writeDuration = writeEndTime - writeStartTime;
        
        document.getElementById('scanning-animation').style.display = 'none';
        
        debugLog(`Tag successfully written in ${writeDuration}ms`, 'success');
        
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
                    <p>Write duration: ${writeDuration}ms</p>
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
        
        // Comprehensive error handling
        const errorMessage = `❌ Error writing to tag: ${error.message || error}`;
        showStatus(errorMessage, true);
        
        debugLog(`Write Error: ${error}`, 'error');
        debugLog(`Existing tag details:`, 'info');
        debugLog(`- Record Count: ${existingTagDetails.recordCount}`, 'info');
        debugLog(`- Record Types: ${existingTagDetails.recordTypes.join(', ')}`, 'info');
        debugLog(`- Potential Data Sizes: ${existingTagDetails.potentialDataSizes.join(', ')} bytes`, 'info');
    } finally {
        // Always reset writing state
        nfcOperationState.mode = 'IDLE';
        isWriting = false;
    }
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
        
        // Get the current URL (without query parameters) to use as the app URL
        const appUrl = window.location.origin + window.location.pathname;
        
        // Prepare records
        const records = [
            // First record is always the URL
            {
                recordType: "url",
                data: appUrl + "?action=read"
            },
            // Owner record
            createOwnerRecord(ownerToken)
        ];
        
        // Add reader records
        const readerRecords = tagData.readers.map(createReaderRecord);
        records.push(...readerRecords);
        
        debugLog(`About to write updated tag data with ${tagData.readers.length} readers`, 'info');
        
        const writeStartTime = Date.now();
        
        // Write directly without further confirmation since we're in update mode
        await ndef.write({ records });
        
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
        await safeStopNFC(ndef);
        
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
    
    // Hide scanning animation
    document.getElementById('scanning-animation').style.display = 'none';
    
    // Check for any active sections before processing
    const activeSections = document.querySelectorAll('.tag-access-section[style*="display: block"]');
    if (activeSections.length === 0) {
        debugLog("No active UI section found before processing tag", 'warning');
    }
    
    // Process the message
    await processNFCTag(message);
    
    // Verify that some UI is visible after processing
    const visibleSections = document.querySelectorAll('.tag-access-section[style*="display: block"]');
    if (visibleSections.length === 0) {
        debugLog("ERROR: No UI section visible after processing tag!", 'error');
        // Force show create UI as fallback
        switchToCreateNewTagUI();
    } else {
        debugLog(`UI section visible after processing: ${visibleSections[0].id}`, 'info');
    }
    
    // Reset state
    nfcOperationState.mode = 'IDLE';
}

// Modified processNFCTag to handle multiple records
async function processNFCTag(message) {
    debugLog("Processing NFC tag message", 'info');
    
    // Check if the tag has any records
    if (!message.records || message.records.length === 0) {
        debugLog("No records found on tag - detected empty tag", 'info');
        showStatus("Empty tag detected - ready to create new tag");
        switchToCreateNewTagUI();
        
        // Add a clear message to the UI that this is an empty tag
        const statusElement = document.getElementById('status-message');
        statusElement.innerHTML = `
            <div class="success-notification">
                <div class="success-icon">✓</div>
                <div class="success-message">
                    <h3>Empty Tag Detected</h3>
                    <p>This tag is empty and ready to be written. Add readers and click "Write to NFC Tag" to initialize it.</p>
                </div>
            </div>
        `;
        return;
    }
    
    debugLog(`Found ${message.records.length} records on tag`, 'info');
    
    // Find and process specific record types
    let ownerRecord = null;
    let readerRecords = [];
    let hasURLRecord = false;
    let urlTarget = '';
    let isOurFormat = false;
    
    // Examine all records on the tag
    for (const record of message.records) {
        debugLog(`Record type: ${record.recordType}`, 'info');
        
        if (record.recordType === "url") {
            try {
                const textDecoder = new TextDecoder();
                urlTarget = textDecoder.decode(record.data);
                
                // Check if the URL actually contains data
                if (urlTarget && urlTarget.trim().length > 0) {
                    hasURLRecord = true;
                    debugLog(`URL record found: ${urlTarget}`, 'info');
                } else {
                    debugLog("Empty URL record found", 'warning');
                }
            } catch (e) {
                debugLog(`Error decoding URL data: ${e}`, 'error');
            }
        } else if (record.recordType === "text") {
            try {
                const textDecoder = new TextDecoder();
                const text = textDecoder.decode(record.data);
                debugLog(`Text record content: ${text.substring(0, 50)}...`, 'info');
                
                try {
                    const recordData = JSON.parse(text);
                    
                    // Process different record types
                    if (recordData.type === "owner") {
                        ownerRecord = recordData;
                        isOurFormat = true;
                        debugLog('Found owner record', 'info');
                    } else if (recordData.type === "reader") {
                        readerRecords.push(recordData);
                        isOurFormat = true;
                        debugLog(`Found reader record: ${recordData.id}`, 'info');
                    } else if (recordData.type === "encrypted_nfc_multi_user") {
                        // Handle legacy format for backward compatibility
                        debugLog("Found legacy encrypted format", 'info');
                        showStatus("Legacy encrypted tag detected");
                        switchToTokenEntryUI(recordData);
                        return;
                    } else {
                        debugLog(`Unknown record type: ${recordData.type}`, 'warning');
                    }
                } catch (jsonError) {
                    debugLog(`Failed to parse JSON: ${jsonError}`, 'warning');
                }
            } catch (e) {
                debugLog(`Error decoding text data: ${e}`, 'error');
            }
        }
    }
    
    // CASE 1: Tag has our format with owner and readers
    if (isOurFormat && ownerRecord) {
        debugLog("Processing tag with our multi-record format", 'info');
        showStatus("NFC tag detected");
        
        // Prepare tag data in the format expected by the UI
        const tagData = {
            owner: ownerRecord,
            readers: readerRecords
        };
        
        // Show token entry UI
        switchToTokenEntryUI(tagData);
        return;
    }
    
    // CASE 2: Tag has some data but not our format
    if (hasURLRecord || message.records.length > 0) {
        debugLog("Tag has data but not in our format", 'warning');
        showStatus("Found tag with existing data", true);
        
        // Show confirmation dialog with more information
        if (confirm("This tag contains data in a format not recognized by this app. Would you like to create a new tag? (This will erase existing data when you write to the tag)")) {
            switchToCreateNewTagUI();
        }
        return;
    }
    
    // Fallback: If we somehow get here, default to create new tag UI
    debugLog("Tag format not recognized - defaulting to create new tag UI", 'warning');
    showStatus("Tag format not recognized");
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

// Modify the accessTag function to work with new record structure
function accessTag(tagData, token) {
    debugLog(`Attempting to access tag with token`, 'info');
    
    try {
        // Handle legacy encrypted format
        if (tagData.type === "encrypted_nfc_multi_user") {
            debugLog("Processing legacy encrypted format", 'info');
            try {
                // Try to decrypt with provided token
                const decryptedBytes = CryptoJS.AES.decrypt(tagData.data, token);
                const decryptedData = JSON.parse(decryptedBytes.toString(CryptoJS.enc.Utf8));
                
                debugLog("Successfully decrypted legacy tag data", 'success');
                
                // Check if this token is the owner token
                if (decryptedData.owner && decryptedData.owner.token === token) {
                    debugLog("Owner access granted (legacy format)", 'success');
                    showStatus("Owner access granted!");
                    
                    // Switch to tag management UI with owner privileges
                    switchToManageTagUI(decryptedData, token, "owner");
                    return;
                } 
                // Check if this token is a reader token
                else if (decryptedData.readers && Array.isArray(decryptedData.readers)) {
                    const reader = decryptedData.readers.find(r => r.token === token);
                    
                    if (reader) {
                        debugLog(`Reader "${reader.id}" access granted (legacy format)`, 'success');
                        showStatus(`Reader "${reader.id}" access granted!`);
                        
                        // Switch to tag management UI with reader privileges
                        switchToManageTagUI(decryptedData, token, "reader", reader.id);
                        return;
                    }
                }
                
                // If we get here, token didn't match
                debugLog("Invalid token for legacy format - Access denied", 'error');
                showStatus("Invalid token - Access denied", true);
                return;
            } catch (error) {
                debugLog(`Legacy format access error: ${error}`, 'error');
                showStatus("Invalid token or corrupted tag data", true);
                return;
            }
        }
        
        // New multi-record format
        // Check if this token is the owner token
        if (tagData.owner && tagData.owner.token === token) {
            debugLog("Owner access granted", 'success');
            showStatus("Owner access granted!");
            
            // Switch to tag management UI with owner privileges
            switchToManageTagUI(tagData, token, "owner");
        } 
        // Check if this token is a reader token
        else if (tagData.readers && Array.isArray(tagData.readers)) {
            const reader = tagData.readers.find(r => r.token === token);
            
            if (reader) {
                debugLog(`Reader "${reader.id}" access granted`, 'success');
                showStatus(`Reader "${reader.id}" access granted!`);
                
                // Switch to tag management UI with reader privileges
                switchToManageTagUI(tagData, token, "reader", reader.id);
            } else {
                debugLog("Invalid token - Access denied", 'error');
                showStatus("Invalid token - Access denied", true);
            }
        } else {
            debugLog("Invalid tag format", 'error');
            showStatus("Invalid tag format", true);
        }
    } catch (error) {
        debugLog(`Access error: ${error}`, 'error');
        showStatus("Invalid token or corrupted tag data", true);
    }
}

// Switch to UI for managing an existing tag
function switchToManageTagUI(tagData, token, accessLevel, readerId = null) {
    debugLog(`Switching to tag management UI with ${accessLevel} access`, 'info');
    
    // Hide other UI sections
    document.getElementById('create-tag-section').style.display = 'none';
    document.getElementById('token-entry-section').style.display = 'none';
    
    // Show manage section
    const manageSection = document.getElementById('manage-tag-section');
    manageSection.style.display = 'block';
    
    // Update UI based on access level
    if (accessLevel === "owner") {
        // Owner can see and modify everything
        document.getElementById('owner-controls').style.display = 'block';
        document.getElementById('reader-controls').style.display = 'none';
        
        // Show owner info
        document.getElementById('owner-id').textContent = tagData.owner.id;
        document.getElementById('owner-token').textContent = tagData.owner.token;
        
        // Populate readers list
        const readersList = document.getElementById('manage-readers-list');
        readersList.innerHTML = '';
        
        if (tagData.readers.length === 0) {
            readersList.innerHTML = '<p>No readers added to this tag.</p>';
            debugLog("No readers found on tag", 'info');
        } else {
            debugLog(`Displaying ${tagData.readers.length} readers`, 'info');
            
            tagData.readers.forEach((reader, index) => {
                const readerItem = document.createElement('div');
                readerItem.className = 'reader-item';
                readerItem.innerHTML = `
                    <div class="reader-info">
                        <strong>${reader.id}</strong><br>
                        <span class="token-display">${reader.token}</span>
                    </div>
                    <div class="reader-actions">
                        <button class="danger" onclick="removeReaderFromTag(${index})">Remove</button>
                    </div>
                `;
                readersList.appendChild(readerItem);
            });
        }
        
        // Store the current tag data and token for later use
        manageSection.dataset.tagData = JSON.stringify(tagData);
        manageSection.dataset.accessToken = token;
        
        // Set up add reader button
        document.getElementById('add-reader-button').onclick = () => addReaderToTag();
        
        // Set up save button - Use update mode with owner context
        document.getElementById('save-changes-button').onclick = () => {
            debugLog("Save changes button clicked", 'info');
            
            const updatedTagData = JSON.parse(manageSection.dataset.tagData);
            const ownerToken = manageSection.dataset.accessToken;
            
            debugLog(`Preparing update operation with ${updatedTagData.readers.length} readers`, 'info');
            
            // Start NFC operation in UPDATE mode with context
            startNFCOperation('UPDATING', {
                tagData: updatedTagData,
                ownerToken: ownerToken
            });
        };
    } else if (accessLevel === "reader") {
        // Reader can only see limited information
        document.getElementById('owner-controls').style.display = 'none';
        document.getElementById('reader-controls').style.display = 'block';
        
        // Show reader info
        const reader = tagData.readers.find(r => r.id === readerId);
        document.getElementById('reader-id').textContent = reader.id;
        document.getElementById('reader-token').textContent = reader.token;
        
        debugLog(`Displaying reader info for "${reader.id}"`, 'info');
        
        // No modify capabilities for readers
    }
}

// Switch to UI for creating a new tag
function switchToCreateNewTagUI() {
    debugLog("Switching to create new tag UI", 'info');
    
    // Hide other UI sections
    document.getElementById('token-entry-section').style.display = 'none';
    document.getElementById('manage-tag-section').style.display = 'none';
    
    // Show create section
    document.getElementById('create-tag-section').style.display = 'block';
    
    // Init with empty readers list
    readers = [];
    updateReadersList();
    
    // Generate a new owner token
    generateOwnerToken();
    
    // Set up write button - Use write mode
    document.getElementById('write-tag-button').onclick = () => {
        debugLog("Write tag button clicked", 'info');
        startNFCOperation('WRITING');
    };
}

// Add a new reader to an existing tag (owner only)
function addReaderToTag() {
    debugLog("Adding new reader to tag", 'info');
    
    const manageSection = document.getElementById('manage-tag-section');
    const tagData = JSON.parse(manageSection.dataset.tagData);
    
    const readerId = prompt("Enter Reader ID:");
    if (!readerId) {
        debugLog("User cancelled reader ID entry", 'info');
        return;
    }
    
    // Check if reader ID already exists
    if (tagData.readers.some(r => r.id === readerId)) {
        debugLog(`Reader "${readerId}" already exists`, 'warning');
        showStatus(`Reader "${readerId}" already exists`, true);
        return;
    }
    
    // Generate or enter a token
    const generateOrEnter = confirm("Click OK to auto-generate a token, or Cancel to enter manually");
    
    let readerToken;
    if (generateOrEnter) {
        readerToken = generateToken();
        debugLog(`Generated token for reader "${readerId}"`, 'info');
    } else {
        readerToken = prompt("Enter Reader Token:");
        if (!readerToken) {
            debugLog("User cancelled reader token entry", 'info');
            return;
        }
        debugLog(`User entered token for reader "${readerId}"`, 'info');
    }
    
    // Add the new reader
    tagData.readers.push({ id: readerId, token: readerToken });
    debugLog(`Added reader "${readerId}" to tag data`, 'success');
    
    // Update UI
    manageSection.dataset.tagData = JSON.stringify(tagData);
    switchToManageTagUI(tagData, manageSection.dataset.accessToken, "owner");
    
    // Update operation status to remind user to save changes
    updateOperationStatus(`Reader "${readerId}" added. Click "Save Changes to Tag" to write to NFC tag.`, true);
    showStatus(`Reader "${readerId}" added. Click "Save Changes to Tag" to write to NFC tag.`);
}

// Remove a reader from an existing tag (owner only)
function removeReaderFromTag(index) {
    const manageSection = document.getElementById('manage-tag-section');
    const tagData = JSON.parse(manageSection.dataset.tagData);
    
    const confirmRemove = confirm(`Remove reader "${tagData.readers[index].id}"?`);
    if (confirmRemove) {
        const removedReaderId = tagData.readers[index].id;
        tagData.readers.splice(index, 1);
        
        debugLog(`Removed reader "${removedReaderId}" from tag data`, 'info');
        
        // Update UI
        manageSection.dataset.tagData = JSON.stringify(tagData);
        switchToManageTagUI(tagData, manageSection.dataset.accessToken, "owner");
        
        // Update operation status to remind user to save changes
        updateOperationStatus('Reader removed. Click "Save Changes to Tag" to write to NFC tag.', true);
        showStatus('Reader removed. Click "Save Changes to Tag" to write to NFC tag.');
    } else {
        debugLog("User cancelled reader removal", 'info');
    }
}

// CONTACTS MANAGEMENT

// Store contacts encrypted with owner's token
async function storeEncryptedContacts(contacts, ownerToken) {
    debugLog(`Storing ${contacts.length} contacts encrypted with owner token`, 'info');
    
    // Create a contacts object
    const contactsData = {
        readers: contacts,
        timestamp: Date.now()
    };
    
    // Encrypt the entire contacts list with the owner's token
    const encryptedData = CryptoJS.AES.encrypt(
        JSON.stringify(contactsData),
        ownerToken
    ).toString();
    
    // Store in localforage
    await localforage.setItem('encrypted_contacts', encryptedData);
    debugLog("Contacts stored successfully", 'success');
    
    return true;
}

// Decrypt contacts using the owner's token
async function loadEncryptedContacts(ownerToken) {
    debugLog("Loading encrypted contacts", 'info');
    
    try {
        // Get encrypted data
        const encryptedData = await localforage.getItem('encrypted_contacts');
        
        if (!encryptedData) {
            debugLog("No stored contacts found", 'info');
            return { readers: [] };
        }
        
        // Decrypt data
        const decryptedBytes = CryptoJS.AES.decrypt(encryptedData, ownerToken);
        const contactsData = JSON.parse(decryptedBytes.toString(CryptoJS.enc.Utf8));
        
        debugLog(`Loaded ${contactsData.readers ? contactsData.readers.length : 0} contacts`, 'success');
        return contactsData;
    } catch (error) {
        debugLog(`Failed to decrypt contacts: ${error}`, 'error');
        showStatus('Failed to decrypt contacts. Is your token correct?', true);
        return { readers: [] };
    }
}

// Unlock contacts with owner token
async function unlockContacts() {
    const ownerToken = document.getElementById('contactOwnerToken').value;
    
    if (!ownerToken) {
        showStatus('Owner token is required', true);
        return;
    }
    
    debugLog("Attempting to unlock contacts", 'info');
    
    try {
        const contactsData = await loadEncryptedContacts(ownerToken);
        contacts = contactsData.readers || [];
        currentOwnerToken = ownerToken;
        
        // Show contacts container
        document.getElementById('contacts-container').style.display = 'block';
        
        // Update contacts list
        updateContactsList();
        
        debugLog("Contacts unlocked successfully", 'success');
        showStatus('Contacts unlocked successfully');
    } catch (error) {
        debugLog(`Failed to unlock contacts: ${error}`, 'error');
        showStatus('Failed to unlock contacts', true);
    }
}

// Add a new contact
function addContact() {
    if (!currentOwnerToken) {
        showStatus('Please unlock contacts first', true);
        return;
    }
    
    const contactId = prompt("Enter Contact ID:");
    if (!contactId) return;
    
    // Ask if they want to generate or enter a token
    const generateOrEnter = confirm("Click OK to auto-generate a token, or Cancel to enter manually");
    
    let contactToken;
    if (generateOrEnter) {
        contactToken = generateToken();
    } else {
        contactToken = prompt("Enter Contact Token:");
        if (!contactToken) return;
    }
    
    contacts.push({ id: contactId, token: contactToken });
    updateContactsList();
    debugLog(`Added contact "${contactId}"`, 'success');
    showStatus(`Contact "${contactId}" added`);
}

// Update contacts list in the UI
function updateContactsList() {
    const list = document.getElementById('contactsList');
    list.innerHTML = '';
    
    if (contacts.length === 0) {
        list.innerHTML = '<p>No contacts saved yet.</p>';
        return;
    }
    
    debugLog(`Displaying ${contacts.length} contacts`, 'info');
    
    contacts.forEach((contact, index) => {
        const contactDiv = document.createElement('div');
        contactDiv.className = 'reader-item';
        contactDiv.innerHTML = `
            <div class="reader-info">
                <strong>${contact.id}</strong><br>
                <span class="token-display">${contact.token}</span>
            </div>
            <div class="reader-actions">
                <button onclick="useContact(${index})">Use</button>
                <button class="danger" onclick="removeContact(${index})">Remove</button>
            </div>
        `;
        list.appendChild(contactDiv);
    });
}

// Remove a contact
function removeContact(index) {
    const confirmRemove = confirm(`Remove contact "${contacts[index].id}"?`);
    if (confirmRemove) {
        const removedId = contacts[index].id;
        contacts.splice(index, 1);
        updateContactsList();
        debugLog(`Removed contact "${removedId}"`, 'info');
        showStatus('Contact removed');
    }
}

// Use a contact in the main interface
function useContact(index) {
    const contact = contacts[index];
    
    // Check if this contact is already in readers
    const existingIndex = readers.findIndex(reader => reader.id === contact.id);
    
    if (existingIndex !== -1) {
        readers[existingIndex] = contact; // Update
        debugLog(`Updated existing reader "${contact.id}" from contacts`, 'info');
    } else {
        readers.push(contact); // Add
        debugLog(`Added "${contact.id}" from contacts to readers`, 'success');
    }
    
    updateReadersList();
    
    // Switch to basic tab
    document.querySelector('.tab[data-tab="basic"]').click();
    
    showStatus(`Contact "${contact.id}" added to readers`);
}

// Save current contacts
async function saveContacts() {
    if (!currentOwnerToken) {
        showStatus('Please unlock contacts first', true);
        return;
    }
    
    try {
        debugLog("Saving contacts...", 'info');
        await storeEncryptedContacts(contacts, currentOwnerToken);
        debugLog("Contacts saved successfully", 'success');
        showStatus('Contacts saved successfully');
    } catch (error) {
        debugLog(`Error saving contacts: ${error}`, 'error');
        showStatus('Failed to save contacts', true);
    }
}

// Load saved readers into current session
async function loadSavedReaders() {
    const ownerToken = document.getElementById('ownerToken').value;
    
    if (!ownerToken) {
        showStatus('Owner token is required', true);
        return;
    }
    
    try {
        debugLog("Loading saved readers...", 'info');
        const contactsData = await loadEncryptedContacts(ownerToken);
        
        if (contactsData.readers && contactsData.readers.length > 0) {
            // Merge with existing readers, avoiding duplicates
            const existingIds = readers.map(r => r.id);
            const newReaders = contactsData.readers.filter(r => !existingIds.includes(r.id));
            
            readers = [...readers, ...newReaders];
            updateReadersList();
            
            debugLog(`Loaded ${newReaders.length} saved readers`, 'success');
            showStatus(`Loaded ${newReaders.length} saved readers`);
        } else {
            debugLog("No saved readers found", 'info');
            showStatus('No saved readers found');
        }
    } catch (error) {
        debugLog(`Error loading saved readers: ${error}`, 'error');
        showStatus('Failed to load saved readers', true);
    }
}

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
