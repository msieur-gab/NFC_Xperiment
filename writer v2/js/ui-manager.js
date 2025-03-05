// ui-manager.js - UI state management
import eventBus from './event-bus.js';
import statusDisplay from './status-display.js';
import readerManager from './reader-manager.js';

class UIManager {
    constructor() {
        // State for UI management
        this.activeUI = null;
    }

    init() {
        // Initialize button event listeners
        document.getElementById('create-new-instead-btn').addEventListener('click', () => this.switchToCreateNewTagUI());
        document.getElementById('create-new-tag-button').addEventListener('click', () => this.switchToCreateNewTagUI());
        
        // Subscribe to relevant events
        eventBus.subscribe('switchUI', data => {
            if (data.ui === 'createNew') {
                this.switchToCreateNewTagUI();
            } else if (data.ui === 'tokenEntry') {
                this.switchToTokenEntryUI(data.tagData);
            } else if (data.ui === 'manageTag') {
                this.switchToManageTagUI(data.tagData, data.token, data.accessLevel, data.readerId);
            }
        });
        
        // Subscribe to tag data updates
        eventBus.subscribe('tagDataUpdated', data => {
            this.switchToManageTagUI(data.tagData, data.token, data.accessLevel, data.readerId);
        });
        
        eventBus.publish('log', { message: 'UI manager initialized', type: 'info' });
    }

    // Switch to token entry UI for existing encrypted tags
    switchToTokenEntryUI(tagData) {
        eventBus.publish('log', { message: 'Switching to token entry UI', type: 'info' });
        
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
        
        // Set up the access button (if not already set up)
        if (!document.getElementById('accessButton').hasAttribute('data-initialized')) {
            document.getElementById('accessButton').setAttribute('data-initialized', 'true');
            document.getElementById('accessButton').addEventListener('click', () => {
                const token = document.getElementById('accessToken').value;
                if (!token) {
                    statusDisplay.showStatus("Please enter a token", true);
                    return;
                }
                
                // Publish event to attempt tag access with token
                eventBus.publish('accessTag', { 
                    tagData: JSON.parse(tokenSection.dataset.encryptedData), 
                    token: token 
                });
            });
        }
        
        this.activeUI = 'tokenEntry';
    }

    // Switch to UI for managing an existing tag
    switchToManageTagUI(tagData, token, accessLevel, readerId = null) {
        eventBus.publish('log', { message: `Switching to tag management UI with ${accessLevel} access`, type: 'info' });
        
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
                eventBus.publish('log', { message: 'No readers found on tag', type: 'info' });
            } else {
                eventBus.publish('log', { message: `Displaying ${tagData.readers.length} readers`, type: 'info' });
                
                tagData.readers.forEach((reader, index) => {
                    const readerItem = document.createElement('div');
                    readerItem.className = 'reader-item';
                    readerItem.innerHTML = `
                        <div class="reader-info">
                            <strong>${reader.id}</strong><br>
                            <span class="token-display">${reader.token}</span>
                        </div>
                        <div class="reader-actions">
                            <button class="danger" data-index="${index}">Remove</button>
                        </div>
                    `;
                    
                    // Add event listener for remove button
                    const removeButton = readerItem.querySelector('button.danger');
                    removeButton.addEventListener('click', () => {
                        // Delegate to reader manager for removal
                        readerManager.removeReaderFromTag(index);
                    });
                    
                    readersList.appendChild(readerItem);
                });
            }
            
            // Store the current tag data and token for later use
            manageSection.dataset.tagData = JSON.stringify(tagData);
            manageSection.dataset.accessToken = token;
        } else if (accessLevel === "reader") {
            // Reader can only see limited information
            document.getElementById('owner-controls').style.display = 'none';
            document.getElementById('reader-controls').style.display = 'block';
            
            // Show reader info
            const reader = tagData.readers.find(r => r.id === readerId);
            if (reader) {
                document.getElementById('reader-id').textContent = reader.id;
                document.getElementById('reader-token').textContent = reader.token;
                
                eventBus.publish('log', { message: `Displaying reader info for "${reader.id}"`, type: 'info' });
            } else {
                eventBus.publish('log', { message: `Reader ID ${readerId} not found`, type: 'warning' });
            }
        }
        
        this.activeUI = 'manageTag';
    }

    // Switch to UI for creating a new tag
    switchToCreateNewTagUI() {
        eventBus.publish('log', { message: 'Switching to create new tag UI', type: 'info' });
        
        // Hide other UI sections
        document.getElementById('token-entry-section').style.display = 'none';
        document.getElementById('manage-tag-section').style.display = 'none';
        
        // Show create section
        document.getElementById('create-tag-section').style.display = 'block';
        
        // Init with empty readers list if not already present
        if (readerManager.getReaders().length === 0) {
            // Generate a new owner token if empty
            if (!document.getElementById('ownerToken').value) {
                readerManager.generateOwnerToken();
            }
        }
        
        this.activeUI = 'createNew';
    }

    getActiveUI() {
        return this.activeUI;
    }
}

// Create and export a singleton instance
const uiManager = new UIManager();
export default uiManager;
