// nfc-operations.js - Tag-specific operations and processing
import eventBus from './event-bus.js';
import encryptionService from './encryption-service.js';
import statusDisplay from './status-display.js';
import readerManager from './reader-manager.js';
import tagMemoryService from './tag-memory-service.js';
import nfcCore from './nfc-core.js';

class NFCOperations {
    constructor() {
        this.isWriting = false;
    }

    init() {
        // Check for URL parameters for auto-starting
        const urlParams = new URLSearchParams(window.location.search);
        const action = urlParams.get('action');
        
        if (action === 'read') {
            // Auto-start scanning if launched from a tag
            eventBus.publish('log', { message: 'Auto-starting scan from URL parameter', type: 'info' });
            nfcCore.startNFCOperation('READING');
        }
        
        // Add event listeners for NFC operation buttons
        document.getElementById('write-tag-button').addEventListener('click', () => {
            eventBus.publish('log', { message: 'Write tag button clicked', type: 'info' });
            nfcCore.startNFCOperation('WRITING');
        });
        
        document.getElementById('scan-another-tag-button').addEventListener('click', () => {
            nfcCore.startNFCOperation('READING');
        });
        
        document.getElementById('reader-scan-another-tag-button').addEventListener('click', () => {
            nfcCore.startNFCOperation('READING');
        });
        
        document.getElementById('save-changes-button').addEventListener('click', () => {
            eventBus.publish('log', { message: 'Save changes button clicked', type: 'info' });
            
            const manageSection = document.getElementById('manage-tag-section');
            const updatedTagData = JSON.parse(manageSection.dataset.tagData);
            const ownerToken = manageSection.dataset.accessToken;
            
            eventBus.publish('log', { message: `Preparing update operation with ${updatedTagData.readers.length} readers`, type: 'info' });
            
            // Start NFC operation in UPDATE mode with context
            nfcCore.startNFCOperation('UPDATING', {
                tagData: updatedTagData,
                ownerToken: ownerToken
            });
        });
        
        // Subscribe to tagDetected events to handle tag operations
        eventBus.subscribe('tagDetected', data => {
            const { message, serialNumber, mode, ndefReader, contextData } = data;
            
            // Handle the tag based on the current operation mode
            switch (mode) {
                case 'WRITING':
                    this.handleTagInWriteMode(ndefReader, message, serialNumber);
                    break;
                case 'UPDATING':
                    this.handleTagInUpdateMode(ndefReader, message, serialNumber, contextData);
                    break;
                default: // 'READING' or other states default to read
                    this.handleTagInReadMode(message, serialNumber);
            }
        });
        
        // Subscribe to accessTag events
        eventBus.subscribe('accessTag', data => {
            this.accessTag(data.tagData, data.token);
        });
        
        eventBus.publish('log', { message: 'NFC operations initialized', type: 'info' });
    }

    // Check for recovery data from previous failed writes
    checkForRecoveryData() {
        localforage.getItem('last_write_attempt').then(lastAttempt => {
            if (lastAttempt && lastAttempt.ownerToken && lastAttempt.readers) {
                statusDisplay.showRecoveryNotification(lastAttempt);
            }
        }).catch(err => {
            eventBus.publish('log', { message: `Error checking for recovery data: ${err}`, type: 'error' });
        });
    }
    
