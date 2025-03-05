/**
 * tags.js
 * Handles NFC tag operations including reading, writing and memory handling
 */

import { AppState } from './state.js';
import { debugLog } from './debug.js';
import { encryptTagData, decryptTagData, decryptLegacyData } from './crypto.js';
import { 
  showStatus, 
  displayTagMemoryInfo, 
  showScanningAnimation, 
  hideScanningAnimation,
  switchToCreateNewTagUI,
  switchToTokenEntryUI,
  showSuccessNotification,
  updateOperationStatus
} from './ui.js';

// Global NFC reader instance
let ndef = null;
let isWriting = false;

/**
 * Safely stop the NFC reader
 * @param {NDEFReader} reader - The reader to stop
 * @returns {Promise} - Resolves when reader is stopped
 */
export async function safeStopNFC(reader) {
  if (!reader) return;
  
  try {
    // Multiple methods to try stopping the NFC reader
    const stopMethods = [
      'stop',         // Standard method
      'stopScan',     // Alternative method
      'close',        // Generic close method
      'abortScan'     // Direct abort method
    ];
    
    let stopped = false;
    
    for (const method of stopMethods) {
      if (typeof reader[method] === 'function') {
        try {
          await reader[method]();
          debugLog(`Stopped NFC reader using ${method}()`, 'info');
          stopped = true;
          break;
        } catch (methodError) {
          debugLog(`Error using ${method}(): ${methodError}`, 'warning');
        }
      }
    }
    
    // If no standard methods work, try an alternative approach
    if (!stopped) {
      // Some browsers might require manually removing event listeners
      if (reader.removeEventListener) {
        try {
          // Using generic handlers here since we can't directly reference the bound handlers
          reader.removeEventListener('reading', () => {});
          reader.removeEventListener('error', () => {});
          debugLog('Removed NFC event listeners', 'info');
        } catch (listenerError) {
          debugLog(`Error removing listeners: ${listenerError}`, 'warning');
        }
      }
      
      debugLog('No standard stop method available on this NFC reader', 'warning');
    }
  } catch (error) {
    debugLog(`Unexpected error stopping NFC reader: ${error}`, 'error');
  } finally {
    // Always reset the global NFC reader reference
    ndef = null;
  }
}

/**
 * Master NFC handler that manages all NFC operations
 * @param {string} operation - Type of operation ('READ', 'WRITING', 'UPDATING')
 * @param {Object} contextData - Optional context data for the operation
 * @returns {Promise} - Resolves when operation is complete
 */
export async function startNFCOperation(operation = 'READ', contextData = null) {
  if (!('NDEFReader' in window)) {
    showStatus("NFC not supported on this device", true);
    debugLog("NFC not supported on this device", "error");
    return;
  }

  // Update global state
  AppState.setNfcMode(operation);
  if (contextData) {
    if (contextData.tagData) AppState.setTagData(contextData.tagData);
    if (contextData.ownerToken) AppState.setOwnerToken(contextData.ownerToken);
  }
  
  debugLog(`Starting NFC operation: ${operation}`, 'info');
  
  // Show scanning animation
  showScanningAnimation(operation);
  
  try {
    // Stop existing NFC reader if active
    if (ndef) {
      await safeStopNFC(ndef);
    }
    
    // Create new NFC reader
    ndef = new NDEFReader();
    
    debugLog('Created new NDEFReader instance', 'info');
    
    // Set up central NFC tag detection handler
    ndef.addEventListener("reading", async ({ message, serialNumber }) => {
      debugLog(`Tag detected in ${operation} mode. Serial: ${serialNumber}`, 'info');
      
      // Save message for memory info display
      AppState.nfcOperation.lastMessage = message;
      
      // Handle the tag based on current operation state
      switch (AppState.nfcOperation.mode) {
        case 'WRITING':
          await handleTagInWriteMode(ndef, message, serialNumber);
          break;
        case 'UPDATING':
          await handleTagInUpdateMode(ndef, message, serialNumber);
          break;
        default: // 'READING' or other states default to read
          await handleTagInReadMode(message, serialNumber);
      }
    });
    
    // Log error events
    ndef.addEventListener("error", (error) => {
      debugLog(`NFC error: ${error}`, 'error');
      showStatus(`NFC error: ${error.message || error}`, true);
    });
    
    // Show permission request message before scanning
    showStatus('Requesting NFC permission...', false);
    
    // Start scanning
    try {
      await ndef.scan();
      debugLog('NFC scanning started', 'info');
      showStatus(`<span class="${operation === 'READING' ? 'read-mode' : 'write-mode'}">${operation} MODE</span> Place tag against your device`);
    } catch (scanError) {
      // Handle permission denied specifically
      if (scanError.name === 'NotAllowedError') {
        hideScanningAnimation();
        
        // Show a more helpful error message with instructions
        const permissionMessage = `
          <div class="error-notification">
            <div class="error-icon">!</div>
            <div class="error-message">
              <h3>NFC Permission Required</h3>
              <p>This app needs permission to use your device's NFC reader.</p>
              <p>Please check:</p>
              <ul>
                <li>NFC is enabled in your device settings</li>
                <li>You've allowed this site to use NFC</li>
                <li>You're using a supported browser (Chrome for Android)</li>
              </ul>
              <button onclick="requestNFCPermission()">Try Again</button>
            </div>
          </div>
        `;
        
        const statusElement = document.getElementById('status-message');
        if (statusElement) {
          statusElement.innerHTML = permissionMessage;
        }
        
        debugLog('NFC permission denied by user or system', 'error');
        throw scanError;
      } else {
        // Re-throw other errors to be caught by the outer catch
        throw scanError;
      }
    }
    
  } catch (error) {
    hideScanningAnimation();
    
    if (error.name !== 'NotAllowedError') {
      // Only show generic error for non-permission errors (permission has its own UI)
      showStatus(`Error with NFC: ${error.message || error}`, true);
    }
    
    debugLog(`NFC initialization error: ${error}`, 'error');
    // Reset state on error
    AppState.resetNfcOperation();
  }
}

