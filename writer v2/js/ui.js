/**
 * ui.js
 * Handles all UI interactions, updates, and screen transitions
 */

import { AppState } from './state.js';
import { debugLog } from './debug.js';
import { estimateTagMemory } from './tags.js';
import { generateToken } from './readers.js';

/**
 * Show a status message with auto-dismiss
 * @param {string} message - The message to display
 * @param {boolean} isError - Whether this is an error message
 * @param {number} timeout - Time in milliseconds before auto-dismiss (0 for no auto-dismiss)
 */
export function showStatus(message, isError = false, timeout = 5000) {
  const statusElement = document.getElementById('status-message');
  if (!statusElement) return;
  
  statusElement.innerHTML = `<div class="${isError ? 'error' : 'status'}">${message}</div>`;
  
  // Log the status
  debugLog(`Status: ${message}`, isError ? 'error' : 'info');
  
  // Clear after timeout (if specified)
  if (timeout > 0) {
    setTimeout(() => {
      // Only clear if the content hasn't been changed
      if (statusElement.innerHTML.includes(message)) {
        statusElement.innerHTML = '';
      }
    }, timeout);
  }
}

/**
 * Update operation status message (with success/error formatting)
 * @param {string} message - Operation status message
 * @param {boolean} isSuccess - Whether operation was successful
 */
export function updateOperationStatus(message, isSuccess = true) {
  const statusElement = document.getElementById('tag-operation-status');
  if (!statusElement) return;
  
  if (isSuccess) {
    statusElement.innerHTML = `
      <div class="success-notification">
        <div class="success-icon">✓</div>
        <div class="success-message">
          <h3>Operation Successful</h3>
          <p>${message}</p>
        </div>
      </div>
    `;
  } else {
    statusElement.innerHTML = `
      <div class="error">
        <p>${message}</p>
      </div>
    `;
  }
  
  // Log the operation status
  debugLog(`Operation Status: ${message}`, isSuccess ? 'success' : 'error');
}

/**
 * Display tag memory information in the UI
 * @param {Object} message - NFC message object
 */
export function displayTagMemoryInfo(message) {
  const memoryInfo = estimateTagMemory(message);
  
  // Create or update memory info display
  const memoryInfoHTML = `
    <div class="memory-info">
      <h4>Tag Memory Information</h4>
      <div class="memory-bar">
        <div class="memory-used" style="width: ${memoryInfo.usagePercentage}%"></div>
      </div>
      <div class="memory-details">
        <p>Estimated tag type: ${memoryInfo.tagType}</p>
        <p>Used: ${memoryInfo.currentUsage} bytes (${memoryInfo.usagePercentage}%)</p>
        <p>Remaining: ${memoryInfo.remainingSpace} bytes</p>
        <p>Estimated capacity: ${memoryInfo.estimatedCapacity} bytes</p>
        <p class="memory-warning ${memoryInfo.usagePercentage > 80 ? 'visible' : ''}">
          ⚠️ Tag memory is getting full. Consider using a larger tag.
        </p>
      </div>
    </div>
  `;
  
  // Add to UI
  const statusElement = document.getElementById('tag-memory-info');
  if (statusElement) {
    statusElement.innerHTML = memoryInfoHTML;
  } else {
    // Create element if it doesn't exist
    const memoryElement = document.createElement('div');
    memoryElement.id = 'tag-memory-info';
    memoryElement.innerHTML = memoryInfoHTML;
    
    // Find a good place to insert it
    const targetElement = document.getElementById('tag-operation-status') || 
                        document.getElementById('status-message');
    if (targetElement) {
      targetElement.parentNode.insertBefore(memoryElement, targetElement.nextSibling);
    }
  }
}

/**
 * Update the readers list in the UI
 */
