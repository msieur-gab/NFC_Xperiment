// reader-manager.js - Reader list management
import eventBus from './event-bus.js';
import encryptionService from './encryption-service.js';
import statusDisplay from './status-display.js';

class ReaderManager {
    constructor() {
        this.readers = [];
        this.contacts = [];
        this.currentOwnerToken = null;
    }

    init() {
        // Set up event listeners for UI buttons related to readers
        document.getElementById('add-reader-btn').addEventListener('click', () => this.addReader());
        document.getElementById('load-saved-readers-btn').addEventListener('click', () => this.loadSavedReaders());
        document.getElementById('generate-token-btn').addEventListener('click', () => this.generateOwnerToken());
        document.getElementById('show-preview-btn').addEventListener('click', () => this.showTagPreview());
        
        // Contacts tab event listeners
        document.getElementById('unlock-contacts-btn').addEventListener('click', () => this.unlockContacts());
        document.getElementById('add-contact-btn').addEventListener('click', () => this.addContact());
        document.getElementById('save-contacts-btn').addEventListener('click', () => this.saveContacts());
        
        // Managing existing tag readers
        document.getElementById('add-reader-button').addEventListener('click', () => this.addReaderToTag());
        
        eventBus.publish('log', { message: 'Reader manager initialized', type: 'info' });
    }

    getReaders() {
        return this.readers;
    }

    setReaders(readers) {
        this.readers = readers;
        this.updateReadersList();
        eventBus.publish('readersUpdated', { readers: this.readers });
    }

    // Add a new reader to current session
    addReader() {
        const readerId = prompt("Enter Reader ID:");
        if (!readerId) return;
        
        // Ask if they want to generate or enter a token
        const generateOrEnter = confirm("Click OK to auto-generate a token, or Cancel to enter manually");
        
        let readerToken;
        if (generateOrEnter) {
            readerToken = encryptionService.generateToken();
        } else {
            readerToken = prompt("Enter Reader Token:");
            if (!readerToken) return;
        }
        
        this.readers.push({ id: readerId, token: readerToken });
        this.updateReadersList();
        statusDisplay.showStatus(`Reader "${readerId}" added`);
        eventBus.publish('log', { message: `Added reader "${readerId}"`, type: 'info' });
    }

    // Update the readers list in the UI
    updateReadersList() {
        const list = document.getElementById('readersList');
        list.innerHTML = '';
        
        if (this.readers.length === 0) {
            list.innerHTML = '<p>No readers added yet.</p>';
            return;
        }
        
        this.readers.forEach((reader, index) => {
            const readerDiv = document.createElement('div');
            readerDiv.className = 'reader-item';
            readerDiv.innerHTML = `
                <div class="reader-info">
                    <strong>${reader.id}</strong><br>
                    <span class="token-display">${reader.token}</span>
                </div>
                <div class="reader-actions">
                    <button class="danger" data-index="${index}">Remove</button>
                </div>
            `;
            
            // Add event listener for remove button
            const removeButton = readerDiv.querySelector('button.danger');
            removeButton.addEventListener('click', () => this.removeReader(index));
            
            list.appendChild(readerDiv);
        });
    }

    // Remove a reader
    removeReader(index) {
        const confirmRemove = confirm(`Remove reader "${this.readers[index].id}"?`);
        if (confirmRemove) {
            this.readers.splice(index, 1);
            this.updateReadersList();
            statusDisplay.showStatus('Reader removed');
            eventBus.publish('log', { message: 'Reader removed', type: 'info' });
        }
    }

    // Generate owner token
    generateOwnerToken() {
        document.getElementById('ownerToken').value = encryptionService.generateToken();
        eventBus.publish('log', { message: 'Generated new owner token', type: 'info' });
    }

    // Show preview of the NFC tag data
    showTagPreview() {
        const ownerToken = document.getElementById('ownerToken').value;

        if (!ownerToken) {
            statusDisplay.showStatus('Owner token is required', true);
            return;
        }

        // Create NFC tag payload
        const nfcPayload = {
            owner: {
                id: "owner",
                token: ownerToken
            },
            readers: this.readers.map(reader => ({
                id: reader.id,
                token: reader.token
            })),
            timestamp: Date.now()
        };
        
        // Encrypt the payload
        const encryptedPayload = encryptionService.encrypt(nfcPayload, ownerToken);
        
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
        
        eventBus.publish('log', { message: 'Generated tag preview', type: 'info' });
    }

