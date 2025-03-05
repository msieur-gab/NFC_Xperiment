// app.js - Main Application Initializer
import EventBus from './js/event-bus.js';
import NFCManager from './js/nfc-manager.js';
import EncryptionService from './js/encryption-service.js';
import ReaderManager from './js/reader-manager.js';
import StatusDisplay from './js/status-display.js';
import TabManager from './js/tab-manager.js';
import DebugPanel from './js/debug-panel.js';

class NFCApp {
    constructor() {
        // Initialize core services
        this.eventBus = new EventBus();
        this.encryptionService = new EncryptionService();
        this.readerManager = new ReaderManager(this.eventBus);
        this.nfcManager = new NFCManager(this.eventBus, this.encryptionService);
        
        // UI Components
        this.statusDisplay = new StatusDisplay(this.eventBus);
        this.tabManager = new TabManager(this.eventBus);
        this.debugPanel = new DebugPanel(this.eventBus);

        // Default settings
        this.defaultSettings = {
            tokenFormat: 'readable',
            tokenLength: '12'
        };

        // Binding methods to ensure correct context
        this.initializeApp = this.initializeApp.bind(this);
        this.setupGlobalMethods = this.setupGlobalMethods.bind(this);
        this.switchToCreateNewTagUI = this.switchToCreateNewTagUI.bind(this);
        this.loadSettings = this.loadSettings.bind(this);
        this.saveSettings = this.saveSettings.bind(this);
        this.resetSettings = this.resetSettings.bind(this);
    }