/**
 * Handle tag in write mode (new tag)
 * @param {NDEFReader} ndef - The NFC reader
 * @param {NDEFMessage} message - The NFC message
 * @param {string} serialNumber - The tag serial number
 */
async function handleTagInWriteMode(ndef, message, serialNumber) {
  debugLog(`Handling tag in WRITE mode. Serial: ${serialNumber}`, 'info');
  
  // Set writing flag to prevent multiple operations
  isWriting = true;
  
  // Display memory information
  displayTagMemoryInfo(message);
  
  // Extensive pre-write checks
  let hasAnyData = message.records && message.records.length > 0;
  let isOurFormat = false;
  let existingTagDetails = {
    recordCount: 0,
    recordTypes: [],
    potentialDataSizes: []
  };
  
  if (hasAnyData) {
    debugLog(`Existing tag has ${message.records.length} records`, 'info');
    
    // Detailed existing data logging
    for (const record of message.records) {
      try {
        // Log record type
        existingTagDetails.recordCount++;
        existingTagDetails.recordTypes.push(record.recordType);
        
        // Try to get record size
        try {
          const recordSize = new Blob([record.data]).size;
          existingTagDetails.potentialDataSizes.push(recordSize);
          debugLog(`Record type: ${record.recordType}, Size: ${recordSize} bytes`, 'info');
        } catch (sizeError) {
          debugLog(`Could not calculate record size: ${sizeError}`, 'warning');
        }
        
        // Attempt to decode text records to check format
        if (record.recordType === "text") {
          const textDecoder = new TextDecoder();
          const text = textDecoder.decode(record.data);
          
          // Try to parse and log existing data structure
          try {
            const existingData = JSON.parse(text);
            debugLog(`Existing record content type: ${existingData.type || existingData.v || 'Unknown'}`, 'info');
            
            // Check if it's our format (legacy or new)
            if (existingData.type === "owner" || 
                existingData.type === "encrypted_owner" ||
                existingData.type === "encrypted_nfc_multi_user" ||
                existingData.v === "1") {
              isOurFormat = true;
              debugLog('Recognized existing tag format', 'info');
            }
          } catch (parseError) {
            debugLog(`Could not parse record content: ${parseError}`, 'warning');
          }
        }
      } catch (decodeError) {
        debugLog(`Could not process record: ${decodeError}`, 'warning');
      }
    }
  } else {
    debugLog(`Tag appears to be empty`, 'info');
  }
  
  // If it has data, confirm overwrite
  if (hasAnyData) {
    // Prepare confirmation message based on tag contents
    let confirmMessage = isOurFormat ? 
      `This tag already contains data from this app (${existingTagDetails.recordCount} records). Overwrite?` :
      `This tag contains ${existingTagDetails.recordCount} records in an unknown format. Overwriting will erase all existing data. Continue?`;
    
    debugLog(`Asking for confirmation: ${confirmMessage}`, 'info');
    
    const confirmOverwrite = confirm(confirmMessage);
    if (!confirmOverwrite) {
      hideScanningAnimation();
      showStatus("Writing cancelled - existing data preserved", true);
      debugLog("User cancelled writing", 'info');
      AppState.resetNfcOperation();
      isWriting = false;
      return;
    }
  }
  
  try {
    // Show writing animation
    const scanningElement = document.getElementById('scanning-animation');
    if (scanningElement) {
      scanningElement.classList.add('writing');
      const textElement = scanningElement.querySelector('p');
      if (textElement) {
        textElement.textContent = 'Writing tag...';
      }
    }
    
    debugLog("About to write tag data", 'info');
    
    // Comprehensive write attempt with detailed logging
    const writeStartTime = Date.now();
    
    try {
      await writeCompactTagData(ndef);
    } catch (writeError) {
      // Detailed write error logging
      debugLog(`Write Error Details:`, 'error');
      debugLog(`- Error Name: ${writeError.name}`, 'error');
      debugLog(`- Error Message: ${writeError.message}`, 'error');
      
      // Specific error type handling
      if (writeError.name === 'NotSupportedError') {
        debugLog('The tag may not support this write operation', 'warning');
      } else if (writeError.name === 'SecurityError') {
        debugLog('Security restrictions prevented writing', 'warning');
      }
      
      // Throw to trigger catch block
      throw writeError;
    }
    
    const writeEndTime = Date.now();
    const writeDuration = writeEndTime - writeStartTime;
    
    hideScanningAnimation();
    
    debugLog(`Tag successfully written in ${writeDuration}ms`, 'success');
    
    // Show success notification
    showSuccessNotification(
      "Tag Successfully Written!",
      "Your NFC tag has been initialized with your settings.",
      [
        `Owner token: ${document.getElementById('ownerToken').value}`,
        `Number of readers: ${AppState.readers.length}`,
        `Write duration: ${writeDuration}ms`
      ],
      10000 // Show for 10 seconds
    );
    
  } catch (error) {
    hideScanningAnimation();
    
    // Comprehensive error handling
    const errorMessage = `❌ Error writing to tag: ${error.message || error}`;
    showStatus(errorMessage, true);
    
    debugLog(`Write Error: ${error}`, 'error');
    debugLog(`Existing tag details:`, 'info');
    debugLog(`- Record Count: ${existingTagDetails.recordCount}`, 'info');
    debugLog(`- Record Types: ${existingTagDetails.recordTypes.join(', ')}`, 'info');
    debugLog(`- Potential Data Sizes: ${existingTagDetails.potentialDataSizes.join(', ')} bytes`, 'info');
  } finally {
    // Always reset writing state
    AppState.resetNfcOperation();
    isWriting = false;
  }
}