export function updateReadersList() {
  const list = document.getElementById('readersList');
  if (!list) return;
  
  list.innerHTML = '';
  
  if (AppState.readers.length === 0) {
    list.innerHTML = '<p>No readers added yet.</p>';
    return;
  }
  
  AppState.readers.forEach((reader, index) => {
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

/**
 * Update the contacts list in the UI
 */
export function updateContactsList() {
  const list = document.getElementById('contactsList');
  if (!list) return;
  
  list.innerHTML = '';
  
  if (AppState.contacts.length === 0) {
    list.innerHTML = '<p>No contacts saved yet.</p>';
    return;
  }
  
  debugLog(`Displaying ${AppState.contacts.length} contacts`, 'info');
  
  AppState.contacts.forEach((contact, index) => {
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

/**
 * Set up tab functionality
 */
export function setupTabs() {
  const tabs = document.querySelectorAll('.tab');
  if (!tabs.length) return;
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove active class from all tabs
      tabs.forEach(t => t.classList.remove('active'));
      // Add active class to clicked tab
      tab.classList.add('active');
      
      // Hide all tab contents
      const tabContents = document.querySelectorAll('.tab-content');
      tabContents.forEach(content => content.classList.remove('active'));
      
      // Show selected tab content
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
  
  debugLog('Tab navigation initialized', 'info');
}

/**
 * Show tag preview with encrypted and decrypted views
 */
export function showTagPreview() {
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
    readers: AppState.readers.map(reader => ({
      id: reader.id,
      token: reader.token
    })),
    timestamp: Date.now()
  };
  
  // Create compact data representation
  const compactData = {
    o: ownerToken,
    r: AppState.readers.map(reader => ({
      i: reader.id,
      t: reader.token
    })),
    ts: Date.now()
  };

  const previewElement = document.getElementById('preview-content');
  if (!previewElement) return;
  
  // Show both representations
  previewElement.innerHTML = `
    <h4>Standard Format:</h4>
    <pre style="background-color: #f3f4f6; padding: 10px; overflow-x: auto;">${JSON.stringify(nfcPayload, null, 2)}</pre>
    
    <h4 style="margin-top: 15px;">Compact Format (saves ${Math.round((1 - JSON.stringify(compactData).length / JSON.stringify(nfcPayload).length) * 100)}% space):</h4>
    <pre style="background-color: #f3f4f6; padding: 10px; overflow-x: auto;">${JSON.stringify(compactData, null, 2)}</pre>
    
    <h4 style="margin-top: 15px;">After encryption (actual tag data):</h4>
    <pre style="background-color: #f3f4f6; padding: 10px; overflow-x: auto;">{"v":"1","d":"[encrypted data]"}</pre>
    <p><em>Note: The actual encrypted data will be significantly longer but uses less space than the original implementation.</em></p>
  `;
  
  // Show preview container
  const previewContainer = document.getElementById('tagPreview');
  if (previewContainer) {
    previewContainer.style.display = 'block';
  }
  
  debugLog('Generated tag preview', 'info');
}

/**
 * Switch to token entry UI for existing encrypted tags
 * @param {Object} tagData - The encrypted tag data
 */
export function switchToTokenEntryUI(tagData) {
  debugLog("Switching to token entry UI", 'info');
  
  // Hide other UI sections
  document.getElementById('create-tag-section').style.display = 'none';
  document.getElementById('manage-tag-section').style.display = 'none';
  
  // Show token entry section
  const tokenSection = document.getElementById('token-entry-section');
  if (!tokenSection) return;
  
  tokenSection.style.display = 'block';
  
  // Clear previous token input
  const tokenInput = document.getElementById('accessToken');
  if (tokenInput) {
    tokenInput.value = '';
  }
  
  // Store the encrypted data for later use
  tokenSection.dataset.encryptedData = JSON.stringify(tagData);
  
  // Set up the access button
  const accessButton = document.getElementById('accessButton');
  if (accessButton) {
    accessButton.onclick = () => {
      const token = document.getElementById('accessToken').value;
      if (!token) {
        showStatus("Please enter a token", true);
        return;
      }
      
      // This will be called from an external function with:
      // accessTag(tagData, token);
    };
  }
}

/**
 * Switch to UI for managing an existing tag
 * @param {Object} tagData - The decrypted tag data
 * @param {string} token - The access token
 * @param {string} accessLevel - Access level ('owner' or 'reader')
 * @param {string} readerId - Reader ID (only for reader access)
 */
export function switchToManageTagUI(tagData, token, accessLevel, readerId = null) {
  debugLog(`Switching to tag management UI with ${accessLevel} access`, 'info');
  
  // Hide other UI sections
  document.getElementById('create-tag-section').style.display = 'none';
  document.getElementById('token-entry-section').style.display = 'none';
  
  // Show manage section
  const manageSection = document.getElementById('manage-tag-section');
  if (!manageSection) return;
  
  manageSection.style.display = 'block';
  
  // Update UI based on access level
  const ownerControls = document.getElementById('owner-controls');
  const readerControls = document.getElementById('reader-controls');
  
  if (accessLevel === "owner" && ownerControls) {
    // Owner can see and modify everything
    ownerControls.style.display = 'block';
    if (readerControls) readerControls.style.display = 'none';
    
    // Show owner info
    const ownerIdElement = document.getElementById('owner-id');
    const ownerTokenElement = document.getElementById('owner-token');
    
    if (ownerIdElement) ownerIdElement.textContent = tagData.owner.id;
    if (ownerTokenElement) ownerTokenElement.textContent = tagData.owner.token;
    
    // Populate readers list
    const readersList = document.getElementById('manage-readers-list');
    if (readersList) {
      readersList.innerHTML = '';
      
      if (tagData.readers.length === 0) {
        readersList.innerHTML = '<p>No readers added to this tag.</p>';
        debugLog("No readers found on tag", 'info');
      } else {
        debugLog(`Displaying ${tagData.readers.length} readers`, 'info');
        
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
    }
    
    // Store the current tag data and token for later use
    manageSection.dataset.tagData = JSON.stringify(tagData);
    manageSection.dataset.accessToken = token;
    
  } else if (accessLevel === "reader" && readerControls) {
    // Reader can only see limited information
    if (ownerControls) ownerControls.style.display = 'none';
    readerControls.style.display = 'block';
    
    // Show reader info
    const reader = tagData.readers.find(r => r.id === readerId);
    
    if (reader) {
      const readerIdElement = document.getElementById('reader-id');
      const readerTokenElement = document.getElementById('reader-token');
      
      if (readerIdElement) readerIdElement.textContent = reader.id;
      if (readerTokenElement) readerTokenElement.textContent = reader.token;
      
      debugLog(`Displaying reader info for "${reader.id}"`, 'info');
    }
  }
}

/**
 * Switch to UI for creating a new tag
 */
export function switchToCreateNewTagUI() {
  debugLog("Switching to create new tag UI", 'info');
  
  // Hide other UI sections
  document.getElementById('token-entry-section').style.display = 'none';
  document.getElementById('manage-tag-section').style.display = 'none';
  
  // Show create section
  const createSection = document.getElementById('create-tag-section');
  if (!createSection) return;
  
  createSection.style.display = 'block';
  
  // Reset global state
  AppState.readers = [];
  updateReadersList();
  
  // Generate a new owner token
  const ownerTokenInput = document.getElementById('ownerToken');
  if (ownerTokenInput) {
    ownerTokenInput.value = generateToken();
  }
}

/**
 * Show the scanning animation with appropriate instructions
 * @param {string} operation - The operation being performed ('READING', 'WRITING', 'UPDATING')
 */
export function showScanningAnimation(operation) {
  const scanningElement = document.getElementById('scanning-animation');
  if (!scanningElement) return;
  
  scanningElement.style.display = 'block';
  
  // Clear any previous writing class
  scanningElement.classList.remove('writing');
  
  const instructionElement = scanningElement.querySelector('p');
  
  if (operation === 'WRITING') {
    if (instructionElement) {
      instructionElement.textContent = 'Please bring the NFC tag to the back of your phone to write...';
    }
    showStatus('<span class="write-mode">WRITE MODE</span> Place tag against your device');
  } else if (operation === 'UPDATING') {
    if (instructionElement) {
      instructionElement.textContent = 'Ready to update tag with new readers...';
    }
    showStatus('<span class="write-mode">UPDATE MODE</span> Place the same tag back against your device');
    
    // Clear previous operation status
    const statusElement = document.getElementById('tag-operation-status');
    if (statusElement) statusElement.innerHTML = '';
  } else {
    if (instructionElement) {
      instructionElement.textContent = 'Waiting for NFC tag...';
    }
    showStatus('<span class="read-mode">READ MODE</span> Place tag against your device');
  }
}

/**
 * Hide the scanning animation
 */
export function hideScanningAnimation() {
  const scanningElement = document.getElementById('scanning-animation');
  if (!scanningElement) return;
  
  scanningElement.style.display = 'none';
}

/**
 * Apply changes to the UI based on settings
 */
export function applySettings() {
  // Update token format display in generated tokens
  const ownerTokenInput = document.getElementById('ownerToken');
  if (ownerTokenInput && ownerTokenInput.value) {
    // Regenerate token with new settings
    ownerTokenInput.value = generateToken();
  }
  
  // Update any other UI elements that depend on settings
  debugLog('Applied settings to UI', 'info');
}

/**
 * Show error notification UI
 * @param {string} title - Error title
 * @param {string} message - Error message
 * @param {Array} bulletPoints - Optional list of bullet points
 * @param {string} buttonText - Optional button text
 * @param {Function} buttonAction - Optional button click handler
 */
export function showErrorNotification(title, message, bulletPoints = [], buttonText = null, buttonAction = null) {
  const statusElement = document.getElementById('status-message');
  if (!statusElement) return;
  
  let bulletHTML = '';
  if (bulletPoints.length > 0) {
    bulletHTML = `
      <ul>
        ${bulletPoints.map(point => `<li>${point}</li>`).join('')}
      </ul>
    `;
  }
  
  let buttonHTML = '';
  if (buttonText) {
    buttonHTML = `<button id="error-action-button">${buttonText}</button>`;
  }
  
  statusElement.innerHTML = `
    <div class="error-notification">
      <div class="error-icon">!</div>
      <div class="error-message">
        <h3>${title}</h3>
        <p>${message}</p>
        ${bulletHTML}
        ${buttonHTML}
      </div>
    </div>
  `;
  
  // Attach button action if provided
  if (buttonText && buttonAction) {
    const actionButton = document.getElementById('error-action-button');
    if (actionButton) {
      actionButton.addEventListener('click', buttonAction);
    }
  }
  
  debugLog(`Error notification shown: ${title}`, 'error');
}

/**
 * Show success notification UI
 * @param {string} title - Success title
 * @param {string} message - Success message
 * @param {Array} details - Optional list of detail points
 * @param {number} timeout - Time in ms to auto-dismiss (0 for no auto-dismiss)
 */
export function showSuccessNotification(title, message, details = [], timeout = 0) {
  const statusElement = document.getElementById('status-message');
  if (!statusElement) return;
  
  let detailsHTML = '';
  if (details.length > 0) {
    detailsHTML = details.map(detail => `<p>${detail}</p>`).join('');
  }
  
  statusElement.innerHTML = `
    <div class="success-notification">
      <div class="success-icon">✓</div>
      <div class="success-message">
        <h3>${title}</h3>
        <p>${message}</p>
        ${detailsHTML}
      </div>
    </div>
  `;
  
  debugLog(`Success notification shown: ${title}`, 'success');
  
  // Auto-dismiss if timeout is set
  if (timeout > 0) {
    setTimeout(() => {
      // Only clear if it's still the same notification
      if (statusElement.querySelector('.success-notification')) {
        statusElement.innerHTML = '';
      }
    }, timeout);
  }
}

/**
 * Add a manual tag type selector to the UI
 */
export function addTagTypeSelector() {
  // Create the selector HTML
  const selectorHTML = `
    <div class="tag-type-selector">
      <h4>Manual Tag Type Selection</h4>
      <p>If your tag type is incorrectly detected, select it manually:</p>
      <select id="manual-tag-type">
        <option value="">Auto-detect (default)</option>
        <option value="ntag213">NTAG213 (144 bytes)</option>
        <option value="ntag215">NTAG215 (504 bytes)</option>
        <option value="ntag216">NTAG216 (888 bytes)</option>
        <option value="mifare_ultralight">MIFARE Ultralight (144 bytes)</option>
        <option value="mifare_classic">MIFARE Classic (716 bytes)</option>
      </select>
      <button onclick="applyManualTagType()">Apply</button>
    </div>
  `;
  
  // Add to UI in advanced settings tab
  const advancedTab = document.getElementById('advanced-tab');
  if (advancedTab) {
    const settingsCard = advancedTab.querySelector('.card');
    if (settingsCard) {
      const div = document.createElement('div');
      div.className = 'form-group';
      div.innerHTML = selectorHTML;
      settingsCard.appendChild(div);
      
      debugLog('Added tag type selector to advanced settings', 'info');
    }
  }
}

/**
 * Apply the manually selected tag type
 */
export function applyManualTagType() {
  const selector = document.getElementById('manual-tag-type');
  if (!selector) return;
  
  const selectedType = selector.value;
  
  if (selectedType) {
    // Store in localStorage for persistence
    localStorage.setItem('manual_tag_type', selectedType);
    debugLog(`Manual tag type set to: ${selectedType}`, 'info');
    showStatus(`Tag type manually set to: ${selectedType.toUpperCase()}`);
    
    // Refresh memory info if available
    const memoryInfo = document.getElementById('tag-memory-info');
    if (memoryInfo && AppState.nfcOperation.lastMessage) {
      displayTagMemoryInfo(AppState.nfcOperation.lastMessage);
    }
  } else {
    // Clear manual override
    localStorage.removeItem('manual_tag_type');
    debugLog('Manual tag type selection cleared', 'info');
    showStatus('Tag type detection set to automatic');
  }
}

/**
 * Initialize UI-related event listeners
 */
export function initUIListeners() {
  // Write tag button
  const writeTagButton = document.getElementById('write-tag-button');
  if (writeTagButton) {
    writeTagButton.addEventListener('click', () => {
      // This will be handled externally by startNFCOperation('WRITING')
      debugLog("Write tag button clicked", 'info');
    });
  }
  
  // Preview button
  const previewButton = document.getElementById('preview-button');
  if (previewButton) {
    previewButton.addEventListener('click', () => {
      showTagPreview();
    });
  }
  
  // Setup tab navigation
  setupTabs();
  
  // Add tag type selector
  addTagTypeSelector();
  
  debugLog('UI listeners initialized', 'info');
}
