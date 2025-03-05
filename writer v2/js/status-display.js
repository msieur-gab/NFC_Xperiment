// status-display.js
class StatusDisplay {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.statusElement = document.getElementById('status-message');
        
        // Setup event listeners
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.eventBus.on('status:info', (message) => this.showStatus(message));
        this.eventBus.on('status:success', (message) => this.showStatus(message, false));
        this.eventBus.on('status:error', (message) => this.showStatus(message, true));
        this.eventBus.on('status:warning', (message) => this.showStatus(message, true));
    }

    /**
     * Show a status message
     * @param {string} message - Message to display
     * @param {boolean} [isError=false] - Whether the message is an error
     */
    showStatus(message, isError = false) {
        if (!this.statusElement) return;

        // Clear previous timeout if exists
        if (this.statusTimeout) {
            clearTimeout(this.statusTimeout);
        }

        // Create status element
        const statusDiv = document.createElement('div');
        statusDiv.className = isError ? 'error' : 'status';
        statusDiv.innerHTML = message;

        // Clear previous content and add new status
        this.statusElement.innerHTML = '';
        this.statusElement.appendChild(statusDiv);

        // Auto-clear after 5 seconds
        this.statusTimeout = setTimeout(() => {
            this.statusElement.innerHTML = '';
        }, 5000);

        // Log to console for debugging
        console.log(isError ? '[ERROR]' : '[STATUS]', message);
    }

    /**
     * Show an error message
     * @param {string} message - Error message to display
     */
    showError(message) {
        this.showStatus(message, true);
    }

    /**
     * Clear the current status message
     */
    clear() {
        if (this.statusTimeout) {
            clearTimeout(this.statusTimeout);
        }
        if (this.statusElement) {
            this.statusElement.innerHTML = '';
        }
    }
}

export default StatusDisplay;
