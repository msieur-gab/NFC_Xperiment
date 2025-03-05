/**
 * readers.js
 * Handles reader management and token generation
 */

import { AppState } from './state.js';
import { debugLog } from './debug.js';
import { showStatus, updateReadersList } from './ui.js';

/**
 * Generate a token based on settings
 * @returns {string} - Generated token
 */
export function generateToken() {
  const format = AppState.settings.tokenFormat;
  const length = parseInt(AppState.settings.tokenLength);
  
  if (format === 'readable') {
    // Generate a human-readable token (easier to type/read)
    // Avoid confusing characters (0/O, 1/I/l)
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      // Add a dash every 4 characters for better readability
      if (i > 0 && i % 4 === 0) result += '-';
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  } else {
    // Generate a hex token (more secure but harder to type)
    // Use CryptoJS for better randomness
    return CryptoJS.lib.WordArray.random(length / 2).toString();
  }
}

/**
 * Generate and set a new owner token
 */
export function generateOwnerToken() {
  const tokenInput = document.getElementById('ownerToken');
  if (tokenInput) {
    tokenInput.value = generateToken();
    debugLog('Generated new owner token', 'info');
  }
}

/**
 * Add a new reader to the application state
 * @returns {Object|null} - The added reader or null if cancelled
 */
export function addReader() {
  const readerId = prompt("Enter Reader ID:");
  if (!readerId) {
    debugLog('Reader creation cancelled - no ID provided', 'info');
    return null;
  }
  
  // Check if reader ID already exists
  if (AppState.readers.some(r => r.id === readerId)) {
    showStatus(`Reader "${readerId}" already exists`, true);
    debugLog(`Reader "${readerId}" already exists`, 'warning');
    return null;
  }
  
  // Ask if they want to generate or enter a token
  const generateOrEnter = confirm("Click OK to auto-generate a token, or Cancel to enter manually");
  
  let readerToken;
  if (generateOrEnter) {
    readerToken = generateToken();
    debugLog(`Generated token for reader "${readerId}"`, 'info');
  } else {
    readerToken = prompt("Enter Reader Token:");
    if (!readerToken) {
      debugLog('Reader creation cancelled - no token provided', 'info');
      return null;
    }
    debugLog(`User entered token for reader "${readerId}"`, 'info');
  }
  
  // Add to application state
  const newReader = { id: readerId, token: readerToken };
  AppState.addReader(newReader);
  
  // Update UI
  updateReadersList();
  showStatus(`Reader "${readerId}" added`);
  
  return newReader;
}

/**
 * Remove a reader from the application state
 * @param {number} index - The index of the reader to remove
 * @returns {boolean} - True if removed, false otherwise
 */
export function removeReader(index) {
  if (index < 0 || index >= AppState.readers.length) {
    debugLog(`Invalid reader index: ${index}`, 'error');
    return false;
  }
  
  const reader = AppState.readers[index];
  const confirmRemove = confirm(`Remove reader "${reader.id}"?`);
  
  if (confirmRemove) {
    AppState.removeReader(index);
    updateReadersList();
    showStatus('Reader removed');
    debugLog(`Removed reader "${reader.id}"`, 'info');
    return true;
  } else {
    debugLog(`User cancelled removing reader "${reader.id}"`, 'info');
    return false;
  }
}

/**
 * Add a new reader to an existing tag
 * @param {Object} tagData - The tag data
 * @param {string} ownerToken - The owner token
 * @returns {Object|null} - The new reader or null if cancelled
 */
export function addReaderToTag(tagData, ownerToken) {
  debugLog("Adding new reader to tag", 'info');
  
  const readerId = prompt("Enter Reader ID:");
  if (!readerId) {
    debugLog("User cancelled reader ID entry", 'info');
    return null;
  }
  
  // Check if reader ID already exists
  if (tagData.readers.some(r => r.id === readerId)) {
    debugLog(`Reader "${readerId}" already exists in tag`, 'warning');
    showStatus(`Reader "${readerId}" already exists in tag`, true);
    return null;
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
      return null;
    }
    debugLog(`User entered token for reader "${readerId}"`, 'info');
  }
  
  // Add the new reader
  const newReader = { id: readerId, token: readerToken };
  tagData.readers.push(newReader);
  
  debugLog(`Added reader "${readerId}" to tag data`, 'success');
  return newReader;
}

