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
    
    // Clear after 5 seconds
    setTimeout(() => {
        statusElement.innerHTML = '';
    }, 5000);
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
}

// Master NFC handler that handles all NFC operations based on current state
async function startNFCOperation(operation = 'READ', contextData = null) {
    if (!('NDEFReader' in window)) {
        showStatus("NFC not supported on this device", true);
        return;
    }

    // Update global state
    nfcOperationState.mode = operation;
    if (contextData) {
        if (contextData.tagData) nfcOperationState.tagData = contextData.tagData;
        if (contextData.ownerToken) nfcOperationState.ownerToken = contextData.ownerToken;
    }
    
    // Show scanning animation with appropriate instructions
    document.getElementById('scanning-animation').style.display = 'block';
    
    if (operation === 'WRITING') {
        document.querySelector('#scanning-animation p').textContent = 'Please bring the NFC tag to the back of your phone to write...';
        showStatus('<span class="write-mode">WRITE MODE</span> Place tag against your device');
    } else if (operation === 'UPDATING') {
        document.querySelector('#scanning-animation p').textContent = 'Ready to update tag with new readers...';
        showStatus('<span class="write-mode">UPDATE MODE</span> Place the same tag back against your device');
    } else {
        document.querySelector('#scanning-animation p').textContent = 'Waiting for NFC tag...';
        showStatus('<span class="read-mode">READ MODE</span> Place tag against your device');
    }
    
    try {
        const ndef = new NDEFReader();
        
        // Clear any previous event listeners
        ndef.onreading = null;
        
        await ndef.scan();
        
        // Set up central NFC tag detection handler
        ndef.addEventListener("reading", async ({ message, serialNumber }) => {
            console.log(`Tag detected in ${operation} mode. Serial: ${serialNumber}`);
            
            // Handle the tag based on current operation state
            switch (nfcOperationState.mode) {
                case 'WRITING':
                    await handleTagInWriteMode(ndef, message);
                    break;
                case 'UPDATING':
                    await handleTagInUpdateMode(ndef, message);
                    break;
                default: // 'READING' or other states default to read
                    await handleTagInReadMode(message);
            }
        });
        
    } catch (error) {
        document.getElementById('scanning-animation').style.display = 'none';
        showStatus(`Error with NFC: ${error}`, true);
        console.error("NFC error:", error);
        // Reset state on error
        nfcOperationState.mode = 'IDLE';
    }
}

// Handle tag in write mode (new tag)
async function handleTagInWriteMode(ndef, message) {
    // Check if the tag has any existing data
    let hasAnyData = message.records && message.records.length > 0;
    let isOurFormat = false;
    
    if (hasAnyData) {
        // Check if it matches our format
        for (const record of message.records) {
            if (record.recordType === "text") {
                try {
                    const textDecoder = new TextDecoder();
                    const text = textDecoder.decode(record.data);
                    try {
                        const data = JSON.parse(text);
                        if (data.type === "encrypted_nfc_multi_user") {
                            isOurFormat = true;
                            break;
                        }
                    } catch (jsonError) {
                        // Not JSON data, continue checking
                    }
                } catch (e) {
                    // Decoding error, continue checking
                }
            }
        }
    }
    
    // If it has data, confirm overwrite
    if (hasAnyData) {
        let confirmMessage = isOurFormat ? 
            "This tag already contains encrypted data from this app. Do you want to overwrite it?" :
            "This tag contains data in an unknown format. Overwriting will erase all existing data on the tag. Continue?";
        
        const confirmOverwrite = confirm(confirmMessage);
        if (!confirmOverwrite) {
            document.getElementById('scanning-animation').style.display = 'none';
            showStatus("Writing cancelled - existing data preserved", true);
            nfcOperationState.mode = 'IDLE';
            return;
        }
    }
    
    try {
        await writeTagData(ndef);
        document.getElementById('scanning-animation').style.display = 'none';
        showStatus("✅ Tag successfully written!");
    } catch (error) {
        document.getElementById('scanning-animation').style.display = 'none';
        showStatus(`❌ Error writing to tag: ${error}`, true);
    }
    
    // Reset state
    nfcOperationState.mode = 'IDLE';
}

// Handle tag in update mode (adding readers to existing tag)
async function handleTagInUpdateMode(ndef, message) {
    try {
        // We already have the tag data and owner token in the state
        // Create updated encrypted data with new readers
        const tagData = nfcOperationState.tagData;
        const ownerToken = nfcOperationState.ownerToken;
        
        if (!tagData || !ownerToken) {
            throw new Error("Missing tag data or owner token");
        }
        
        // Encrypt the updated data
        const encryptedPayload = CryptoJS.AES.encrypt(
            JSON.stringify(tagData),
            ownerToken
        ).toString();
        
        // Create wrapper
        const newTagData = {
            type: "encrypted_nfc_multi_user",
            version: "1.0",
            data: encryptedPayload
        };
        
        // Get the current URL (without query parameters) to use as the app URL
        const appUrl = window.location.origin + window.location.pathname;
        
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
        
        // Update UI
        document.getElementById('scanning-animation').style.display = 'none';
        showStatus("✅ Tag successfully updated with new readers!");
        
    } catch (error) {
        document.getElementById('scanning-animation').style.display = 'none';
        showStatus(`❌ Error updating tag: ${error}`, true);
        console.error("Update error:", error);
    }
    
    // Reset state
    nfcOperationState.mode = 'IDLE';
}

