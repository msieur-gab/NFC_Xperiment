// debug-panel.js
class DebugPanel {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.debugPanel = document.getElementById('debug-panel');
        this.debugConsole = document.getElementById('debug-console');
        this.debugToggle = document.getElementById('debug-mode-toggle');
        this.clearDebugBtn = document.getElementById('clear-debug');
        this.closeDebugBtn = document.getElementById('close-debug');

        this.logHistory = [];
        this.MAX_LOG_HISTORY = 100;

        this.setupEventListeners();
        this.initDebugMode();
    }

    setupEventListeners() {
        // Debug toggle
        this.debugToggle.addEventListener('change', () => this.toggleDebugPanel());

        // Clear debug button
        this.clearDebugBtn.addEventListener('click', () => this.clearDebugLog());

        // Close debug button
        this.closeDebugBtn.addEventListener('click', () => this.hideDebugPanel());

        // Capture and log various events
        this.eventBus.on('debug:log', (logEntry) => this.log(logEntry));
        this.eventBus.on('status:info', (message) => this.log({ 
            message, 
            type: 'info' 
        }));
        this.eventBus.on('status:error', (message) => this.log({ 
            message, 
            type: 'error' 
        }));
        this.eventBus.on('status:warning', (message) => this.log({ 
            message, 
            type: 'warning' 
        }));
    }

    initDebugMode() {
        // Restore previous debug panel state
        const isVisible = localStorage.getItem('nfc_debug_panel_visible') === 'true';
        this.debugToggle.checked = isVisible;
        this.debugPanel.style.display = isVisible ? 'block' : 'none';
    }

    toggleDebugPanel() {
        const isVisible = this.debugToggle.checked;
        this.debugPanel.style.display = isVisible ? 'block' : 'none';
        
        // Persist state
        localStorage.setItem('nfc_debug_panel_visible', isVisible);

        if (isVisible) {
            this.refreshDebugConsole();
        }
    }

    log(entry) {
        // Prepare log entry
        const now = new Date();
        const logEntry = {
            time: now.toLocaleTimeString(),
            message: entry.message,
            type: entry.type || 'info'
        };

        // Add to history
        this.logHistory.push(logEntry);

        // Trim history if needed
        if (this.logHistory.length > this.MAX_LOG_HISTORY) {
            this.logHistory = this.logHistory.slice(-this.MAX_LOG_HISTORY);
        }

        // Update console if visible
        if (this.debugToggle.checked) {
            this.addLogToConsole(logEntry);
        }

        // Also log to browser console
        this.consoleLog(logEntry);
    }

    addLogToConsole(logEntry) {
        if (!this.debugConsole) return;

        const logElement = document.createElement('div');
        logElement.className = `debug-log debug-log-${logEntry.type}`;
        logElement.innerHTML = `
            <span class="debug-log-time">${logEntry.time}</span> 
            ${logEntry.message}
        `;

        this.debugConsole.appendChild(logElement);
        this.debugConsole.scrollTop = this.debugConsole.scrollHeight;
    }

    refreshDebugConsole() {
        if (!this.debugConsole) return;

        // Clear console
        this.debugConsole.innerHTML = '';

        // Reapply all logs
        this.logHistory.forEach(entry => this.addLogToConsole(entry));
    }

    clearDebugLog() {
        this.logHistory = [];
        if (this.debugConsole) {
            this.debugConsole.innerHTML = '';
        }
    }

    hideDebugPanel() {
        this.debugPanel.style.display = 'none';
        this.debugToggle.checked = false;
        localStorage.setItem('nfc_debug_panel_visible', 'false');
    }

    consoleLog(logEntry) {
        switch(logEntry.type) {
            case 'error':
                console.error(logEntry.message);
                break;
            case 'warning':
                console.warn(logEntry.message);
                break;
            case 'success':
                console.log(`%c${logEntry.message}`, 'color: green');
                break;
            default:
                console.log(logEntry.message);
        }
    }
}

export default DebugPanel;
