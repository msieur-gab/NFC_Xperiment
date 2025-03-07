/**
 * NFC Vault State Manager
 * Handles all state transitions and ensures consistent state across the application
 */

// Define possible states
const NFC_OPERATION = {
  IDLE: 'IDLE',
  READING: 'READING',
  WRITING: 'WRITING',
  UPDATING: 'UPDATING'
};

const APP_STATE = {
  WELCOME: 'WELCOME',
  CREATE_TAG: 'CREATE_TAG',
  EDIT_TAG: 'EDIT_TAG',
  AUTHENTICATING: 'AUTHENTICATING'
};

const TAG_TYPE = {
  UNKNOWN: 'UNKNOWN',
  EMPTY: 'EMPTY',
  VAULT: 'VAULT',
  INVALID: 'INVALID'
};

class NFCStateManager {
  constructor(callbacks, uiElements) {
    // Operation state
    this.nfcOperation = NFC_OPERATION.IDLE;
    this.appState = APP_STATE.WELCOME;
    this.isWritingMode = false;
    
    // Tag data
    this.currentTagData = null;
    this.pendingTagData = null;
    this.lastTagType = TAG_TYPE.UNKNOWN;
    this.lastSerialNumber = null;
    
    // Authentication
    this.cachedPin = null;
    this.pinCacheTimeout = null;
    this.PIN_CACHE_DURATION = 120000; // 2 minutes
    
    // Callbacks for various operations
    this.callbacks = callbacks || {};
    
    // UI Elements
    this.uiElements = uiElements || {};
    
    // Event subscribers
    this.subscribers = [];
    
    // Debug info
    this.debug = true;
  }
  
  // =====================
  // State Management
  // =====================
  
  /**
   * Set the current NFC operation
   * @param {string} operation - The operation to set (from NFC_OPERATION enum)
   */
  setNfcOperation(operation) {
    if (!Object.values(NFC_OPERATION).includes(operation)) {
      console.error(`Invalid NFC operation: ${operation}`);
      return;
    }
    
    const prevOperation = this.nfcOperation;
    this.nfcOperation = operation;
    
    if (this.debug) {
      console.log(`NFC Operation: ${prevOperation} -> ${operation}`);
    }
    
    this._notifySubscribers('nfcOperation', operation, prevOperation);
    
    // Auto-set writing mode based on operation
    if (operation === NFC_OPERATION.WRITING || operation === NFC_OPERATION.UPDATING) {
      this.setWritingMode(true);
    } else if (operation === NFC_OPERATION.IDLE) {
      this.setWritingMode(false);
    }
  }
  
  /**
   * Set the current app state
   * @param {string} state - The state to set (from APP_STATE enum)
   */
  setAppState(state) {
    if (!Object.values(APP_STATE).includes(state)) {
      console.error(`Invalid app state: ${state}`);
      return;
    }
    
    const prevState = this.appState;
    this.appState = state;
    
    if (this.debug) {
      console.log(`App State: ${prevState} -> ${state}`);
    }
    
    this._notifySubscribers('appState', state, prevState);
    
    // Call specific handler if available
    if (this.callbacks.onAppStateChange) {
      this.callbacks.onAppStateChange(state, prevState);
    }
  }
  
  /**
   * Set writing mode flag
   * @param {boolean} isWriting - Whether we're in writing mode
   */
  setWritingMode(isWriting) {
    const prevMode = this.isWritingMode;
    this.isWritingMode = !!isWriting;
    
    if (prevMode !== this.isWritingMode && this.debug) {
      console.log(`Writing Mode: ${prevMode} -> ${this.isWritingMode}`);
    }
    
    this._notifySubscribers('writingMode', this.isWritingMode, prevMode);
  }
  
  /**
   * Set current tag data
   * @param {Object} tagData - The tag data to set
   */
  setCurrentTagData(tagData) {
    this.currentTagData = tagData;
    
    if (this.debug) {
      console.log('Current tag data updated:', tagData ? 'Data Present' : 'Cleared');
    }
    
    this._notifySubscribers('currentTagData', tagData);
  }
  
  /**
   * Set pending tag data
   * @param {Object} tagData - The pending tag data
   */
  setPendingTagData(tagData) {
    this.pendingTagData = tagData;
    
    if (this.debug) {
      console.log('Pending tag data updated:', tagData ? 'Data Present' : 'Cleared');
    }
    
    this._notifySubscribers('pendingTagData', tagData);
  }
  
  /**
   * Set last detected tag type
   * @param {string} type - The tag type (from TAG_TYPE enum)
   * @param {string} serialNumber - Optional serial number of the tag
   */
  setTagType(type, serialNumber = null) {
    if (!Object.values(TAG_TYPE).includes(type)) {
      console.error(`Invalid tag type: ${type}`);
      return;
    }
    
    const prevType = this.lastTagType;
    this.lastTagType = type;
    this.lastSerialNumber = serialNumber;
    
    if (this.debug) {
      console.log(`Tag Type: ${prevType} -> ${type}${serialNumber ? ` (SN: ${serialNumber})` : ''}`);
    }
    
    this._notifySubscribers('tagType', type, prevType);
    
    // Call tag type change handler if available
    if (this.callbacks.onTagTypeChange) {
      this.callbacks.onTagTypeChange(type, serialNumber);
    }
  }
  
  // =====================
  // Authentication
  // =====================
  