// Handle tag in read mode
async function handleTagInReadMode(message) {
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

    // Write to NFC tag
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
}

// Process an NFC tag and determine the correct UI to show
async function processNFCTag(message) {
    console.log("Processing NFC tag message:", message);
    
    // Check if the tag has any records
    if (!message.records || message.records.length === 0) {
        console.log("No records found on tag");
        switchToCreateNewTagUI();
        return;
    }
    
    let tagData = null;
    let hasURLRecord = false;
    let urlTarget = '';
    let isOurFormat = false;
    
    // Log all records for debugging
    console.log(`Found ${message.records.length} records on tag`);
    
    // Examine all records on the tag
    for (const record of message.records) {
        console.log("Record type:", record.recordType);
        
        if (record.recordType === "text") {
            try {
                const textDecoder = new TextDecoder();
                const text = textDecoder.decode(record.data);
                console.log("Text record content:", text.substring(0, 50) + "...");
                
                try {
                    tagData = JSON.parse(text);
                    console.log("Successfully parsed JSON data from tag");
                    
                    // Check if it's our format
                    if (tagData && tagData.type === "encrypted_nfc_multi_user") {
                        isOurFormat = true;
                    }
                } catch (jsonError) {
                    console.error("Failed to parse JSON:", jsonError);
                }
            } catch (e) {
                console.error("Error decoding text data:", e);
            }
        } else if (record.recordType === "url") {
            hasURLRecord = true;
            const textDecoder = new TextDecoder();
            urlTarget = textDecoder.decode(record.data);
            console.log("URL record found:", urlTarget);
        }
    }
    
    // CASE 1: Tag has our encrypted format
    if (isOurFormat) {
        console.log("Recognized our encrypted format");
        showStatus("Encrypted tag detected");
        
        // Show token entry UI
        switchToTokenEntryUI(tagData);
        return;
    }
    
    // CASE 2: Tag has some data but not our format
    if (tagData || hasURLRecord) {
        console.log("Tag has data but not in our format");
        showStatus("Found tag with existing data", true);
        
        // Show confirmation dialog with more information
        if (confirm("This tag contains data in a format not recognized by this app. Would you like to create a new tag? (This will erase existing data when you write to the tag)")) {
            switchToCreateNewTagUI();
        }
        return;
    }
    
    // CASE 3: Tag appears to be empty or we couldn't read any meaningful data
    console.log("Tag appears to be empty");
    showStatus("Empty tag detected");
    switchToCreateNewTagUI();
}

// Switch to token entry UI for existing encrypted tags
function switchToTokenEntryUI(tagData) {
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

// Access tag with the provided token
function accessTag(tagData, token) {
    try {
        // Try to decrypt with provided token
        const decryptedBytes = CryptoJS.AES.decrypt(tagData.data, token);
        const decryptedData = JSON.parse(decryptedBytes.toString(CryptoJS.enc.Utf8));
        
        // If we got here, decryption was successful
        
        // Check if this token is the owner token
        if (decryptedData.owner && decryptedData.owner.token === token) {
            showStatus("Owner access granted!");
            
            // Switch to tag management UI with owner privileges
            switchToManageTagUI(decryptedData, token, "owner");
        } 
        // Check if this token is a reader token
        else if (decryptedData.readers && Array.isArray(decryptedData.readers)) {
            const reader = decryptedData.readers.find(r => r.token === token);
            
            if (reader) {
                showStatus(`Reader "${reader.id}" access granted!`);
                
                // Switch to tag management UI with reader privileges
                switchToManageTagUI(decryptedData, token, "reader", reader.id);
            } else {
                showStatus("Invalid token - Access denied", true);
            }
        } else {
            showStatus("Invalid tag format", true);
        }
    } catch (error) {
        console.error("Access error", error);
        showStatus("Invalid token or corrupted tag data", true);
    }
}

// Switch to UI for managing an existing tag
function switchToManageTagUI(tagData, token, accessLevel, readerId = null) {
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
        } else {
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
            const updatedTagData = JSON.parse(manageSection.dataset.tagData);
            const ownerToken = manageSection.dataset.accessToken;
            
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
        
        // No modify capabilities for readers
    }
}

