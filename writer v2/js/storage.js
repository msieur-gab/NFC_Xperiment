/**
 * storage.js
 * Handles local storage operations and contacts management
 */

import { AppState } from './state.js';
import { debugLog } from './debug.js';
import { showStatus, updateContactsList } from './ui.js';

/**
 * Store contacts encrypted with owner's token
 * @param {Array} contacts - Array of contact objects
 * @param {string} ownerToken - Token to encrypt with
 * @returns {Promise<boolean>} - True if successful
 */
export async function storeEncryptedContacts(contacts, ownerToken) {
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
  
  try {
    // Store in localforage
    await localforage.setItem('encrypted_contacts', encryptedData);
    debugLog("Contacts stored successfully", 'success');
    return true;
  } catch (error) {
    debugLog(`Failed to store contacts: ${error}`, 'error');
    throw error;
  }
}

/**
 * Decrypt and load contacts using the owner's token
 * @param {string} ownerToken - Token to decrypt with
 * @returns {Promise<Object>} - Decrypted contacts data
 */
export async function loadEncryptedContacts(ownerToken) {
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
    throw error;
  }
}

/**
 * Unlock contacts with owner token
 * @param {string} ownerToken - Token to decrypt contacts with
 * @returns {Promise<boolean>} - True if successful
 */
export async function unlockContacts(ownerToken) {
  if (!ownerToken) {
    showStatus('Owner token is required', true);
    return false;
  }
  
  debugLog("Attempting to unlock contacts", 'info');
  
  try {
    const contactsData = await loadEncryptedContacts(ownerToken);
    AppState.setContacts(contactsData.readers || []);
    AppState.currentOwnerToken = ownerToken;
    
    // Show contacts container
    const contactsContainer = document.getElementById('contacts-container');
    if (contactsContainer) {
      contactsContainer.style.display = 'block';
    }
    
    // Update contacts list
    updateContactsList();
    
    debugLog("Contacts unlocked successfully", 'success');
    showStatus('Contacts unlocked successfully');
    return true;
  } catch (error) {
    debugLog(`Failed to unlock contacts: ${error}`, 'error');
    showStatus('Failed to unlock contacts. Is your token correct?', true);
    return false;
  }
}

/**
 * Add a new contact
 * @returns {Object|null} - The new contact or null if cancelled
 */
export function addContact() {
  if (!AppState.currentOwnerToken) {
    showStatus('Please unlock contacts first', true);
    return null;
  }
  
  const contactId = prompt("Enter Contact ID:");
  if (!contactId) return null;
  
  // Check for duplicate ID
  if (AppState.contacts.some(c => c.id === contactId)) {
    showStatus(`Contact "${contactId}" already exists`, true);
    return null;
  }
  
  // Ask if they want to generate or enter a token
  const generateOrEnter = confirm("Click OK to auto-generate a token, or Cancel to enter manually");
  
  let contactToken;
  if (generateOrEnter) {
    // Import generateToken from readers.js would be best,
    // but for simplicity we'll use a direct CryptoJS call here
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 12; i++) {
      if (i > 0 && i % 4 === 0) result += '-';
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    contactToken = result;
  } else {
    contactToken = prompt("Enter Contact Token:");
    if (!contactToken) return null;
  }
  
  // Add to contacts
  const newContact = { id: contactId, token: contactToken };
  AppState.addContact(newContact);
  
  // Update UI
  updateContactsList();
  debugLog(`Added contact "${contactId}"`, 'success');
  showStatus(`Contact "${contactId}" added`);
  
  return newContact;
}

/**
 * Remove a contact
 * @param {number} index - Index of contact to remove
 * @returns {boolean} - True if successfully removed
 */