/**
 * Handle tag in update mode (adding readers to existing tag)
 * @param {NDEFReader} ndef - The NFC reader
 * @param {NDEFMessage} message - The NFC message
 * @param {string} serialNumber - The tag serial number
 */
async function handleTagInUpdateMode(ndef, message, serialNumber) {
  debugLog(`Handling tag in UPDATE mode. Serial: ${serialNumber}`, 'info');
  
  try {
    // We already have the tag data and owner token in the state
    const tagData = AppState.nfcOperation.tagData;
    const ownerToken = AppState.nfcOperation.ownerToken;
    
    if (!tagData || !ownerToken) {
      throw new Error("Missing tag data or owner token");
    }
    
    debugLog(`Update context: owner token present, tag data has ${tagData.readers ? tagData.readers.length : 0} readers`, 'info');
    
    // Show writing status - more prominent
    const scanningElement = document.getElementById('scanning-animation');
    if (scanningElement) {
      scanningElement.classList.add('writing');
      const textElement = scanningElement.querySelector('p');
      if (textElement) {
        textElement.textContent = 'Writing to tag...';
      }
    }
    
    showStatus('<span class="write-mode">WRITING...</span> Updating tag with new readers');
    
    // Get the current URL (without query parameters) to use as the app URL
    const appUrl = window.location.origin + window.location.pathname;
    
    // Create compact encrypted tag data
    const encryptedObj = await encryptTagData(ownerToken, tagData.readers);
    
    // Prepare records
    const records = [
      // First record is always the URL
      {
        recordType: "url",
        data: appUrl + "?action=read"
      },
      // Encrypted data
      {
        recordType: "text",
        data: JSON.stringify(encryptedObj)
      }
    ];
    
    debugLog(`About to write updated tag data with ${tagData.readers.length} readers`, 'info');
    
    const writeStartTime = Date.now();
    
    // Write directly without further confirmation since we're in update mode
    await ndef.write({ records });
    
    const writeEndTime = Date.now();
    debugLog(`Tag updated in ${writeEndTime - writeStartTime}ms`, 'success');
    
    // Update UI with a more persistent and visible success message
    hideScanningAnimation();
    
    // Show success in the status message
    showStatus(`✅ Tag successfully updated with ${tagData.readers.length} readers!`);
    
    // Create a persistent success notification in the operation status area
    updateOperationStatus(`Tag successfully updated with ${tagData.readers.length} readers!`, true);
    
    // Add permanent record in the UI
    const manageSection = document.getElementById('manage-tag-section');
    if (manageSection) {
      const lastUpdateInfo = document.createElement('div');
      lastUpdateInfo.className = 'last-update-info';
      lastUpdateInfo.innerHTML = `
        <p>Tag last updated: ${new Date().toLocaleTimeString()} (${tagData.readers.length} readers)</p>
      `;
      
      // Replace any existing update info or add new one
      const existingInfo = manageSection.querySelector('.last-update-info');
      if (existingInfo) {
        existingInfo.replaceWith(lastUpdateInfo);
      } else {
        manageSection.appendChild(lastUpdateInfo);
      }
    }
    
    // Try to stop the NFC reader
    await safeStopNFC(ndef);
    
  } catch (error) {
    hideScanningAnimation();
    // More detailed error message
    const errorMessage = `Error updating tag: ${error.message || error}. Please try again.`;
    showStatus(`❌ ${errorMessage}`, true);
    updateOperationStatus(errorMessage, false);
    debugLog(`Update error: ${error}`, 'error');
  }
  
  // Reset state
  AppState.resetNfcOperation();
}