/**
 * Remove a reader from an existing tag
 * @param {Object} tagData - The tag data
 * @param {number} index - The index of the reader to remove
 * @returns {boolean} - True if removed, false otherwise
 */
export function removeReaderFromTag(tagData, index) {
  if (!tagData || !tagData.readers || index < 0 || index >= tagData.readers.length) {
    debugLog("Invalid tag data or reader index", 'error');
    return false;
  }
  
  const confirmRemove = confirm(`Remove reader "${tagData.readers[index].id}"?`);
  if (confirmRemove) {
    const removedReaderId = tagData.readers[index].id;
    tagData.readers.splice(index, 1);
    
    debugLog(`Removed reader "${removedReaderId}" from tag data`, 'info');
    return true;
  } else {
    debugLog("User cancelled reader removal", 'info');
    return false;
  }
}

/**
 * Save readers as contacts
 * @param {string} ownerToken - Token to encrypt contacts with
 * @returns {Promise<boolean>} - True if saved successfully
 */
export async function saveReadersAsContacts(ownerToken) {
  if (!ownerToken || AppState.readers.length === 0) {
    showStatus('No readers to save or missing owner token', true);
    return false;
  }
  
  try {
    // Create contacts data structure
    const contactsData = {
      readers: AppState.readers,
      timestamp: Date.now()
    };
    
    // Encrypt with owner token
    const encryptedData = CryptoJS.AES.encrypt(
      JSON.stringify(contactsData),
      ownerToken
    ).toString();
    
    // Store in localforage
    await localforage.setItem('encrypted_contacts', encryptedData);
    
    debugLog(`Saved ${AppState.readers.length} readers as contacts`, 'success');
    showStatus('Readers saved as contacts');
    return true;
  } catch (error) {
    debugLog(`Error saving readers as contacts: ${error}`, 'error');
    showStatus('Failed to save contacts', true);
    return false;
  }
}

/**
 * Load saved readers from contacts
 * @param {string} ownerToken - Token to decrypt contacts with
 * @returns {Promise<Array>} - Array of loaded readers
 */
export async function loadReadersFromContacts(ownerToken) {
  if (!ownerToken) {
    showStatus('Owner token is required', true);
    return [];
  }
  
  try {
    debugLog("Loading saved readers...", 'info');
    
    // Get encrypted data
    const encryptedData = await localforage.getItem('encrypted_contacts');
    
    if (!encryptedData) {
      debugLog("No stored contacts found", 'info');
      showStatus('No saved readers found');
      return [];
    }
    
    // Decrypt with owner token
    const decryptedBytes = CryptoJS.AES.decrypt(encryptedData, ownerToken);
    const contactsData = JSON.parse(decryptedBytes.toString(CryptoJS.enc.Utf8));
    
    if (!contactsData.readers || !Array.isArray(contactsData.readers)) {
      debugLog("Invalid contacts data format", 'warning');
      showStatus('Invalid contacts data format');
      return [];
    }
    
    debugLog(`Loaded ${contactsData.readers.length} saved readers`, 'success');
    
    // Merge with existing readers, avoiding duplicates
    const existingIds = AppState.readers.map(r => r.id);
    const newReaders = contactsData.readers.filter(r => !existingIds.includes(r.id));
    
    if (newReaders.length > 0) {
      // Add to application state
      newReaders.forEach(reader => AppState.addReader(reader));
      
      // Update UI
      updateReadersList();
      showStatus(`Loaded ${newReaders.length} saved readers`);
    } else {
      showStatus('No new readers to load (all already exist)');
    }
    
    return newReaders;
  } catch (error) {
    debugLog(`Error loading saved readers: ${error}`, 'error');
    showStatus('Failed to load saved readers. Is your token correct?', true);
    return [];
  }
}

