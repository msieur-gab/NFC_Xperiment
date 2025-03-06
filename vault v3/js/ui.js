/**
 * NFC Vault UI Module
 * Handles UI interactions and display, working with custom components
 */

// Show status message (traditional UI)
function showStatus(message, isError = false) {
    const statusElement = document.getElementById('status-message');
    statusElement.innerHTML = `<div class="${isError ? 'error' : 'status'}">${message}</div>`;
    
    // Clear after 5 seconds
    setTimeout(() => {
        statusElement.innerHTML = '';
    }, 5000);
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
}

// Show success notification
function showSuccessNotification(title, message) {
    // Use toast component if available, but always show in status area for redundancy
    const statusElement = document.getElementById('status-message');
    
    const html = `
        <div class="success-notification">
            <div class="success-icon">✓</div>
            <div class="success-message">
                <h3>${title}</h3>
                <p>${message}</p>
            </div>
        </div>
    `;
    
    statusElement.innerHTML = html;
    
    // Clear after 8 seconds (longer than regular status messages)
    setTimeout(() => {
        statusElement.innerHTML = '';
    }, 8000);
}

// Export the functions
export {
    showStatus,
    updateReadersList,
    showTagPreview,
    setupPasswordToggles,
    showSuccessNotification
};