/**
 * Handle tag in read mode
 * @param {NDEFMessage} message - The NFC message
 * @param {string} serialNumber - The tag serial number
 */
async function handleTagInReadMode(message, serialNumber) {
  debugLog(`Handling tag in READ mode. Serial: ${serialNumber}`, 'info');
  
  // Hide scanning animation
  hideScanningAnimation();
  
  // Display memory information
  displayTagMemoryInfo(message);
  
  // Process the tag data
  await processNFCTag(message);
}

/**
 * Write tag data using the compact format
 * @param {NDEFReader} ndef - The NFC reader
 * @returns {Promise<boolean>} - Resolves when write is complete
 */
export async function writeCompactTagData(ndef) {
  const ownerToken = document.getElementById('ownerToken').value;
  if (!ownerToken) {
    showStatus('Owner token is required', true);
    return false;
  }

  try {
    // Get the current URL (without query parameters) to use as the app URL
    const appUrl = window.location.origin + window.location.pathname;
    
    // Create compact encrypted tag data
    const encryptedObj = await encryptTagData(ownerToken, AppState.readers);
    
    // Save data to local storage as backup before writing
    try {
      await localforage.setItem('last_write_attempt', {
        timestamp: Date.now(),
        ownerToken: ownerToken,
        readers: AppState.readers,
        format: 'compact'
      });
      debugLog('Saved write data to local backup', 'info');
    } catch (backupError) {
      debugLog(`Warning: Could not save backup: ${backupError}`, 'warning');
      // Continue anyway - this is just a precaution
    }
    
    // Prepare records
    const records = [
      // First record is always the URL
      {
        recordType: "url",
        data: appUrl + "?action=read"
      },
      // Encrypted data record
      {
        recordType: "text",
        data: JSON.stringify(encryptedObj)
      }
    ];
    
    // Log payload details for debugging
    debugLog('Preparing to write NFC tag with compact format', 'info');
    debugLog(`Total records: ${records.length}`, 'info');
    debugLog(`Encrypted data size: ${JSON.stringify(encryptedObj).length} bytes`, 'info');
    
    // Write the records
    const writeStartTime = Date.now();
    await ndef.write({ records });
    const writeEndTime = Date.now();
    
    debugLog(`Tag write completed in ${writeEndTime - writeStartTime}ms`, 'success');
    
    // Clear the backup after successful write
    await localforage.removeItem('last_write_attempt');
    
    return true;
  } catch (error) {
    debugLog(`Comprehensive write error: ${error}`, 'error');
    
    // Enhanced error feedback
    showStatus(`❌ Error writing to tag: ${error.message || error}. Your data is saved locally.`, true);
    throw error;
  }
}

/**
 * Process NFC tag data when read
 * @param {NDEFMessage} message - The NFC message from the tag
 * @returns {Promise<boolean>} - Resolves when processing is complete
 */