// Switch to UI for creating a new tag
function switchToCreateNewTagUI() {
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
        startNFCOperation('WRITING');
    };
}

// Add a new reader to an existing tag (owner only)
function addReaderToTag() {
    const manageSection = document.getElementById('manage-tag-section');
    const tagData = JSON.parse(manageSection.dataset.tagData);
    
    const readerId = prompt("Enter Reader ID:");
    if (!readerId) return;
    
    // Check if reader ID already exists
    if (tagData.readers.some(r => r.id === readerId)) {
        showStatus(`Reader "${readerId}" already exists`, true);
        return;
    }
    
    // Generate or enter a token
    const generateOrEnter = confirm("Click OK to auto-generate a token, or Cancel to enter manually");
    
    let readerToken;
    if (generateOrEnter) {
        readerToken = generateToken();
    } else {
        readerToken = prompt("Enter Reader Token:");
        if (!readerToken) return;
    }
    
    // Add the new reader
    tagData.readers.push({ id: readerId, token: readerToken });
    
    // Update UI
    manageSection.dataset.tagData = JSON.stringify(tagData);
    switchToManageTagUI(tagData, manageSection.dataset.accessToken, "owner");
    
    showStatus(`Reader "${readerId}" added. Click "Save Changes to Tag" to write to NFC tag.`);
}

// Remove a reader from an existing tag (owner only)
function removeReaderFromTag(index) {
    const manageSection = document.getElementById('manage-tag-section');
    const tagData = JSON.parse(manageSection.dataset.tagData);
    
    const confirmRemove = confirm(`Remove reader "${tagData.readers[index].id}"?`);
    if (confirmRemove) {
        tagData.readers.splice(index, 1);
        
        // Update UI
        manageSection.dataset.tagData = JSON.stringify(tagData);
        switchToManageTagUI(tagData, manageSection.dataset.accessToken, "owner");
        
        showStatus('Reader removed. Click "Save Changes to Tag" to write to NFC tag.');
    }
}

// CONTACTS MANAGEMENT

// Store contacts encrypted with owner's token
async function storeEncryptedContacts(contacts, ownerToken) {
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
    
    return true;
}

// Decrypt contacts using the owner's token
async function loadEncryptedContacts(ownerToken) {
    try {
        // Get encrypted data
        const encryptedData = await localforage.getItem('encrypted_contacts');
        
        if (!encryptedData) {
            return { readers: [] };
        }
        
        // Decrypt data
        const decryptedBytes = CryptoJS.AES.decrypt(encryptedData, ownerToken);
        const contactsData = JSON.parse(decryptedBytes.toString(CryptoJS.enc.Utf8));
        
        return contactsData;
    } catch (error) {
        console.error('Failed to decrypt contacts:', error);
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
    
    try {
        const contactsData = await loadEncryptedContacts(ownerToken);
        contacts = contactsData.readers || [];
        currentOwnerToken = ownerToken;
        
        // Show contacts container
        document.getElementById('contacts-container').style.display = 'block';
        
        // Update contacts list
        updateContactsList();
        
        showStatus('Contacts unlocked successfully');
    } catch (error) {
        showStatus('Failed to unlock contacts', true);
        console.error('Error unlocking contacts:', error);
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
        contacts.splice(index, 1);
        updateContactsList();
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
    } else {
        readers.push(contact); // Add
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
        await storeEncryptedContacts(contacts, currentOwnerToken);
        showStatus('Contacts saved successfully');
    } catch (error) {
        showStatus('Failed to save contacts', true);
        console.error('Error saving contacts:', error);
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
        const contactsData = await loadEncryptedContacts(ownerToken);
        
        if (contactsData.readers && contactsData.readers.length > 0) {
            // Merge with existing readers, avoiding duplicates
            const existingIds = readers.map(r => r.id);
            const newReaders = contactsData.readers.filter(r => !existingIds.includes(r.id));
            
            readers = [...readers, ...newReaders];
            updateReadersList();
            
            showStatus(`Loaded ${newReaders.length} saved readers`);
        } else {
            showStatus('No saved readers found');
        }
    } catch (error) {
        showStatus('Failed to load saved readers', true);
        console.error('Error loading readers:', error);
    }
}

// Initialize the app
function initApp() {
    // Setup tabs
    setupTabs();
    
    // Initialize settings
    initSettings();
    
    // Check for URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const action = urlParams.get('action');
    
    if (action === 'read') {
        // Auto-start scanning if launched from a tag
        startNFCOperation('READING');
    } else {
        // Default to create new tag UI
        switchToCreateNewTagUI();
    }
    
    // Check for NFC support
    if (!('NDEFReader' in window)) {
        showStatus("NFC is not supported on this device or browser. Some features may not work.", true);
    }
}

// Call initApp when the page loads
window.addEventListener('load', initApp);
