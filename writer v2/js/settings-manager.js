// settings-manager.js - Application settings management
import eventBus from './event-bus.js';
import statusDisplay from './status-display.js';

class SettingsManager {
    constructor() {
        this.settings = {
            tokenFormat: 'readable',
            tokenLength: '12'
        };
    }
    
    init() {
        // Load settings
        this.loadSettings();
        
        // Apply settings to UI
        this.applySettingsToUI();
        
        // Set up event handlers for settings form
        document.getElementById('save-settings-btn').addEventListener('click', () => this.saveSettings());
        document.getElementById('reset-settings-btn').addEventListener('click', () => this.resetSettings());
        
        eventBus.publish('log', { message: 'Settings manager initialized', type: 'info' });
    }
    
    // Load settings from localStorage
    loadSettings() {
        const savedSettings = localStorage.getItem('nfc_writer_settings');
        if (savedSettings) {
            try {
                this.settings = JSON.parse(savedSettings);
                eventBus.publish('log', { message: 'Settings loaded from storage', type: 'info' });
            } catch (e) {
                console.error('Failed to parse settings', e);
                eventBus.publish('log', { message: `Failed to parse settings: ${e}`, type: 'error' });
            }
        } else {
            eventBus.publish('log', { message: 'No saved settings found, using defaults', type: 'info' });
        }
        
        // Publish settings loaded event
        eventBus.publish('settingsLoaded', { settings: this.settings });
    }
    
    // Apply current settings to UI
    applySettingsToUI() {
        document.getElementById('tokenFormat').value = this.settings.tokenFormat;
        document.getElementById('tokenLength').value = this.settings.tokenLength;
    }
    
    // Save current settings from UI
    saveSettings() {
        this.settings.tokenFormat = document.getElementById('tokenFormat').value;
        this.settings.tokenLength = document.getElementById('tokenLength').value;
        
        localStorage.setItem('nfc_writer_settings', JSON.stringify(this.settings));
        statusDisplay.showStatus('Settings saved successfully');
        
        eventBus.publish('log', { message: 'Settings saved', type: 'info' });
        
        // Publish settings updated event
        eventBus.publish('settingsUpdated', { settings: this.settings });
    }
    
    // Reset settings to defaults
    resetSettings() {
        this.settings = {
            tokenFormat: 'readable',
            tokenLength: '12'
        };
        
        this.applySettingsToUI();
        localStorage.setItem('nfc_writer_settings', JSON.stringify(this.settings));
        statusDisplay.showStatus('Settings reset to defaults');
        
        eventBus.publish('log', { message: 'Settings reset to defaults', type: 'info' });
        
        // Publish settings updated event
        eventBus.publish('settingsUpdated', { settings: this.settings });
    }
    
    // Get current settings
    getSettings() {
        return { ...this.settings };
    }
}

// Create and export a singleton instance
const settingsManager = new SettingsManager();
export default settingsManager;