export async function processNFCTag(message) {
  debugLog("Processing NFC tag message", 'info');
  
  // Check if the tag has any records
  if (!message.records || message.records.length === 0) {
    debugLog("No records found on tag - detected empty tag", 'info');
    showStatus("Empty tag detected - ready to create new tag");
    switchToCreateNewTagUI();
    
    // Add a clear message to the UI that this is an empty tag
    showSuccessNotification(
      "Empty Tag Detected",
      "This tag is empty and ready to be written. Add readers and click \"Write to NFC Tag\" to initialize it."
    );
    return true;
  }
  
  debugLog(`Found ${message.records.length} records on tag`, 'info');
  
  // Check for compact format first
  for (const record of message.records) {
    if (record.recordType === "text") {
      try {
        const textDecoder = new TextDecoder();
        const text = textDecoder.decode(record.data);
        
        // Try to parse and check for compact format
        try {
          const data = JSON.parse(text);
          if (data.v && data.d) {
            // Compact format detected
            debugLog("Found compact format tag", 'info');
            showStatus("NFC tag detected");
            
            // Show token entry UI
            switchToTokenEntryUI(data);
            return true;
          }
        } catch (e) {
          debugLog(`Failed to parse record as JSON: ${e}`, 'warning');
        }
      } catch (e) {
        debugLog(`Error decoding text data: ${e}`, 'error');
      }
    }
  }
  
  // If not compact format, check legacy formats
  let ownerRecord = null;
  let readerRecords = [];
  let hasURLRecord = false;
  let urlTarget = '';
  let isOurFormat = false;
  
  // Examine all records on the tag
  for (const record of message.records) {
    debugLog(`Record type: ${record.recordType}`, 'info');
    
    if (record.recordType === "url") {
      try {
        const textDecoder = new TextDecoder();
        urlTarget = textDecoder.decode(record.data);
        
        // Check if the URL actually contains data
        if (urlTarget && urlTarget.trim().length > 0) {
          hasURLRecord = true;
          debugLog(`URL record found: ${urlTarget}`, 'info');
        } else {
          debugLog("Empty URL record found", 'warning');
        }
      } catch (e) {
        debugLog(`Error decoding URL data: ${e}`, 'error');
      }
    } else if (record.recordType === "text") {
      try {
        const textDecoder = new TextDecoder();
        const text = textDecoder.decode(record.data);
        debugLog(`Text record content: ${text.substring(0, 50)}...`, 'info');
          
        try {
          const recordData = JSON.parse(text);
            
          // Process different record types
          if (recordData.type === "encrypted_owner") {
            ownerRecord = recordData;
            isOurFormat = true;
            debugLog('Found encrypted owner record', 'info');
          } else if (recordData.type === "encrypted_reader") {
            readerRecords.push(recordData);
            isOurFormat = true;
            debugLog(`Found encrypted reader record: ${recordData.id}`, 'info');
          } else if (recordData.type === "encrypted_nfc_multi_user") {
            // Handle legacy format for backward compatibility
            debugLog("Found legacy encrypted format", 'info');
            showStatus("Legacy encrypted tag detected");
            switchToTokenEntryUI(recordData);
            return true;
          } else if (recordData.type === "owner" || recordData.type === "reader") {
            // Handle unencrypted records (for backward compatibility)
            debugLog("Found unencrypted record - upgrading recommended", 'warning');
            if (recordData.type === "owner") {
              ownerRecord = { 
                type: "unencrypted_owner", 
                token: recordData.token 
              };
              isOurFormat = true;
            } else if (recordData.type === "reader") {
              readerRecords.push({ 
                type: "unencrypted_reader", 
                id: recordData.id, 
                token: recordData.token 
              });
              isOurFormat = true;
            }
          } else {
            debugLog(`Unknown record type: ${recordData.type}`, 'warning');
          }
        } catch (jsonError) {
          debugLog(`Failed to parse JSON: ${jsonError}`, 'warning');
        }
      } catch (e) {
        debugLog(`Error decoding text data: ${e}`, 'error');
      }
    }
  }
  
  // CASE 1: Tag has legacy multi-record format
  if (isOurFormat && ownerRecord) {
    debugLog("Processing tag with legacy multi-record format", 'info');
    showStatus("NFC tag detected (legacy format)");
    
    // Prepare tag data in the format expected by the UI
    const tagData = {
      owner: ownerRecord,
      readers: readerRecords
    };
    
    // Show token entry UI
    switchToTokenEntryUI(tagData);
    return true;
  }
  
  // CASE 2: Tag has some data but not our format
  if (hasURLRecord || message.records.length > 0) {
    debugLog("Tag has data but not in our format", 'warning');
    showStatus("Found tag with existing data", true);
    
    // Show confirmation dialog with more information
    if (confirm("This tag contains data in a format not recognized by this app. Would you like to create a new tag? (This will erase existing data when you write to the tag)")) {
      switchToCreateNewTagUI();
      return true;
    }
    return false;
  }
  
  // Fallback: If we somehow get here, default to create new tag UI
  debugLog("Tag format not recognized - defaulting to create new tag UI", 'warning');
  showStatus("Tag format not recognized");
  switchToCreateNewTagUI();
  return false;
}

/**
 * Estimate tag memory capacity and usage
 * @param {NDEFMessage} message - The NFC message
 * @returns {Object} - Memory information
 */