  /**
   * Cache PIN temporarily
   * @param {string} pin - The PIN to cache
   */
  cachePin(pin) {
    // Clear any existing timeout
    if (this.pinCacheTimeout) {
      clearTimeout(this.pinCacheTimeout);
    }
    
    // Store the PIN in memory
    this.cachedPin = pin;
    
    // Set a timeout to clear the PIN
    this.pinCacheTimeout = setTimeout(() => {
      this.clearPinCache();
    }, this.PIN_CACHE_DURATION);
    
    if (this.debug) {
      console.log('PIN cached temporarily for update operations');
    }
  }
  
  /**
   * Clear the PIN cache
   */
  clearPinCache() {
    this.cachedPin = null;
    if (this.pinCacheTimeout) {
      clearTimeout(this.pinCacheTimeout);
      this.pinCacheTimeout = null;
    }
    
    if (this.debug) {
      console.log('PIN cache cleared');
    }
  }
  
  /**
   * Check if PIN is cached
   * @returns {boolean} Whether PIN is cached
   */
  hasCachedPin() {
    return !!this.cachedPin;
  }
  
  /**
   * Get cached PIN
   * @returns {string|null} The cached PIN or null
   */
  getCachedPin() {
    return this.cachedPin;
  }
  
  // =====================
  // State Transitions
  // =====================
  
  /**
   * Start NFC reading operation
   */
  startReading() {
    if (this.nfcOperation !== NFC_OPERATION.IDLE) {
      console.warn(`Cannot start reading while in ${this.nfcOperation} mode`);
      return false;
    }
    
    this.setNfcOperation(NFC_OPERATION.READING);
    return true;
  }
  
  /**
   * Start NFC writing operation
   * @param {boolean} isUpdate - Whether this is an update to existing tag
   */
  startWriting(isUpdate = false) {
    if (this.nfcOperation !== NFC_OPERATION.IDLE) {
      console.warn(`Cannot start writing while in ${this.nfcOperation} mode`);
      return false;
    }
    
    this.setNfcOperation(isUpdate ? NFC_OPERATION.UPDATING : NFC_OPERATION.WRITING);
    return true;
  }
  
  /**
   * Finish current NFC operation
   */
  finishOperation() {
    this.setNfcOperation(NFC_OPERATION.IDLE);
  }
  
  /**
   * Navigate to welcome screen
   */
  goToWelcome() {
    this.setAppState(APP_STATE.WELCOME);
    this.clearPinCache();
    this.setPendingTagData(null);
  }
  
  /**
   * Navigate to tag creation form
   */
  goToCreateTag() {
    this.setAppState(APP_STATE.CREATE_TAG);
    this.setCurrentTagData(null);
  }
  
  /**
   * Navigate to tag edit form
   */
  goToEditTag() {
    this.setAppState(APP_STATE.EDIT_TAG);
  }
  
  /**
   * Set state to authenticating
   */
  goToAuthenticating() {
    this.setAppState(APP_STATE.AUTHENTICATING);
  }
  
  // =====================
  // Event Subscription
  // =====================
  
  /**
   * Subscribe to state changes
   * @param {Function} callback - Function to call on state change
   * @returns {number} Subscription ID
   */
  subscribe(callback) {
    if (typeof callback !== 'function') {
      console.error('Subscribe callback must be a function');
      return -1;
    }
    
    this.subscribers.push(callback);
    return this.subscribers.length - 1;
  }
  
  /**
   * Unsubscribe from state changes
   * @param {number} subscriptionId - ID returned from subscribe()
   */
  unsubscribe(subscriptionId) {
    if (subscriptionId >= 0 && subscriptionId < this.subscribers.length) {
      this.subscribers.splice(subscriptionId, 1);
    }
  }
  
  /**
   * Notify all subscribers of state change
   * @private
   */
  _notifySubscribers(property, newValue, oldValue) {
    this.subscribers.forEach(callback => {
      try {
        callback(property, newValue, oldValue, this);
      } catch (error) {
        console.error('Error in state change subscriber:', error);
      }
    });
  }
  
  // =====================
  // Utility Methods
  // =====================
  
  /**
   * Reset state to initial values
   */
  reset() {
    this.nfcOperation = NFC_OPERATION.IDLE;
    this.appState = APP_STATE.WELCOME;
    this.isWritingMode = false;
    this.currentTagData = null;
    this.pendingTagData = null;
    this.lastTagType = TAG_TYPE.UNKNOWN;
    this.clearPinCache();
    
    if (this.debug) {
      console.log('State manager reset to initial values');
    }
  }
  
  /**
   * Get full current state object
   * @returns {Object} Current state
   */
  getState() {
    return {
      nfcOperation: this.nfcOperation,
      appState: this.appState,
      isWritingMode: this.isWritingMode,
      tagType: this.lastTagType,
      serialNumber: this.lastSerialNumber,
      hasCachedPin: this.hasCachedPin(),
      hasCurrentData: !!this.currentTagData,
      hasPendingData: !!this.pendingTagData
    };
  }
  
  /**
   * Check if it's safe to start a specific operation
   * @param {string} operation - The operation to check
   * @returns {boolean} Whether it's safe to start the operation
   */
  canStartOperation(operation) {
    if (operation === NFC_OPERATION.READING) {
      return !this.isWritingMode && this.nfcOperation === NFC_OPERATION.IDLE;
    }
    
    if (operation === NFC_OPERATION.WRITING || operation === NFC_OPERATION.UPDATING) {
      return this.nfcOperation === NFC_OPERATION.IDLE;
    }
    
    return false;
  }
}

// Export constants and class
export {
  NFC_OPERATION,
  APP_STATE,
  TAG_TYPE,
  NFCStateManager
};
