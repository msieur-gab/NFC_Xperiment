// status-display.js - Status message handling
import eventBus from './event-bus.js';

class StatusDisplay {
    constructor() {
        // Initialize any state needed for status display
    }

    // Add init method to match expected interface
    init() {
        // Subscribe to any events that might be needed
        eventBus.subscribe('showStatus', data => {
            this.showStatus(data.message, data.isError);
        });
        
        eventBus.subscribe('updateOperationStatus', data => {
            this.updateOperationStatus(data.message, data.isSuccess);
        });
        
        eventBus.publish('log', { message: 'Status display initialized', type: 'info' });
    }

    showStatus(message, isError = false) {
        const statusElement = document.getElementById('status-message');
        statusElement.innerHTML = `<div class="${isError ? 'error' : 'status'}">${message}</div>`;
        
        eventBus.publish('log', { message: `Status: ${message}`, type: isError ? 'error' : 'info' });
        
        // Clear after 5 seconds unless it's an important message
        if (!message.includes('Permission Required') && !message.includes('NFC not supported')) {
            setTimeout(() => {
                if (statusElement.querySelector('div').textContent === message) {
                    statusElement.innerHTML = '';
                }
            }, 5000);
        }
    }

    updateOperationStatus(message, isSuccess = true) {
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
        eventBus.publish('log', { 
            message: `Operation Status: ${message}`, 
            type: isSuccess ? 'success' : 'error' 
        });
    }

    displayTagMemoryInfo(memoryInfo, containerId = 'tag-memory-info') {
        // Create memory info HTML
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
        let statusElement = document.getElementById(containerId);
        if (statusElement) {
            statusElement.innerHTML = memoryInfoHTML;
        } else {
            // Create element if it doesn't exist
            const memoryElement = document.createElement('div');
            memoryElement.id = containerId;
            memoryElement.innerHTML = memoryInfoHTML;
            
            // Find a good place to insert it
            const targetElement = document.getElementById('tag-operation-status') || 
                                 document.getElementById('status-message');
            if (targetElement) {
                targetElement.parentNode.insertBefore(memoryElement, targetElement.nextSibling);
            }
        }
    }

    // Show recovery notification
    showRecoveryNotification(lastAttempt) {
        const timeSince = Math.floor((Date.now() - lastAttempt.timestamp) / 60000); // minutes
        
        eventBus.publish('log', { 
            message: `Found recovery data from ${timeSince} minutes ago`, 
            type: 'info'
        });
        
        // Show recovery option in UI
        const statusElement = document.getElementById('status-message');
        statusElement.innerHTML += `
            <div class="warning-notification">
                <div class="warning-icon">⚠️</div>
                <div class="warning-message">
                    <h3>Recover Previous Write Attempt</h3>
                    <p>Found data from a previous write attempt (${timeSince} minutes ago) that may not have completed.</p>
                    <p>Owner token and ${lastAttempt.readers.length} readers can be recovered.</p>
                    <button id="recover-data-btn">Recover Data</button>
                    <button class="secondary" id="dismiss-recovery-btn">Dismiss</button>
                </div>
            </div>
        `;
    }

    // Handle dismissing the recovery notification
    dismissRecovery() {
        // Just remove the notification, but keep the data in case user changes mind
        const warningElements = document.querySelectorAll('.warning-notification');
        warningElements.forEach(el => el.remove());
        
        eventBus.publish('log', { message: 'Recovery notification dismissed', type: 'info' });
    }
}

// Create and export a singleton instance
const statusDisplay = new StatusDisplay();
export default statusDisplay;