export function estimateTagMemory(message) {
  // Common NFC tag types and their typical capacities (in bytes)
  const tagTypes = {
    'TYPE1': 96,      // Type 1 tags (Topaz)
    'TYPE2': 144,     // Type 2 tags (MIFARE Ultralight)
    'TYPE3': 4096,    // Type 3 tags (FeliCa)
    'TYPE4': 32768,   // Type 4 tags (MIFARE DESFire)
    'TYPE5': 512,     // Type 5 tags (ISO 15693)
    'MIFARE_CLASSIC': 716, // MIFARE Classic 1K
    'NTAG213': 144,   // NTAG213
    'NTAG215': 504,   // NTAG215
    'NTAG216': 888    // NTAG216
  };
  
  // Default to a conservative estimate if we can't determine the type
  let estimatedCapacity = 504; // Default to NTAG215 size as middle ground
  let tagTypeGuess = 'NTAG215'; // More likely to be this common type
  
  // Check for manual tag type override
  const manualTagType = localStorage.getItem('manual_tag_type');
  if (manualTagType) {
    // Define currentUsage here to avoid ReferenceError
    let currentUsage = 0;
    let remainingSpace = 0;
    let usagePercentage = 0;
    
    if (manualTagType === 'ntag213') {
      tagTypeGuess = 'NTAG213';
      estimatedCapacity = 144;
      debugLog('Using manually selected tag type: NTAG213', 'info');
    } else if (manualTagType === 'ntag215') {
      tagTypeGuess = 'NTAG215';
      estimatedCapacity = 504;
      debugLog('Using manually selected tag type: NTAG215', 'info');
    } else if (manualTagType === 'ntag216') {
      tagTypeGuess = 'NTAG216';
      estimatedCapacity = 888;
      debugLog('Using manually selected tag type: NTAG216', 'info');
    } else if (manualTagType === 'mifare_ultralight') {
      tagTypeGuess = 'MIFARE_ULTRALIGHT';
      estimatedCapacity = 144;
      debugLog('Using manually selected tag type: MIFARE ULTRALIGHT', 'info');
    } else if (manualTagType === 'mifare_classic') {
      tagTypeGuess = 'MIFARE_CLASSIC';
      estimatedCapacity = 716;
      debugLog('Using manually selected tag type: MIFARE CLASSIC', 'info');
    }
    
    // Calculate current usage here before returning
    if (message && message.records) {
      currentUsage = calculateRecordsSize(message.records);
    }
    
    remainingSpace = Math.max(0, estimatedCapacity - currentUsage);
    usagePercentage = Math.min(100, Math.round((currentUsage / estimatedCapacity) * 100));
    
    return {
      tagType: tagTypeGuess,
      estimatedCapacity,
      currentUsage,
      remainingSpace,
      usagePercentage,
      isManuallySet: true
    };
  }
  
  // Try to determine tag type from serial number or other properties
  if (message && message.serialNumber) {
    const serialHex = message.serialNumber.toLowerCase();
    debugLog(`Tag serial number: ${serialHex}`, 'info');
    
    // NTAG detection based on serial number patterns
    if (serialHex.startsWith('04')) {
      // Most NXP NTAG start with 04
      
      // Try to determine specific NTAG type from serial number
      // NTAG213/215/216 typically have 7-byte UIDs (14 hex chars)
      if (serialHex.length === 14) {
        // Check for specific manufacturer bytes that might indicate type
        const manuBytes = serialHex.substring(2, 6);
        if (manuBytes === '0102') {
          tagTypeGuess = 'NTAG216';
          estimatedCapacity = 888;
        } else if (manuBytes === '0103') {
          tagTypeGuess = 'NTAG215';
          estimatedCapacity = 504;
        } else if (manuBytes === '0104') {
          tagTypeGuess = 'NTAG213';
          estimatedCapacity = 144;
        } else {
          // If we can't determine exactly, try to guess from the data size
          
          // If the tag already has data, we can make a better guess based on usage
          if (message.records && message.records.length > 0) {
            // Calculate current data size
            let totalSize = calculateRecordsSize(message.records);
            
            // If data size is large, it's probably a larger tag
            if (totalSize > 400) {
              tagTypeGuess = 'NTAG216';
              estimatedCapacity = 888;
            } else if (totalSize > 120) {
              tagTypeGuess = 'NTAG215';
              estimatedCapacity = 504;
            } else {
              tagTypeGuess = 'NTAG213';
              estimatedCapacity = 144;
            }
          }
        }
      } else if (serialHex.length === 16) {
        // Likely a MIFARE Ultralight or NTAG21x with 8-byte UID
        tagTypeGuess = 'NTAG216';
        estimatedCapacity = 888; // Assume larger capacity to be safe
      }
    } else if (serialHex.startsWith('08')) {
      // Likely a MIFARE Classic
      tagTypeGuess = 'MIFARE_CLASSIC';
      estimatedCapacity = 716;
    }
    
    // Check URL parameters for tag type override
    const urlParams = new URLSearchParams(window.location.search);
    const tagTypeParam = urlParams.get('tagtype');
    if (tagTypeParam) {
      if (tagTypeParam === 'ntag213') {
        tagTypeGuess = 'NTAG213';
        estimatedCapacity = 144;
      } else if (tagTypeParam === 'ntag215') {
        tagTypeGuess = 'NTAG215';
        estimatedCapacity = 504;
      } else if (tagTypeParam === 'ntag216') {
        tagTypeGuess = 'NTAG216';
        estimatedCapacity = 888;
      }
    }
  }
  
  // Calculate current usage
  let currentUsage = 0;
  if (message && message.records) {
    currentUsage = calculateRecordsSize(message.records);
  }
  
  // Calculate remaining space
  const remainingSpace = Math.max(0, estimatedCapacity - currentUsage);
  const usagePercentage = Math.min(100, Math.round((currentUsage / estimatedCapacity) * 100));
  
  debugLog(`Tag type: ${tagTypeGuess}, Capacity: ${estimatedCapacity} bytes, Used: ${currentUsage} bytes (${usagePercentage}%)`, 'info');
  
  return {
    tagType: tagTypeGuess,
    estimatedCapacity,
    currentUsage,
    remainingSpace,
    usagePercentage
  };
}

/**
 * Calculate the size of NFC records
 * @param {Array} records - Array of NDEF records
 * @returns {number} - Total size in bytes
 */