    // Main initialization method
    init() {
        console.log('Initializing NFCApp');
        
        // Ensure DOM is fully loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', this.initializeApp);
        } else {
            this.initializeApp();
        }
    }

    // Comprehensive app initialization
    initializeApp() {
        console.log('App initialization started');
        
        // Setup global methods for inline event handlers
        this.setupGlobalMethods();

        // Show basic UI section by default
        this.showDefaultSection();

        // Load and apply settings
        this.loadSettings();

        // Check URL params
        const urlParams = new URLSearchParams(window.location.search);
        const action = urlParams.get('action');

        if (action === 'read') {
            this.nfcManager.startNFCOperation('READING');
        } else {
            // Always show create new tag UI by default
            this.switchToCreateNewTagUI();
        }

        console.log('App initialization complete');
    }

    // Method to explicitly show the default section
    showDefaultSection() {
        // Hide all sections first
        const sections = document.querySelectorAll('.tag-access-section');
        sections.forEach(section => {
            section.style.display = 'none';
        });

        // Show create tag section
        const createTagSection = document.getElementById('create-tag-section');
        if (createTagSection) {
            createTagSection.style.display = 'block';
            console.log('Default section shown');
        } else {
            console.error('Create tag section not found');
        }
    }

    // Load settings from localStorage
    loadSettings() {
        try {
            const savedSettings = localStorage.getItem('nfc_writer_settings');
            const settings = savedSettings 
                ? JSON.parse(savedSettings) 
                : { ...this.defaultSettings };

            // Update UI elements if they exist
            const tokenFormatSelect = document.getElementById('tokenFormat');
            const tokenLengthSelect = document.getElementById('tokenLength');

            if (tokenFormatSelect) {
                tokenFormatSelect.value = settings.tokenFormat || this.defaultSettings.tokenFormat;
            }

            if (tokenLengthSelect) {
                tokenLengthSelect.value = settings.tokenLength || this.defaultSettings.tokenLength;
            }

            return settings;
        } catch (error) {
            console.error('Failed to load settings:', error);
            this.statusDisplay.showError('Failed to load settings');
            return { ...this.defaultSettings };
        }
    }

    // Save current settings
    saveSettings() {
        try {
            const tokenFormatSelect = document.getElementById('tokenFormat');
            const tokenLengthSelect = document.getElementById('tokenLength');

            if (!tokenFormatSelect || !tokenLengthSelect) {
                throw new Error('Settings elements not found');
            }

            const settings = {
                tokenFormat: tokenFormatSelect.value,
                tokenLength: tokenLengthSelect.value
            };

            localStorage.setItem('nfc_writer_settings', JSON.stringify(settings));
            this.statusDisplay.showStatus('Settings saved successfully');
        } catch (error) {
            console.error('Failed to save settings:', error);
            this.statusDisplay.showError('Failed to save settings');
        }
    }

    // Reset settings to defaults
    resetSettings() {
        try {
            const tokenFormatSelect = document.getElementById('tokenFormat');
            const tokenLengthSelect = document.getElementById('tokenLength');

            if (!tokenFormatSelect || !tokenLengthSelect) {
                throw new Error('Settings elements not found');
            }

            // Set to default values
            tokenFormatSelect.value = this.defaultSettings.tokenFormat;
            tokenLengthSelect.value = this.defaultSettings.tokenLength;

            // Save default settings
            localStorage.setItem('nfc_writer_settings', JSON.stringify(this.defaultSettings));
            
            this.statusDisplay.showStatus('Settings reset to defaults');
        } catch (error) {
            console.error('Failed to reset settings:', error);
            this.statusDisplay.showError('Failed to reset settings');
        }
    }

    // Switch to create new tag UI
    switchToCreateNewTagUI() {
        console.log('Switching to create new tag UI');
        
        // Hide other sections
        const sections = document.querySelectorAll('.tag-access-section');
        sections.forEach(section => {
            section.style.display = 'none';
        });
        
        // Show create section
        const createTagSection = document.getElementById('create-tag-section');
        if (createTagSection) {
            createTagSection.style.display = 'block';
        } else {
            console.error('Create tag section not found');
            return;
        }
        
        // Reset readers list
        this.readerManager = new ReaderManager(this.eventBus);
        
        // Generate owner token
        const ownerTokenInput = document.getElementById('ownerToken');
        if (ownerTokenInput) {
            const ownerToken = this.encryptionService.generateToken({
                tokenFormat: 'readable',
                tokenLength: '12'
            });
            ownerTokenInput.value = ownerToken;
        } else {
            console.error('Owner token input not found');
        }
        
        // Setup write button
        const writeTagButton = document.getElementById('write-tag-button');
        if (writeTagButton) {
            writeTagButton.onclick = () => {
                this.nfcManager.startNFCOperation('WRITING');
            };
        } else {
            console.error('Write tag button not found');
        }
    }

    // Setup global methods for inline event handlers
    setupGlobalMethods() {
        // Expose methods to global window object
        window.generateOwnerToken = () => {
            const ownerTokenInput = document.getElementById('ownerToken');
            if (ownerTokenInput) {
                const token = this.encryptionService.generateToken({
                    tokenFormat: 'readable',
                    tokenLength: '12'
                });
                ownerTokenInput.value = token;
            }
        };

        // Global methods for reader management
        window.addReader = () => {
            const readerId = prompt("Enter Reader ID:");
            if (!readerId) return;
            
            const generateOrEnter = confirm("Click OK to auto-generate a token, or Cancel to enter manually");
            
            let readerToken;
            if (generateOrEnter) {
                readerToken = this.encryptionService.generateToken({
                    tokenFormat: 'readable',
                    tokenLength: '12'
                });
            } else {
                readerToken = prompt("Enter Reader Token:");
                if (!readerToken) return;
            }
            
            this.readerManager.addReader(readerId, readerToken);
        };

        // Method to remove reader
        window.removeReader = (index) => {
            this.readerManager.removeReader(index);
        };

        // Show tag preview
        window.showTagPreview = () => {
            const ownerTokenInput = document.getElementById('ownerToken');
            const previewContentElement = document.getElementById('preview-content');
            const tagPreviewElement = document.getElementById('tagPreview');

            if (!ownerTokenInput || !previewContentElement || !tagPreviewElement) {
                this.statusDisplay.showError('Required elements not found');
                return;
            }

            const ownerToken = ownerTokenInput.value;

            if (!ownerToken) {
                this.statusDisplay.showError('Owner token is required');
                return;
            }

            // Create NFC tag payload
            const nfcPayload = {
                owner: {
                    id: "owner",
                    token: ownerToken
                },
                readers: this.readerManager.getReaders(),
                timestamp: Date.now()
            };
            
            // Encrypt the payload
            const encryptedPayload = this.encryptionService.encrypt(
                nfcPayload,
                ownerToken
            );
            
            // Create wrapper
            const tagData = {
                type: "encrypted_nfc_multi_user",
                version: "1.0",
                data: encryptedPayload
            };

            // Show both encrypted and decrypted views
            previewContentElement.innerHTML = `
                <h4>Encrypted Data (This is what will be written to tag):</h4>
                <pre style="background-color: #f3f4f6; padding: 10px; overflow-x: auto;">${JSON.stringify(tagData, null, 2)}</pre>
                
                <h4 style="margin-top: 15px;">Decrypted Data (Only visible with correct token):</h4>
                <pre style="background-color: #f3f4f6; padding: 10px; overflow-x: auto;">${JSON.stringify(nfcPayload, null, 2)}</pre>
            `;
            tagPreviewElement.style.display = 'block';
        };

        // Start NFC operation
        window.startNFCOperation = (operation) => {
            this.nfcManager.startNFCOperation(operation);
        };

        // Expose settings methods
        window.saveSettings = this.saveSettings.bind(this);
        window.resetSettings = this.resetSettings.bind(this);
    }
}

// Bootstrap the application
function initApp() {
    console.log('Bootstrapping NFCApp');
    const app = new NFCApp();
    window.app = app;
    app.init();
}

// Ensure the script runs after everything is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

export default NFCApp;