    // Load saved readers into current session
    async loadSavedReaders() {
        const ownerToken = document.getElementById('ownerToken').value;
        
        if (!ownerToken) {
            statusDisplay.showStatus('Owner token is required', true);
            return;
        }
        
        try {
            eventBus.publish('log', { message: 'Loading saved readers...', type: 'info' });
            const contactsData = await this.loadEncryptedContacts(ownerToken);
            
            if (contactsData.readers && contactsData.readers.length > 0) {
                // Merge with existing readers, avoiding duplicates
                const existingIds = this.readers.map(r => r.id);
                const newReaders = contactsData.readers.filter(r => !existingIds.includes(r.id));
                
                this.readers = [...this.readers, ...newReaders];
                this.updateReadersList();
                
                eventBus.publish('log', { message: `Loaded ${newReaders.length} saved readers`, type: 'success' });
                statusDisplay.showStatus(`Loaded ${newReaders.length} saved readers`);
            } else {
                eventBus.publish('log', { message: 'No saved readers found', type: 'info' });
                statusDisplay.showStatus('No saved readers found');
            }
        } catch (error) {
            eventBus.publish('log', { message: `Error loading saved readers: ${error}`, type: 'error' });
            statusDisplay.showStatus('Failed to load saved readers', true);
        }
    }

    // CONTACTS MANAGEMENT

    // Store contacts encrypted with owner's token
    async storeEncryptedContacts(contacts, ownerToken) {
        eventBus.publish('log', { message: `Storing ${contacts.length} contacts encrypted with owner token`, type: 'info' });
        
        // Create a contacts object
        const contactsData = {
            readers: contacts,
            timestamp: Date.now()
        };
        
        // Encrypt the entire contacts list with the owner's token
        const encryptedData = encryptionService.encrypt(contactsData, ownerToken);
        
        // Store in localforage
        await localforage.setItem('encrypted_contacts', encryptedData);
        eventBus.publish('log', { message: 'Contacts stored successfully', type: 'success' });
        
        return true;
    }

    // Decrypt contacts using the owner's token
    async loadEncryptedContacts(ownerToken) {
        eventBus.publish('log', { message: 'Loading encrypted contacts', type: 'info' });
        
        try {
            // Get encrypted data
            const encryptedData = await localforage.getItem('encrypted_contacts');
            
            if (!encryptedData) {
                eventBus.publish('log', { message: 'No stored contacts found', type: 'info' });
                return { readers: [] };
            }
            
            // Decrypt data
            const contactsData = encryptionService.decrypt(encryptedData, ownerToken);
            
            eventBus.publish('log', { message: `Loaded ${contactsData.readers ? contactsData.readers.length : 0} contacts`, type: 'success' });
            return contactsData;
        } catch (error) {
            eventBus.publish('log', { message: `Failed to decrypt contacts: ${error}`, type: 'error' });
            statusDisplay.showStatus('Failed to decrypt contacts. Is your token correct?', true);
            return { readers: [] };
        }
    }

    // Unlock contacts with owner token
    async unlockContacts() {
        const ownerToken = document.getElementById('contactOwnerToken').value;
        
        if (!ownerToken) {
            statusDisplay.showStatus('Owner token is required', true);
            return;
        }
        
        eventBus.publish('log', { message: 'Attempting to unlock contacts', type: 'info' });
        
        try {
            const contactsData = await this.loadEncryptedContacts(ownerToken);
            this.contacts = contactsData.readers || [];
            this.currentOwnerToken = ownerToken;
            
            // Show contacts container
            document.getElementById('contacts-container').style.display = 'block';
            
            // Update contacts list
            this.updateContactsList();
            
            eventBus.publish('log', { message: 'Contacts unlocked successfully', type: 'success' });
            statusDisplay.showStatus('Contacts unlocked successfully');
        } catch (error) {
            eventBus.publish('log', { message: `Failed to unlock contacts: ${error}`, type: 'error' });
            statusDisplay.showStatus('Failed to unlock contacts', true);
        }
    }