function calculateRecordsSize(records) {
  let totalSize = 0;
  
  // Add NDEF message overhead (approximately 10-16 bytes)
  totalSize += 16;
  
  for (const record of records) {
    try {
      // NDEF record overhead: ~6-8 bytes per record
      const recordOverhead = 8;
      
      // Data size
      let dataSize = 0;
      if (record.data) {
        if (record.data instanceof ArrayBuffer) {
          dataSize = record.data.byteLength;
        } else {
          // Try to estimate size for other data types
          const blob = new Blob([record.data]);
          dataSize = blob.size;
        }
      }
      
      // Add type length if present
      let typeSize = 0;
      if (record.recordType) {
        typeSize = record.recordType.length;
      }
      
      // Total for this record
      const recordSize = recordOverhead + dataSize + typeSize;
      totalSize += recordSize;
      
      debugLog(`Record size: ${recordSize} bytes (${record.recordType || 'unknown type'})`, 'info');
    } catch (e) {
      debugLog(`Error calculating record size: ${e}`, 'warning');
    }
  }
  
  return totalSize;
}

/**
 * Request NFC permission again
 */
export function requestNFCPermission() {
  debugLog('User requested to try NFC permission again', 'info');
  
  // Clear previous error message
  document.getElementById('status-message').innerHTML = '';
  
  // Try to start NFC operation again
  startNFCOperation(AppState.nfcOperation.mode || 'READING');
}

/**
 * Access a tag with a token
 * @param {Object} tagData - The tag data
 * @param {string} token - The access token
 * @returns {Promise<boolean>} - True if access granted, false otherwise
 */
export async function accessTag(tagData, token) {
  debugLog(`Attempting to access tag with token`, 'info');
  
  try {
    // Check if this is the compact format
    if (tagData.v && tagData.d) {
      try {
        // Try to decrypt with provided token
        const decryptedData = await decryptTagData(tagData, token);
        
        // Verify the token matches
        if (decryptedData.owner.token === token) {
          debugLog("Owner access granted", 'success');
          showStatus("Owner access granted!");
          
          // Switch to tag management UI with owner privileges
          switchToManageTagUI(decryptedData, token, "owner");
          return true;
        }
        
        // Check if it's a reader token
        const reader = decryptedData.readers.find(r => r.token === token);
        if (reader) {
          debugLog(`Reader "${reader.id}" access granted`, 'success');
          showStatus(`Reader "${reader.id}" access granted!`);
          
          // Switch to reader UI
          switchToManageTagUI(decryptedData, token, "reader", reader.id);
          return true;
        }
        
        // If we get here, token doesn't match
        debugLog("Invalid token - Access denied", 'error');
        showStatus("Invalid token - Access denied", true);
        return false;
      } catch (error) {
        debugLog(`Decryption error: ${error}`, 'error');
        showStatus("Invalid token or corrupted tag data", true);
        return false;
      }
    } 
    // Handle legacy encrypted format
    else if (tagData.type === "encrypted_nfc_multi_user") {
      try {
        // Try to decrypt legacy format
        const decryptedData = await decryptLegacyData(tagData, token);
        
        if (decryptedData.owner && decryptedData.owner.token === token) {
          debugLog("Owner access granted (legacy format)", 'success');
          showStatus("Owner access granted!");
          
          // Switch to tag management UI with owner privileges
          switchToManageTagUI(decryptedData, token, "owner");
          return true;
        }
        
        // Check if it's a reader token
        if (decryptedData.readers) {
          const reader = decryptedData.readers.find(r => r.token === token);
          if (reader) {
            debugLog(`Reader "${reader.id}" access granted (legacy format)`, 'success');
            showStatus(`Reader "${reader.id}" access granted!`);
            
            // Switch to reader UI
            switchToManageTagUI(decryptedData, token, "reader", reader.id);
            return true;
          }
        }
        
        // If we get here, token doesn't match
        debugLog("Invalid token - Access denied", 'error');
        showStatus("Invalid token - Access denied", true);
        return false;
      } catch (error) {
        debugLog(`Legacy decryption error: ${error}`, 'error');
        showStatus("Invalid token or corrupted tag data", true);
        return false;
      }
    }
    // Try to decrypt owner record (multi-record legacy format)
    else if (tagData.owner && tagData.owner.type === "encrypted_owner") {
      try {
        // Try to decrypt with provided token
        const decryptedBytes = CryptoJS.AES.decrypt(tagData.owner.data, token);
        const ownerData = JSON.parse(decryptedBytes.toString(CryptoJS.enc.Utf8));
        
        // If we can decrypt, this is the owner
        if (ownerData.token === token) {
          debugLog("Owner access granted", 'success');
          showStatus("Owner access granted!");
          
          // Now decrypt all reader records with the owner token
          const decryptedReaders = [];
          
          for (const encryptedReader of tagData.readers) {
            try {
              if (encryptedReader.type === "encrypted_reader") {
                // Decrypt each reader with owner token
                const readerBytes = CryptoJS.AES.decrypt(encryptedReader.data, token);
                const readerData = JSON.parse(readerBytes.toString(CryptoJS.enc.Utf8));
                
                decryptedReaders.push({
                  id: readerData.id,
                  token: readerData.token
                });
              } else if (encryptedReader.type === "unencrypted_reader") {
                // Add unencrypted reader directly
                decryptedReaders.push({
                  id: encryptedReader.id,
                  token: encryptedReader.token
                });
              }
            } catch (readerError) {
              debugLog(`Could not decrypt reader ${encryptedReader.id}: ${readerError}`, 'warning');
            }
          }
          
          // Create data structure for UI
          const decryptedData = {
            owner: {
              id: "owner",
              token: token
            },
            readers: decryptedReaders
          };
          
          // Switch to tag management UI with owner privileges
          switchToManageTagUI(decryptedData, token, "owner");
          return true;
        }
      } catch (error) {
        debugLog(`Failed to decrypt owner record: ${error}`, 'error');
      }
    } else if (tagData.owner && tagData.owner.type === "unencrypted_owner") {
      // Unencrypted legacy format - direct comparison
      if (tagData.owner.token === token) {
        debugLog("Owner access granted (unencrypted format)", 'success');
        showStatus("Owner access granted!");
        
        // Create standard format data structure
        const standardData = {
          owner: {
            id: "owner",
            token: token
          },
          readers: tagData.readers.map(reader => ({
            id: reader.id,
            token: reader.token
          }))
        };
        
        // Switch to tag management UI with owner privileges
        switchToManageTagUI(standardData, token, "owner");
        return true;
      }
    }
    
    // If we get here, the token is invalid
    debugLog("Invalid token - Access denied", 'error');
    showStatus("Invalid token - Access denied", true);
    return false;
    
  } catch (error) {
    debugLog(`Access error: ${error}`, 'error');
    showStatus("Invalid token or corrupted tag data", true);
    return false;
  }
}