/**
 * Initialize readers module
 */
export function initReadersModule() {
  // Add global functions to window for HTML onclick handlers
  window.addReader = addReader;
  window.removeReader = removeReader;
  window.generateOwnerToken = generateOwnerToken;
  
  // Set up tag-specific reader management
  window.addReaderToTag = function() {
    const manageSection = document.getElementById('manage-tag-section');
    if (!manageSection || !manageSection.dataset.tagData) return;
    
    try {
      const tagData = JSON.parse(manageSection.dataset.tagData);
      const ownerToken = manageSection.dataset.accessToken;
      
      // Add the reader
      const newReader = addReaderToTag(tagData, ownerToken);
      if (!newReader) return;
      
      // Update UI
      manageSection.dataset.tagData = JSON.stringify(tagData);
      
      // Use switchToManageTagUI from an import to refresh the UI
      // For this global handler we can use a direct DOM update as a simplification
      const readersList = document.getElementById('manage-readers-list');
      if (readersList) {
        const readerItem = document.createElement('div');
        readerItem.className = 'reader-item';
        readerItem.innerHTML = `
          <div class="reader-info">
            <strong>${newReader.id}</strong><br>
            <span class="token-display">${newReader.token}</span>
          </div>
          <div class="reader-actions">
            <button class="danger" onclick="removeReaderFromTag(${tagData.readers.length - 1})">Remove</button>
          </div>
        `;
        readersList.appendChild(readerItem);
      }
      
      // Show status
      showStatus(`Reader "${newReader.id}" added. Click "Save Changes to Tag" to write to NFC tag.`);
    } catch (error) {
      debugLog(`Error adding reader to tag: ${error}`, 'error');
    }
  };
  
  window.removeReaderFromTag = function(index) {
    const manageSection = document.getElementById('manage-tag-section');
    if (!manageSection || !manageSection.dataset.tagData) return;
    
    try {
      const tagData = JSON.parse(manageSection.dataset.tagData);
      
      // Remove the reader
      if (removeReaderFromTag(tagData, index)) {
        // Update stored data
        manageSection.dataset.tagData = JSON.stringify(tagData);
        
        // Update UI - simplistic approach that just rebuilds the readers list
        const readersList = document.getElementById('manage-readers-list');
        if (readersList) {
          readersList.innerHTML = '';
          
          if (tagData.readers.length === 0) {
            readersList.innerHTML = '<p>No readers added to this tag.</p>';
          } else {
            tagData.readers.forEach((reader, idx) => {
              const readerItem = document.createElement('div');
              readerItem.className = 'reader-item';
              readerItem.innerHTML = `
                <div class="reader-info">
                  <strong>${reader.id}</strong><br>
                  <span class="token-display">${reader.token}</span>
                </div>
                <div class="reader-actions">
                  <button class="danger" onclick="removeReaderFromTag(${idx})">Remove</button>
                </div>
              `;
              readersList.appendChild(readerItem);
            });
          }
        }
        
        // Show reminder to save changes
        showStatus('Reader removed. Click "Save Changes to Tag" to write to NFC tag.');
      }
    } catch (error) {
      debugLog(`Error removing reader from tag: ${error}`, 'error');
    }
  };
  
  const loadSavedReadersBtn = document.getElementById('load-saved-readers-btn');
  if (loadSavedReadersBtn) {
    loadSavedReadersBtn.addEventListener('click', () => {
      const ownerToken = document.getElementById('ownerToken').value;
      if (ownerToken) {
        loadReadersFromContacts(ownerToken);
      } else {
        showStatus('Owner token is required', true);
      }
    });
  }
  
  const saveAsContactsBtn = document.getElementById('save-as-contacts-btn');
  if (saveAsContactsBtn) {
    saveAsContactsBtn.addEventListener('click', () => {
      const ownerToken = document.getElementById('ownerToken').value;
      if (ownerToken) {
        saveReadersAsContacts(ownerToken);
      } else {
        showStatus('Owner token is required', true);
      }
    });
  }
  
  debugLog('Readers module initialized', 'info');
}
