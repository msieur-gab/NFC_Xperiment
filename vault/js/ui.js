/**
 * NFC Vault UI Module
 * Handles UI interactions and display
 */

// Show status message
function showStatus(message, isError = false) {
    const statusElement = document.getElementById('status-message');
    statusElement.innerHTML = `<div class="${isError ? 'error' : 'status'}">${message}</div>`;
    
    // Clear after 5 seconds
    setTimeout(() => {
        statusElement.innerHTML = '';
    }, 5000);
}

// Setup tab navigation
function setupTabs() {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            const tabContents = document.querySelectorAll('.tab-content');
            tabContents.forEach(content => content.classList.remove('active'));
            
            const tabName = tab.getAttribute('data-tab');
            const tabContent = document.getElementById(`${tabName}-tab`);
            if (tabContent) {
                tabContent.classList.add('active');
            }
        });
    });
}

// Show scanning animation
function showScanningAnimation(isWriting = false, message = null) {
    const scanningElement = document.getElementById('scanning-animation');
    scanningElement.style.display = 'block';
    
    // Update animation based on operation
    scanningElement.classList.remove('writing');
    
    if (isWriting) {
        scanningElement.classList.add('writing');
        document.getElementById('scanning-text').textContent = 
            message || 'Writing to NFC tag...';
    } else {
        document.getElementById('scanning-text').textContent = 
            message || 'Waiting for NFC tag...';
    }
}

// Hide scanning animation
function hideScanningAnimation() {
    document.getElementById('scanning-animation').style.display = 'none';
}

// Update readers list in the UI
function updateReadersList(readers, containerId = 'readersList', onRemove = null) {
    const list = document.getElementById(containerId);
    list.innerHTML = '';
    
    if (!readers || readers.length === 0) {
        list.innerHTML = '<p>No readers added yet.</p>';
        return;
    }
    
    readers.forEach((reader, index) => {
        const readerDiv = document.createElement('div');
        readerDiv.className = 'reader-item';
        readerDiv.innerHTML = `
            <div class="reader-info">
                <strong>${reader.id}</strong><br>
                <span class="key-display">${reader.key}</span>
            </div>
            <div class="reader-actions">
                <button class="danger" data-index="${index}">Remove</button>
            </div>
        `;
        
        // Add remove event handler if provided
        if (onRemove) {
            const removeButton = readerDiv.querySelector('button.danger');
            removeButton.addEventListener('click', () => onRemove(index));
        }
        
        list.appendChild(readerDiv);
    });
}

// Show tag preview
function showTagPreview(tagData, ownerKey, ownerPin, readers) {
    const previewElement = document.getElementById('preview-content');
    
    // Format metadata for display
    const metadataDisplay = {
        version: tagData.metadata.version,
        iv: '(base64 encoded)'
    };
    
    // Format owner for display
    const ownerDisplay = {
        t: 'o',
        id: 'owner',
        k: '(encrypted owner key)'
    };
    
    // Format readers for display
    const readersDisplay = readers.map(reader => ({
        t: 'r',
        id: reader.id,
        k: '(encrypted reader key)'
    }));
    
    // Show encrypted view
    const encryptedHtml = `
        <h4>Service URL (First Entry):</h4>
        <pre style="background-color: #f3f4f6; padding: 10px; overflow-x: auto;">${tagData.serviceUrl}</pre>
        
        <h4>Metadata (Second Entry):</h4>
        <pre style="background-color: #f3f4f6; padding: 10px; overflow-x: auto;">${JSON.stringify(metadataDisplay, null, 2)}</pre>
        
        <h4>Owner Data (Third Entry):</h4>
        <pre style="background-color: #f3f4f6; padding: 10px; overflow-x: auto;">${JSON.stringify(ownerDisplay, null, 2)}</pre>
        
        <h4>Reader Data (Additional Entries):</h4>
        <pre style="background-color: #f3f4f6; padding: 10px; overflow-x: auto;">${JSON.stringify(readersDisplay, null, 2)}</pre>
    `;
    
    // Show decrypted view
    const decryptedHtml = `
        <h4>Owner:</h4>
        <pre style="background-color: #f3f4f6; padding: 10px; overflow-x: auto;">Key: ${ownerKey}
PIN: ${ownerPin}</pre>
        
        <h4>Readers:</h4>
        <pre style="background-color: #f3f4f6; padding: 10px; overflow-x: auto;">${readers.map(r => `${r.id}: ${r.key}`).join('\n')}</pre>
    `;
    
    // Combine both views
    previewElement.innerHTML = `
        <h3>Encrypted Data (This is what will be written to tag)</h3>
        ${encryptedHtml}
        
        <h3 style="margin-top: 20px;">Decrypted Data</h3>
        ${decryptedHtml}
    `;
    
    document.getElementById('tagPreview').style.display = 'block';
}

// Show manage content UI
function showManageContent(ownerKey, readers, onRemoveReader) {
    document.getElementById('manage-owner-key').textContent = ownerKey;
    updateReadersList(readers, 'manage-readers-list', onRemoveReader);
    document.getElementById('manage-content').style.display = 'block';
}

// Hide manage content UI
function hideManageContent() {
    document.getElementById('manage-content').style.display = 'none';
}

// Show PIN modal
function showPinModal(onSubmit, onCancel) {
    const modal = document.getElementById('pin-modal');
    const pinInput = document.getElementById('modalPin');
    const submitBtn = document.getElementById('submit-pin');
    const cancelBtn = document.getElementById('cancel-pin');
    
    // Clear previous PIN
    pinInput.value = '';
    
    // Show modal
    modal.classList.add('active');
    
    // Set focus on PIN input
    setTimeout(() => pinInput.focus(), 100);
    
    // Handle submit
    const handleSubmit = () => {
        const pin = pinInput.value;
        if (pin) {
            onSubmit(pin);
            modal.classList.remove('active');
        } else {
            showStatus('Please enter a PIN', true);
        }
    };
    
    // Set up event listeners
    submitBtn.onclick = handleSubmit;
    
    // Handle Enter key in PIN input
    pinInput.onkeydown = (e) => {
        if (e.key === 'Enter') {
            handleSubmit();
        }
    };
    
    // Handle cancel
    cancelBtn.onclick = () => {
        modal.classList.remove('active');
        if (onCancel) onCancel();
    };
}

// Hide PIN modal
function hidePinModal() {
    document.getElementById('pin-modal').classList.remove('active');
}

// Setup password visibility toggle
function setupPasswordToggles() {
    // Create a function to toggle password visibility
    const togglePasswordVisibility = (inputId, buttonId) => {
        const input = document.getElementById(inputId);
        const button = document.getElementById(buttonId);
        
        if (!input || !button) return;
        
        button.addEventListener('click', () => {
            const type = input.type === 'password' ? 'text' : 'password';
            input.type = type;
            button.textContent = type === 'password' ? 'Show' : 'Hide';
        });
    };
    
    // Set up toggles for all password fields
    togglePasswordVisibility('ownerPin', 'toggle-pin-visibility');
    togglePasswordVisibility('newPin', 'toggle-new-pin-visibility');
    togglePasswordVisibility('modalPin', 'toggle-modal-pin-visibility');
}

// Export the functions
export {
    showStatus,
    setupTabs,
    showScanningAnimation,
    hideScanningAnimation,
    updateReadersList,
    showTagPreview,
    showManageContent,
    hideManageContent,
    showPinModal,
    hidePinModal,
    setupPasswordToggles
};