    // Handle tag in write mode (new tag)
    async handleTagInWriteMode(ndef, message, serialNumber) {
        eventBus.publish('log', { message: `Handling tag in WRITE mode. Serial: ${serialNumber}`, type: 'info' });
        
        // Set writing flag to prevent multiple operations
        this.isWriting = true;
        
        // Display memory information
        const memoryInfo = tagMemoryService.estimateTagMemory(message);
        statusDisplay.displayTagMemoryInfo(memoryInfo);
        
        // Extensive pre-write checks
        let hasAnyData = message.records && message.records.length > 0;
        let isOurFormat = false;
        let existingTagDetails = {
            recordCount: 0,
            recordTypes: [],
            potentialDataSizes: []
        };
        
        if (hasAnyData) {
            eventBus.publish('log', { message: `Existing tag has ${message.records.length} records`, type: 'info' });
            
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
                        eventBus.publish('log', { message: `Record type: ${record.recordType}, Size: ${recordSize} bytes`, type: 'info' });
                    } catch (sizeError) {
                        eventBus.publish('log', { message: `Could not calculate record size: ${sizeError}`, type: 'warning' });
                    }
                    
                    // Attempt to decode text records
                    if (record.recordType === "text") {
                        const textDecoder = new TextDecoder();
                        const text = textDecoder.decode(record.data);
                        
                        // Try to parse and log existing data structure
                        try {
                            const existingData = JSON.parse(text);
                            eventBus.publish('log', { message: `Existing record content type: ${existingData.type || 'Unknown'}`, type: 'info' });
                            
                            if (existingData.type === "owner" || existingData.type === "encrypted_owner") {
                                isOurFormat = true;
                                eventBus.publish('log', { message: 'Recognized existing tag format', type: 'info' });
                            }
                        } catch (parseError) {
                            eventBus.publish('log', { message: `Could not parse record content: ${parseError}`, type: 'warning' });
                        }
                    }
                } catch (decodeError) {
                    eventBus.publish('log', { message: `Could not process record: ${decodeError}`, type: 'warning' });
                }
            }
        } else {
            eventBus.publish('log', { message: `Tag appears to be empty`, type: 'info' });
        }
        
        // If it has data, confirm overwrite
        if (hasAnyData) {
            // Prepare confirmation message based on tag contents
            let confirmMessage = isOurFormat ? 
                `This tag already contains data from this app (${existingTagDetails.recordCount} records). Overwrite?` :
                `This tag contains ${existingTagDetails.recordCount} records in an unknown format. Overwriting will erase all existing data. Continue?`;
            
            eventBus.publish('log', { message: `Asking for confirmation: ${confirmMessage}`, type: 'info' });
            
            const confirmOverwrite = confirm(confirmMessage);
            if (!confirmOverwrite) {
                document.getElementById('scanning-animation').style.display = 'none';
                statusDisplay.showStatus("Writing cancelled - existing data preserved", true);
                eventBus.publish('log', { message: 'User cancelled writing', type: 'info' });
                nfcCore.resetOperationState();
                this.isWriting = false;
                return;
            }
        }
        
        try {
            // Show writing animation
            const scanningElement = document.getElementById('scanning-animation');
            scanningElement.classList.add('writing');
            document.querySelector('#scanning-animation p').textContent = 'Writing tag...';
            
            eventBus.publish('log', { message: 'About to write tag data', type: 'info' });
            
            // Comprehensive write attempt with detailed logging
            const writeStartTime = Date.now();
            
            try {
                await this.writeTagData(ndef);
            } catch (writeError) {
                // Detailed write error logging
                eventBus.publish('log', { message: `Write Error Details:`, type: 'error' });
                eventBus.publish('log', { message: `- Error Name: ${writeError.name}`, type: 'error' });
                eventBus.publish('log', { message: `- Error Message: ${writeError.message}`, type: 'error' });
                
                // Specific error type handling
                if (writeError.name === 'NotSupportedError') {
                    eventBus.publish('log', { message: 'The tag may not support this write operation', type: 'warning' });
                } else if (writeError.name === 'SecurityError') {
                    eventBus.publish('log', { message: 'Security restrictions prevented writing', type: 'warning' });
                }
                
                // Throw to trigger catch block
                throw writeError;
            }
            
            const writeEndTime = Date.now();
            const writeDuration = writeEndTime - writeStartTime;
            
            document.getElementById('scanning-animation').style.display = 'none';
            
            eventBus.publish('log', { message: `Tag successfully written in ${writeDuration}ms`, type: 'success' });
            
            // Show success notification
            const statusElement = document.getElementById('status-message');
            statusElement.innerHTML = `
                <div class="success-notification">
                    <div class="success-icon">✓</div>
                    <div class="success-message">
                        <h3>Tag Successfully Written!</h3>
                        <p>Your NFC tag has been initialized with your settings.</p>
                        <p>Owner token: ${document.getElementById('ownerToken').value}</p>
                        <p>Number of readers: ${readerManager.getReaders().length}</p>
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
            statusDisplay.showStatus(errorMessage, true);
            
            eventBus.publish('log', { message: `Write Error: ${error}`, type: 'error' });
            eventBus.publish('log', { message: `Existing tag details:`, type: 'info' });
            eventBus.publish('log', { message: `- Record Count: ${existingTagDetails.recordCount}`, type: 'info' });
            eventBus.publish('log', { message: `- Record Types: ${existingTagDetails.recordTypes.join(', ')}`, type: 'info' });
            eventBus.publish('log', { message: `- Potential Data Sizes: ${existingTagDetails.potentialDataSizes.join(', ')} bytes`, type: 'info' });
        } finally {
            // Always reset writing state
            nfcCore.resetOperationState();
            this.isWriting = false;
        }
    }
    
    // Handle tag in update mode (adding readers to existing tag)
    async handleTagInUpdateMode(ndef, message, serialNumber, contextData) {
        eventBus.publish('log', { message: `Handling tag in UPDATE mode. Serial: ${serialNumber}`, type: 'info' });
        
        try {
            // We should have the tag data and owner token in the context
            const tagData = contextData.tagData;
            const ownerToken = contextData.ownerToken;
            
            if (!tagData || !ownerToken) {
                throw new Error("Missing tag data or owner token");
            }
            
            eventBus.publish('log', { message: `Update context: owner token present, tag data has ${tagData.readers ? tagData.readers.length : 0} readers`, type: 'info' });
            
            // Show writing status - more prominent
            const scanningElement = document.getElementById('scanning-animation');
            scanningElement.classList.add('writing');
            document.querySelector('#scanning-animation p').textContent = 'Writing to tag...';
            statusDisplay.showStatus('<span class="write-mode">WRITING...</span> Updating tag with new readers');
            
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
                encryptionService.createOwnerRecord(ownerToken)
            ];
            
            // Add reader records - now using owner token for encryption
            const readerRecords = tagData.readers.map(reader => encryptionService.createReaderRecord(reader, ownerToken));
            records.push(...readerRecords);
            
            eventBus.publish('log', { message: `About to write updated tag data with ${tagData.readers.length} readers`, type: 'info' });
            
            const writeStartTime = Date.now();
            
            // Write directly without further confirmation since we're in update mode
            await ndef.write({ records });
            
            const writeEndTime = Date.now();
            eventBus.publish('log', { message: `Tag updated in ${writeEndTime - writeStartTime}ms`, type: 'success' });
            
            // Update UI with a more persistent and visible success message
            document.getElementById('scanning-animation').style.display = 'none';
            
            // Show success in the status message
            statusDisplay.showStatus(`✅ Tag successfully updated with ${tagData.readers.length} readers!`);
            
            // Create a persistent success notification in the operation status area
            statusDisplay.updateOperationStatus(`Tag successfully updated with ${tagData.readers.length} readers!`, true);
            
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
            await nfcCore.safeStopNFC(ndef);
            
        } catch (error) {
            document.getElementById('scanning-animation').style.display = 'none';
            // More detailed error message
            const errorMessage = `Error updating tag: ${error.message || error}. Please try again.`;
            statusDisplay.showStatus(`❌ ${errorMessage}`, true);
            statusDisplay.updateOperationStatus(errorMessage, false);
            eventBus.publish('log', { message: `Update error: ${error}`, type: 'error' });
        }
        
        // Reset state
        nfcCore.resetOperationState();
    }
    
    // Handle tag in read mode
    async handleTagInReadMode(message, serialNumber) {
        eventBus.publish('log', { message: `Handling tag in READ mode. Serial: ${serialNumber}`, type: 'info' });
        
        // Hide scanning animation
        document.getElementById('scanning-animation').style.display = 'none';
        
        // Display memory information
        const memoryInfo = tagMemoryService.estimateTagMemory(message);
        statusDisplay.displayTagMemoryInfo(memoryInfo);
        
        // Process the tag data
        await this.processNFCTag(message);
    }
    
    // Enhanced writeTagData with better error handling
    async writeTagData(ndef) {
        const ownerToken = document.getElementById('ownerToken').value;
        const readers = readerManager.getReaders();

        if (!ownerToken) {
            statusDisplay.showStatus('Owner token is required', true);
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
            encryptionService.createOwnerRecord(ownerToken)
        ];

        // Add reader records - now passing the owner token for encryption
        const readerRecords = readers.map(reader => encryptionService.createReaderRecord(reader, ownerToken));
        records.push(...readerRecords);

        // Log payload details for debugging
        eventBus.publish('log', { message: 'Preparing to write NFC tag', type: 'info' });
        eventBus.publish('log', { message: `Total records: ${records.length}`, type: 'info' });
        
        // Save data to local storage as backup before writing
        try {
            await localforage.setItem('last_write_attempt', {
                timestamp: Date.now(),
                ownerToken: ownerToken,
                readers: readers,
                recordCount: records.length
            });
            eventBus.publish('log', { message: 'Saved write data to local backup', type: 'info' });
        } catch (backupError) {
            eventBus.publish('log', { message: `Warning: Could not save backup: ${backupError}`, type: 'warning' });
            // Continue anyway - this is just a precaution
        }

        try {
            // Attempt to write all records
            const writeStartTime = Date.now();
            
            await ndef.write({ records });

            const writeEndTime = Date.now();
            eventBus.publish('log', { message: `Tag write completed in ${writeEndTime - writeStartTime}ms`, type: 'success' });
            
            // Clear the backup after successful write
            await localforage.removeItem('last_write_attempt');
            
            return true;
        } catch (error) {
            eventBus.publish('log', { message: `Comprehensive write error: ${error}`, type: 'error' });
            
            // Enhanced error feedback
            statusDisplay.showStatus(`❌ Error writing to tag: ${error.message || error}. Your data is saved locally.`, true);
            throw error;
        }
    }
    
    // Modified processNFCTag to handle encrypted records
    async processNFCTag(message) {
        eventBus.publish('log', { message: "Processing NFC tag message", type: 'info' });
        
        // Check if the tag has any records
        if (!message.records || message.records.length === 0) {
            eventBus.publish('log', { message: "No records found on tag - detected empty tag", type: 'info' });
            statusDisplay.showStatus("Empty tag detected - ready to create new tag");
            
            // Switch to create new tag UI
            eventBus.publish('switchUI', { ui: 'createNew' });
            
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
        
        eventBus.publish('log', { message: `Found ${message.records.length} records on tag`, type: 'info' });
        
        // Find and process specific record types
        let ownerRecord = null;
        let readerRecords = [];
        let hasURLRecord = false;
        let urlTarget = '';
        let isOurFormat = false;
        
        // Examine all records on the tag
        for (const record of message.records) {
            eventBus.publish('log', { message: `Record type: ${record.recordType}`, type: 'info' });
            
            if (record.recordType === "url") {
                try {
                    const textDecoder = new TextDecoder();
                    urlTarget = textDecoder.decode(record.data);
                    
                    // Check if the URL actually contains data
                    if (urlTarget && urlTarget.trim().length > 0) {
                        hasURLRecord = true;
                        eventBus.publish('log', { message: `URL record found: ${urlTarget}`, type: 'info' });
                    } else {
                        eventBus.publish('log', { message: "Empty URL record found", type: 'warning' });
                    }
                } catch (e) {
                    eventBus.publish('log', { message: `Error decoding URL data: ${e}`, type: 'error' });
                }
            } else if (record.recordType === "text") {
                try {
                    const textDecoder = new TextDecoder();
                    const text = textDecoder.decode(record.data);
                    eventBus.publish('log', { message: `Text record content: ${text.substring(0, 50)}...`, type: 'info' });
                        
                    try {
                        const recordData = JSON.parse(text);
                            
                        // Process different record types
                        if (recordData.type === "encrypted_owner") {
                            ownerRecord = recordData;
                            isOurFormat = true;
                            eventBus.publish('log', { message: 'Found encrypted owner record', type: 'info' });
                        } else if (recordData.type === "encrypted_reader") {
                            readerRecords.push(recordData);
                            isOurFormat = true;
                            eventBus.publish('log', { message: `Found encrypted reader record: ${recordData.id}`, type: 'info' });
                        } else if (recordData.type === "encrypted_nfc_multi_user") {
                            // Handle legacy format for backward compatibility
                            eventBus.publish('log', { message: "Found legacy encrypted format", type: 'info' });
                            statusDisplay.showStatus("Legacy encrypted tag detected");
                            
                            // Switch to token entry UI
                            eventBus.publish('switchUI', { ui: 'tokenEntry', tagData: recordData });
                            return;
                        } else if (recordData.type === "owner" || recordData.type === "reader") {
                            // Handle unencrypted records (for backward compatibility)
                            eventBus.publish('log', { message: "Found unencrypted record - upgrading recommended", type: 'warning' });
                            if (recordData.type === "owner") {
                                ownerRecord = { 
                                    type: "unencrypted_owner", 
                                    token: recordData.token 
                                };
                                isOurFormat = true;
                            } else if (recordData.type === "reader") {
                                readerRecords.push({ 
                                    type: "unencrypted_reader", 
                                    id: recordData.id, 
                                    token: recordData.token 
                                });
                                isOurFormat = true;
                            }
                        } else {
                            eventBus.publish('log', { message: `Unknown record type: ${recordData.type}`, type: 'warning' });
                        }
                    } catch (jsonError) {
                        eventBus.publish('log', { message: `Failed to parse JSON: ${jsonError}`, type: 'warning' });
                    }
                } catch (e) {
                    eventBus.publish('log', { message: `Error decoding text data: ${e}`, type: 'error' });
                }
            }
        }
        
        // CASE 1: Tag has our format with owner and readers
        if (isOurFormat && ownerRecord) {
            eventBus.publish('log', { message: "Processing tag with our multi-record format", type: 'info' });
            statusDisplay.showStatus("NFC tag detected");
            
            // Prepare tag data in the format expected by the UI
            const tagData = {
                owner: ownerRecord,
                readers: readerRecords
            };
            
            // Show token entry UI
            eventBus.publish('switchUI', { ui: 'tokenEntry', tagData: tagData });
            return;
        }
        
        // CASE 2: Tag has some data but not our format
        if (hasURLRecord || message.records.length > 0) {
            eventBus.publish('log', { message: "Tag has data but not in our format", type: 'warning' });
            statusDisplay.showStatus("Found tag with existing data", true);
            
            // Show confirmation dialog with more information
            if (confirm("This tag contains data in a format not recognized by this app. Would you like to create a new tag? (This will erase existing data when you write to the tag)")) {
                eventBus.publish('switchUI', { ui: 'createNew' });
            }
            return;
        }
        
        // Fallback: If we somehow get here, default to create new tag UI
        eventBus.publish('log', { message: "Tag format not recognized - defaulting to create new tag UI", type: 'warning' });
        statusDisplay.showStatus("Tag format not recognized");
        eventBus.publish('switchUI', { ui: 'createNew' });
    }
    
    // Access a tag using the provided token
    accessTag(tagData, token) {
        eventBus.publish('log', { message: `Attempting to access tag with token`, type: 'info' });
        
        try {
            // Handle legacy encrypted format
            if (tagData.type === "encrypted_nfc_multi_user") {
                try {
                    // Decrypt the entire payload with the token
                    const decryptedData = encryptionService.decrypt(tagData.data, token);
                    
                    // Validate that it contains the owner token that matches
                    if (decryptedData.owner && decryptedData.owner.token === token) {
                        eventBus.publish('log', { message: "Legacy format - owner access granted", type: 'success' });
                        statusDisplay.showStatus("Owner access granted!");
                        
                        // Switch to tag management UI with owner privileges
                        eventBus.publish('switchUI', { 
                            ui: 'manageTag', 
                            tagData: decryptedData, 
                            token: token, 
                            accessLevel: "owner" 
                        });
                        return;
                    }
                    
                    // Check if token matches any reader
                    const matchingReader = decryptedData.readers.find(r => r.token === token);
                    if (matchingReader) {
                        eventBus.publish('log', { message: `Legacy format - reader access granted for ${matchingReader.id}`, type: 'success' });
                        statusDisplay.showStatus(`Reader access granted for ${matchingReader.id}!`);
                        
                        // Switch to tag management UI with reader privileges
                        eventBus.publish('switchUI', { 
                            ui: 'manageTag', 
                            tagData: decryptedData, 
                            token: token, 
                            accessLevel: "reader",
                            readerId: matchingReader.id
                        });
                        return;
                    }
                } catch (error) {
                    eventBus.publish('log', { message: `Failed to decrypt legacy format: ${error}`, type: 'error' });
                }
                
                statusDisplay.showStatus("Invalid token - Access denied", true);
                return;
            }
            
            // Try to decrypt owner record
            if (tagData.owner && tagData.owner.type === "encrypted_owner") {
                try {
                    // Try to decrypt with provided token
                    const ownerData = encryptionService.decryptOwnerRecord(tagData.owner, token);
                    
                    // If we can decrypt, this is the owner
                    if (ownerData && ownerData.token === token) {
                        eventBus.publish('log', { message: "Owner access granted", type: 'success' });
                        statusDisplay.showStatus("Owner access granted!");
                        
                        // Now decrypt all reader records with the owner token
                        const decryptedReaders = [];
                        
                        for (const encryptedReader of tagData.readers) {
                            try {
                                if (encryptedReader.type === "encrypted_reader") {
                                    // Decrypt each reader with owner token
                                    const readerData = encryptionService.decryptReaderRecord(encryptedReader, token);
                                    
                                    if (readerData) {
                                        decryptedReaders.push({
                                            id: readerData.id,
                                            token: readerData.token
                                        });
                                    }
                                }
                            } catch (readerError) {
                                eventBus.publish('log', { message: `Could not decrypt reader ${encryptedReader.id}: ${readerError}`, type: 'warning' });
                            }
                        }
                        
                        // Create data structure for UI
                        const decryptedData = {
                            owner: {
                                id: "owner",
                                token: token
                            },
                            readers: decryptedReaders
                        };
                        
                        // Switch to tag management UI with owner privileges
                        eventBus.publish('switchUI', { 
                            ui: 'manageTag', 
                            tagData: decryptedData, 
                            token: token, 
                            accessLevel: "owner" 
                        });
                        return;
                    }
                } catch (error) {
                    eventBus.publish('log', { message: `Failed to decrypt owner record: ${error}`, type: 'error' });
                }
            }
            
            // Check unencrypted format for backward compatibility
            if (tagData.owner && tagData.owner.type === "unencrypted_owner") {
                if (tagData.owner.token === token) {
                    eventBus.publish('log', { message: "Owner access granted (unencrypted format)", type: 'success' });
                    statusDisplay.showStatus("Owner access granted!");
                    
                    // Prepare reader data for UI
                    const readers = tagData.readers.map(reader => ({
                        id: reader.id,
                        token: reader.token
                    }));
                    
                    const decryptedData = {
                        owner: {
                            id: "owner",
                            token: token
                        },
                        readers: readers
                    };
                    
                    // Switch to tag management UI with owner privileges
                    eventBus.publish('switchUI', { 
                        ui: 'manageTag', 
                        tagData: decryptedData, 
                        token: token, 
                        accessLevel: "owner" 
                    });
                    return;
                }
                
                // Check if token matches any reader
                const matchingReader = tagData.readers.find(r => r.token === token);
                if (matchingReader) {
                    eventBus.publish('log', { message: `Reader access granted for ${matchingReader.id}`, type: 'success' });
                    statusDisplay.showStatus(`Reader access granted for ${matchingReader.id}!`);
                    
                    // Switch to tag management UI with reader privileges
                    eventBus.publish('switchUI', { 
                        ui: 'manageTag', 
                        tagData: {
                            owner: { id: "owner", token: "" },
                            readers: tagData.readers
                        }, 
                        token: token, 
                        accessLevel: "reader",
                        readerId: matchingReader.id
                    });
                    return;
                }
            }
            
            // If we get here, the token is invalid
            eventBus.publish('log', { message: "Invalid token - Access denied", type: 'error' });
            statusDisplay.showStatus("Invalid token - Access denied", true);
            
        } catch (error) {
            eventBus.publish('log', { message: `Access error: ${error}`, type: 'error' });
            statusDisplay.showStatus("Invalid token or corrupted tag data", true);
        }
    }
}

// Create and export a singleton instance
const nfcOperations = new NFCOperations();
export default nfcOperations;
                    