export function removeContact(index) {
  if (index < 0 || index >= AppState.contacts.length) {
    return false;
  }
  
  const confirmRemove = confirm(`Remove contact "${AppState.contacts[index].id}"?`);
  if (confirmRemove) {
    const removedId = AppState.contacts[index].id;
    AppState.removeContact(index);
    updateContactsList();
    debugLog(`Removed contact "${removedId}"`, 'info');
    showStatus('Contact removed');
    return true;
  }
  
  return false;
}

/**
 * Use a contact in the main interface (add to readers)
 * @param {number} index - Index of contact to use
 */
export function useContact(index) {
  if (index < 0 || index >= AppState.contacts.length) {
    return;
  }
  
  const contact = AppState.contacts[index];
  
  // Check if this contact is already in readers
  const existingIndex = AppState.readers.findIndex(reader => reader.id === contact.id);
  
  if (existingIndex !== -1) {
    AppState.readers[existingIndex] = contact; // Update
    debugLog(`Updated existing reader "${contact.id}" from contacts`, 'info');
  } else {
    AppState.addReader(contact); // Add
    debugLog(`Added "${contact.id}" from contacts to readers`, 'success');
  }
  
  // Update UI
  const updateReadersList = window.updateReadersList || (() => {
    debugLog('updateReadersList function not available', 'warning');
  });
  updateReadersList();
  
  // Switch to basic tab
  const basicTab = document.querySelector('.tab[data-tab="basic"]');
  if (basicTab) {
    basicTab.click();
  }
  
  showStatus(`Contact "${contact.id}" added to readers`);
}

/**
 * Save current contacts
 * @returns {Promise<boolean>} - True if successful
 */
export async function saveContacts() {
  if (!AppState.currentOwnerToken) {
    showStatus('Please unlock contacts first', true);
    return false;
  }
  
  try {
    debugLog("Saving contacts...", 'info');
    await storeEncryptedContacts(AppState.contacts, AppState.currentOwnerToken);
    debugLog("Contacts saved successfully", 'success');
    showStatus('Contacts saved successfully');
    return true;
  } catch (error) {
    debugLog(`Error saving contacts: ${error}`, 'error');
    showStatus('Failed to save contacts', true);
    return false;
  }
}

/**
 * Save application settings to localStorage
 */
export function saveSettings() {
  localStorage.setItem('nfc_writer_settings', JSON.stringify(AppState.settings));
  showStatus('Settings saved successfully');
  debugLog('Settings saved to localStorage', 'info');
}

/**
 * Reset settings to defaults
 */
export function resetSettings() {
  AppState.settings = {
    tokenFormat: 'readable',
    tokenLength: '12'
  };
  
  // Update UI elements
  const tokenFormatSelect = document.getElementById('tokenFormat');
  const tokenLengthSelect = document.getElementById('tokenLength');
  
  if (tokenFormatSelect) tokenFormatSelect.value = AppState.settings.tokenFormat;
  if (tokenLengthSelect) tokenLengthSelect.value = AppState.settings.tokenLength;
  
  // Save to localStorage
  localStorage.setItem('nfc_writer_settings', JSON.stringify(AppState.settings));
  showStatus('Settings reset to defaults');
  debugLog('Settings reset to defaults', 'info');
}

/**
 * Initialize storage module
 */
export function initStorageModule() {
  // Add global functions to window for HTML onclick handlers
  window.addContact = addContact;
  window.removeContact = removeContact;
  window.useContact = useContact;
  window.saveContacts = saveContacts;
  window.saveSettings = saveSettings;
  window.resetSettings = resetSettings;
  
  // Unlock contacts button
  const unlockContactsBtn = document.getElementById('unlock-contacts-btn');
  if (unlockContactsBtn) {
    unlockContactsBtn.addEventListener('click', () => {
      const ownerToken = document.getElementById('contactOwnerToken').value;
      if (ownerToken) {
        unlockContacts(ownerToken);
      } else {
        showStatus('Owner token is required', true);
      }
    });
  }
  
  debugLog('Storage module initialized', 'info');
}
