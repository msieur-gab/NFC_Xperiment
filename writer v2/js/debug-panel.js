// debug-panel.js - Debug console management
import eventBus from './event-bus.js';

class DebugPanel {
    constructor() {
        this.debugPanelVisible = false;
        this.logHistory = [];
        this.MAX_LOG_HISTORY = 100;
    }

    init() {
        this.debugPanelVisible = localStorage.getItem('nfc_debug_panel_visible') === 'true';
        const debugToggle = document.getElementById('debug-mode-toggle');
        const debugPanel = document.getElementById('debug-panel');
        const clearDebugBtn = document.getElementById('clear-debug');
        const closeDebugBtn = document.getElementById('close-debug');
        
        // Set initial state
        debugToggle.checked = this.debugPanelVisible;
        debugPanel.style.display = this.debugPanelVisible ? 'block' : 'none';
        
        // Toggle debug panel visibility
        debugToggle.addEventListener('change', () => {
            this.debugPanelVisible = debugToggle.checked;
            localStorage.setItem('nfc_debug_panel_visible', this.debugPanelVisible);
            debugPanel.style.display = this.debugPanelVisible ? 'block' : 'none';
            
            // If showing panel, refresh with all history
            if (this.debugPanelVisible) {
                this.refreshDebugConsole();
                this.log('Debug panel shown with ' + this.logHistory.length + ' log entries', 'info');
            } else {
                this.log('Debug panel hidden, but logging continues', 'info');
            }
        });
        
        // Clear button
        clearDebugBtn.addEventListener('click', () => {
            this.logHistory = [];
            document.getElementById('debug-console').innerHTML = '';
            this.log('Debug log history cleared', 'info');
        });
        
        // Close button
        closeDebugBtn.addEventListener('click', () => {
            debugPanel.style.display = 'none';
            debugToggle.checked = false;
            this.debugPanelVisible = false;
            localStorage.setItem('nfc_debug_panel_visible', 'false');
            this.log('Debug panel hidden, but logging continues', 'info');
        });
        
        // Subscribe to log events
        eventBus.subscribe('log', data => this.log(data.message, data.type));
        
        this.log("Debug system initialized", 'info');
    }

    log(message, type = 'info') {
        // Always add to log history
        const now = new Date();
        const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;
        
        // Create log entry
        const logEntry = {
            time: timeString,
            message: message,
            type: type
        };
        
        // Add to history
        this.logHistory.push(logEntry);
        
        // Trim history if needed
        if (this.logHistory.length > this.MAX_LOG_HISTORY) {
            this.logHistory = this.logHistory.slice(-this.MAX_LOG_HISTORY);
        }
        
        // Update debug console if visible
        if (this.debugPanelVisible) {
            this.updateDebugConsole(logEntry);
        }
        
        // Also log to browser console for dev tools
        console.log(`[${type.toUpperCase()}] ${message}`);
    }

    updateDebugConsole(logEntry) {
        const debugConsole = document.getElementById('debug-console');
        if (!debugConsole) return;
        
        const logElement = document.createElement('div');
        logElement.className = `debug-log debug-log-${logEntry.type}`;
        logElement.innerHTML = `<span class="debug-log-time">${logEntry.time}</span> ${logEntry.message}`;
        
        debugConsole.appendChild(logElement);
        debugConsole.scrollTop = debugConsole.scrollHeight;
    }

    refreshDebugConsole() {
        const debugConsole = document.getElementById('debug-console');
        if (!debugConsole) return;
        
        // Clear console first
        debugConsole.innerHTML = '';
        
        // Add all history
        this.logHistory.forEach(entry => {
            this.updateDebugConsole(entry);
        });
    }
}

// Create and export a singleton instance
const debugPanel = new DebugPanel();
export default debugPanel;
