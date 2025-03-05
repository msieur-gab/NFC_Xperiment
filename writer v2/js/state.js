/**
 * state.js
 * Manages the application state and provides access methods
 */

// Application state
export const AppState = {
  // Tag readers array
  readers: [],
  
  // Saved contacts
  contacts: [],
  
  // Current owner token for contacts management
  currentOwnerToken: null,
  
  // App settings
  settings: {
    tokenFormat: 'readable',
    tokenLength: '12'
  },
  
  // NFC operation state
  nfcOperation: {
    mode: 'IDLE', // 'IDLE', 'READING', 'WRITING', 'UPDATING'
    tagData: null, // Store tag data when needed across operations
    ownerToken: null, // Store owner token for authenticated operations
    lastMessage: null // Last scanned message for memory info display
  },
  
  // Debug information
  debug: {
    panelVisible: false,
    logHistory: [],
    MAX_LOG_HISTORY: 100
  },
  
  // State management methods
  setNfcMode(mode) {
    this.nfcOperation.mode = mode;
    return this;
  },
  
  setTagData(data) {
    this.nfcOperation.tagData = data;
    return this;
  },
  
  setOwnerToken(token) {
    this.nfcOperation.ownerToken = token;
    return this;
  },
  
  resetNfcOperation() {
    this.nfcOperation.mode = 'IDLE';
    this.nfcOperation.tagData = null;
    this.nfcOperation.ownerToken = null;
    return this;
  },
  
  addReader(reader) {
    this.readers.push(reader);
    return this;
  },
  
  removeReader(index) {
    if (index >= 0 && index < this.readers.length) {
      this.readers.splice(index, 1);
    }
    return this;
  },
  
  clearReaders() {
    this.readers = [];
    return this;
  },
  
  addContact(contact) {
    this.contacts.push(contact);
    return this;
  },
  
  removeContact(index) {
    if (index >= 0 && index < this.contacts.length) {
      this.contacts.splice(index, 1);
    }
    return this;
  },
  
  setContacts(contacts) {
    this.contacts = contacts || [];
    return this;
  },
  
  updateSetting(key, value) {
    if (this.settings.hasOwnProperty(key)) {
      this.settings[key] = value;
    }
    return this;
  }
};

/**
 * Initialize application state from localStorage
 */
export function initState() {
  // Load saved settings
  const savedSettings = localStorage.getItem('nfc_writer_settings');
  if (savedSettings) {
    try {
      const parsedSettings = JSON.parse(savedSettings);
      // Update only existing settings
      Object.keys(parsedSettings).forEach(key => {
        if (AppState.settings.hasOwnProperty(key)) {
          AppState.settings[key] = parsedSettings[key];
        }
      });
      console.log('Settings loaded from localStorage');
    } catch (e) {
      console.error('Failed to parse settings', e);
    }
  }
  
  // Set debug panel visibility from localStorage
  const debugVisible = localStorage.getItem('nfc_debug_panel_visible') === 'true';
  AppState.debug.panelVisible = debugVisible;
  
  return AppState;
}

/**
 * Save the current state to localStorage
 */
export function saveState() {
  // Save settings
  localStorage.setItem('nfc_writer_settings', JSON.stringify(AppState.settings));
  
  // Save debug panel visibility
  localStorage.setItem('nfc_debug_panel_visible', AppState.debug.panelVisible);
  
  return AppState;
}