/**
 * Check for recovery data from a previous failed write
 */
export async function checkForRecoveryData() {
  try {
    const lastAttempt = await localforage.getItem('last_write_attempt');
    
    if (lastAttempt && lastAttempt.ownerToken && lastAttempt.readers) {
      const timeSince = Math.floor((Date.now() - lastAttempt.timestamp) / 60000); // minutes
      
      debugLog(`Found recovery data from ${timeSince} minutes ago`, 'info');
      
      // Show recovery option in UI
      const statusElement = document.getElementById('status-message');
      if (statusElement) {
        statusElement.innerHTML += `
          <div class="warning-notification">
            <div class="warning-icon">⚠️</div>
            <div class="warning-message">
              <h3>Recover Previous Write Attempt</h3>
              <p>Found data from a previous write attempt (${timeSince} minutes ago) that may not have completed.</p>
              <p>Owner token and ${lastAttempt.readers.length} readers can be recovered.</p>
              <button onclick="recoverLastWriteAttempt()">Recover Data</button>
              <button class="secondary" onclick="dismissRecovery()">Dismiss</button>
            </div>
          </div>
        `;
      }
    }
  } catch (err) {
    debugLog(`Error checking for recovery data: ${err}`, 'error');
  }
}

/**
 * Recover data from a previous write attempt
 */
export async function recoverLastWriteAttempt() {
  try {
    const lastAttempt = await localforage.getItem('last_write_attempt');
    
    if (lastAttempt && lastAttempt.ownerToken && lastAttempt.readers) {
      // Restore the data
      const ownerTokenInput = document.getElementById('ownerToken');
      if (ownerTokenInput) {
        ownerTokenInput.value = lastAttempt.ownerToken;
      }
      
      // Update app state
      AppState.readers = lastAttempt.readers;
      
      // Update UI
      updateReadersList();
      
      debugLog(`Recovered ${lastAttempt.readers.length} readers from previous attempt`, 'success');
      showStatus('Previous write data recovered successfully');
      
      // Don't remove the backup yet - keep until successful write
    }
  } catch (err) {
    debugLog(`Error recovering data: ${err}`, 'error');
    showStatus('Could not recover previous data', true);
  }
}

/**
 * Dismiss recovery notification
 */
export function dismissRecovery() {
  // Just remove the notification, but keep the data in case user changes mind
  const warningElements = document.querySelectorAll('.warning-notification');
  warningElements.forEach(el => el.remove());
  
  debugLog('Recovery notification dismissed', 'info');
}

/**
 * Initialize tag operations module
 */
export function initTagsModule() {
  // Add global functions to window for HTML onclick handlers
  window.requestNFCPermission = requestNFCPermission;
  window.recoverLastWriteAttempt = recoverLastWriteAttempt;
  window.dismissRecovery = dismissRecovery;
  
  // Add event listener for accessing a tag
  const accessButton = document.getElementById('accessButton');
  if (accessButton) {
    accessButton.addEventListener('click', () => {
      const tokenSection = document.getElementById('token-entry-section');
      const token = document.getElementById('accessToken').value;
      
      if (!token) {
        showStatus("Please enter a token", true);
        return;
      }
      
      // Get tag data from the data attribute
      if (tokenSection && tokenSection.dataset.encryptedData) {
        try {
          const tagData = JSON.parse(tokenSection.dataset.encryptedData);
          accessTag(tagData, token);
        } catch (e) {
          debugLog(`Error parsing stored tag data: ${e}`, 'error');
          showStatus("Error accessing tag data", true);
        }
      }
    });
  }
  
  debugLog('Tags module initialized', 'info');
}