    // Add a new contact
    addContact() {
        if (!this.currentOwnerToken) {
            statusDisplay.showStatus('Please unlock contacts first', true);
            return;
        }
        
        const contactId = prompt("Enter Contact ID:");
        if (!contactId) return;
        
        // Ask if they want to generate or enter a token
        const generateOrEnter = confirm("Click OK to auto-generate a token, or Cancel to enter manually");
        
        let contactToken;
        if (generateOrEnter) {
            contactToken = encryptionService.generateToken();
        } else {
            contactToken = prompt("Enter Contact Token:");
            if (!contactToken) return;
        }
        
        this.contacts.push({ id: contactId, token: contactToken });
        this.updateContactsList();
        eventBus.publish('log', { message: `Added contact "${contactId}"`, type: 'success' });
        statusDisplay.showStatus(`Contact "${contactId}" added`);
    }

    // Update contacts list in the UI
    updateContactsList() {
        const list = document.getElementById('contactsList');
        list.innerHTML = '';
        
        if (this.contacts.length === 0) {
            list.innerHTML = '<p>No contacts saved yet.</p>';
            return;
        }
        
        eventBus.publish('log', { message: `Displaying ${this.contacts.length} contacts`, type: 'info' });
        
        this.contacts.forEach((contact, index) => {
            const contactDiv = document.createElement('div');
            contactDiv.className = 'reader-item';
            contactDiv.innerHTML = `
                <div class="reader-info">
                    <strong>${contact.id}</strong><br>
                    <span class="token-display">${contact.token}</span>
                </div>
                <div class="reader-actions">
                    <button data-index="${index}" class="use-contact">Use</button>
                    <button class="danger" data-index="${index}">Remove</button>
                </div>
            `;
            
            // Add event listeners for buttons
            const useButton = contactDiv.querySelector('.use-contact');
            useButton.addEventListener('click', () => this.useContact(index));
            
            const removeButton = contactDiv.querySelector('button.danger');
            removeButton.addEventListener('click', () => this.removeContact(index));
            
            list.appendChild(contactDiv);
        });
    }

    // Remove a contact
    removeContact(index) {
        const confirmRemove = confirm(`Remove contact "${this.contacts[index].id}"?`);
        if (confirmRemove) {
            const removedId = this.contacts[index].id;
            this.contacts.splice(index, 1);
            this.updateContactsList();
            eventBus.publish('log', { message: `Removed contact "${removedId}"`, type: 'info' });
            statusDisplay.showStatus('Contact removed');
        }
    }

    // Use a contact in the main interface
    useContact(index) {
        const contact = this.contacts[index];
        
        // Check if this contact is already in readers
        const existingIndex = this.readers.findIndex(reader => reader.id === contact.id);
        
        if (existingIndex !== -1) {
            this.readers[existingIndex] = contact; // Update
            eventBus.publish('log', { message: `Updated existing reader "${contact.id}" from contacts`, type: 'info' });
        } else {
            this.readers.push(contact); // Add
            eventBus.publish('log', { message: `Added "${contact.id}" from contacts to readers`, type: 'success' });
        }
        
        this.updateReadersList();
        
        // Switch to basic tab
        eventBus.publish('switchTab', { tab: 'basic' });
        
        statusDisplay.showStatus(`Contact "${contact.id}" added to readers`);
    }

    // Save current contacts
    async saveContacts() {
        if (!this.currentOwnerToken) {
            statusDisplay.showStatus('Please unlock contacts first', true);
            return;
        }
        
        try {
            eventBus.publish('log', { message: 'Saving contacts...', type: 'info' });
            await this.storeEncryptedContacts(this.contacts, this.currentOwnerToken);
            eventBus.publish('log', { message: 'Contacts saved successfully', type: 'success' });
            statusDisplay.showStatus('Contacts saved successfully');
        } catch (error) {
            eventBus.publish('log', { message: `Error saving contacts: ${error}`, type: 'error' });
            statusDisplay.showStatus('Failed to save contacts', true);
        }
    }
    
    // Add a new reader to an existing tag (owner only)
    addReaderToTag() {
        eventBus.publish('log', { message: 'Adding new reader to tag', type: 'info' });
        
        const manageSection = document.getElementById('manage-tag-section');
        const tagData = JSON.parse(manageSection.dataset.tagData);
        
        const readerId = prompt("Enter Reader ID:");
        if (!readerId) {
            eventBus.publish('log', { message: 'User cancelled reader ID entry', type: 'info' });
            return;
        }
        
        // Check if reader ID already exists
        if (tagData.readers.some(r => r.id === readerId)) {
            eventBus.publish('log', { message: `Reader "${readerId}" already exists`, type: 'warning' });
            statusDisplay.showStatus(`Reader "${readerId}" already exists`, true);
            return;
        }
        
        // Generate or enter a token
        const generateOrEnter = confirm("Click OK to auto-generate a token, or Cancel to enter manually");
        
        let readerToken;
        if (generateOrEnter) {
            readerToken = encryptionService.generateToken();
            eventBus.publish('log', { message: `Generated token for reader "${readerId}"`, type: 'info' });
        } else {
            readerToken = prompt("Enter Reader Token:");
            if (!readerToken) {
                eventBus.publish('log', { message: 'User cancelled reader token entry', type: 'info' });
                return;
            }
            eventBus.publish('log', { message: `User entered token for reader "${readerId}"`, type: 'info' });
        }
        
        // Add the new reader
        tagData.readers.push({ id: readerId, token: readerToken });
        eventBus.publish('log', { message: `Added reader "${readerId}" to tag data`, type: 'success' });
        
        // Update UI with new tag data
        manageSection.dataset.tagData = JSON.stringify(tagData);
        
        // Publish event for tag management UI to update
        eventBus.publish('tagDataUpdated', { 
            tagData: tagData, 
            token: manageSection.dataset.accessToken,
            accessLevel: "owner"
        });
        
        // Update operation status to remind user to save changes
        statusDisplay.updateOperationStatus(`Reader "${readerId}" added. Click "Save Changes to Tag" to write to NFC tag.`, true);
        statusDisplay.showStatus(`Reader "${readerId}" added. Click "Save Changes to Tag" to write to NFC tag.`);
    }

    // Remove a reader from an existing tag (owner only)
    removeReaderFromTag(index) {
        const manageSection = document.getElementById('manage-tag-section');
        const tagData = JSON.parse(manageSection.dataset.tagData);
        
        const confirmRemove = confirm(`Remove reader "${tagData.readers[index].id}"?`);
        if (confirmRemove) {
            const removedReaderId = tagData.readers[index].id;
            tagData.readers.splice(index, 1);
            
            eventBus.publish('log', { message: `Removed reader "${removedReaderId}" from tag data`, type: 'info' });
            
            // Update UI with new tag data
            manageSection.dataset.tagData = JSON.stringify(tagData);
            
            // Publish event for tag management UI to update
            eventBus.publish('tagDataUpdated', { 
                tagData: tagData, 
                token: manageSection.dataset.accessToken,
                accessLevel: "owner"
            });
            
            // Update operation status to remind user to save changes
            statusDisplay.updateOperationStatus('Reader removed. Click "Save Changes to Tag" to write to NFC tag.', true);
            statusDisplay.showStatus('Reader removed. Click "Save Changes to Tag" to write to NFC tag.');
        } else {
            eventBus.publish('log', { message: 'User cancelled reader removal', type: 'info' });
        }
    }
    
    // Function to recover last write attempt
    recoverLastWriteAttempt(lastAttempt) {
        if (lastAttempt && lastAttempt.ownerToken && lastAttempt.readers) {
            // Restore the data
            document.getElementById('ownerToken').value = lastAttempt.ownerToken;
            this.readers = lastAttempt.readers;
            this.updateReadersList();
            
            eventBus.publish('log', { message: `Recovered ${this.readers.length} readers from previous attempt`, type: 'success' });
            statusDisplay.showStatus('Previous write data recovered successfully');
            
            // Don't remove the backup yet - keep until successful write
        }
    }
}

// Create and export a singleton instance
const readerManager = new ReaderManager();
export default readerManager;
