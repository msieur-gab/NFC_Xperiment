/**
 * debug.js
 * Handles debug logging and debug console functionality
 */

import { AppState } from './state.js';

/**
 * Log a debug message with timestamp
 * @param {string} message - Message to log
 * @param {string} type - Log type ('info', 'warning', 'error', 'success')
 * @returns {Object} - The created log entry
 */
export function debugLog(message, type = 'info') {
  // Create timestamp
  const now = new Date();
  const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;
  
  // Create log entry
  const logEntry = {
    time: timeString,
    message: message,
    type: type
  };
  
  // Add to history
  AppState.debug.logHistory.push(logEntry);
  
  // Trim history if needed
  if (AppState.debug.logHistory.length > AppState.debug.MAX_LOG_HISTORY) {
    AppState.debug.logHistory = AppState.debug.logHistory.slice(-AppState.debug.MAX_LOG_HISTORY);
  }
  
  // Update debug console if visible
  if (AppState.debug.panelVisible) {
    updateDebugConsole(logEntry);
  }
  
  // Also log to browser console for dev tools
  const consoleMethod = type === 'error' ? console.error : 
                        type === 'warning' ? console.warn : 
                        type === 'success' ? console.info : 
                        console.log;
                        
  consoleMethod(`[${type.toUpperCase()}] ${message}`);
  
  return logEntry;
}

/**
 * Update debug console with a new log entry
 * @param {Object} logEntry - The log entry to add to console
 */
export function updateDebugConsole(logEntry) {
  const debugConsole = document.getElementById('debug-console');
  if (!debugConsole) return;
  
  const logElement = document.createElement('div');
  logElement.className = `debug-log debug-log-${logEntry.type}`;
  logElement.innerHTML = `<span class="debug-log-time">${logEntry.time}</span> ${logEntry.message}`;
  
  debugConsole.appendChild(logElement);
  debugConsole.scrollTop = debugConsole.scrollHeight;
}

/**
 * Refresh the entire debug console with all history
 */
export function refreshDebugConsole() {
  const debugConsole = document.getElementById('debug-console');
  if (!debugConsole) return;
  
  // Clear console first
  debugConsole.innerHTML = '';
  
  // Add all history
  AppState.debug.logHistory.forEach(entry => {
    updateDebugConsole(entry);
  });
}

/**
 * Initialize the debug system and set up event listeners
 */
export function initDebugMode() {
  const debugToggle = document.getElementById('debug-mode-toggle');
  const debugPanel = document.getElementById('debug-panel');
  const clearDebugBtn = document.getElementById('clear-debug');
  const closeDebugBtn = document.getElementById('close-debug');
  
  if (!debugToggle || !debugPanel) {
    console.warn("Debug elements not found in the DOM");
    return;
  }
  
  // Set initial state
  debugToggle.checked = AppState.debug.panelVisible;
  debugPanel.style.display = AppState.debug.panelVisible ? 'block' : 'none';
  
  // Toggle debug panel visibility
  debugToggle.addEventListener('change', function() {
    AppState.debug.panelVisible = this.checked;
    localStorage.setItem('nfc_debug_panel_visible', AppState.debug.panelVisible);
    debugPanel.style.display = AppState.debug.panelVisible ? 'block' : 'none';
    
    // If showing panel, refresh with all history
    if (AppState.debug.panelVisible) {
      refreshDebugConsole();
      debugLog(`Debug panel shown with ${AppState.debug.logHistory.length} log entries`, 'info');
    } else {
      debugLog(`Debug panel hidden, but logging continues`, 'info');
    }
  });
  
  // Clear button
  if (clearDebugBtn) {
    clearDebugBtn.addEventListener('click', function() {
      AppState.debug.logHistory = [];
      document.getElementById('debug-console').innerHTML = '';
      debugLog('Debug log history cleared', 'info');
    });
  }
  
  // Close button
  if (closeDebugBtn) {
    closeDebugBtn.addEventListener('click', function() {
      debugPanel.style.display = 'none';
      debugToggle.checked = false;
      AppState.debug.panelVisible = false;
      localStorage.setItem('nfc_debug_panel_visible', 'false');
      debugLog('Debug panel hidden, but logging continues', 'info');
    });
  }
  
  debugLog("Debug system initialized", 'info');
}

/**
 * Add debug CSS styles to the document head
 */
export function injectDebugStyles() {
  const debugStyles = `
    .debug-panel {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      max-width: 800px;
      margin: 0 auto;
      background-color: #1f2937;
      color: #e5e7eb;
      border-top-left-radius: 8px;
      border-top-right-radius: 8px;
      box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
      z-index: 1000;
      display: none;
      max-height: 40vh;
      transition: all 0.3s ease;
    }

    .debug-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 15px;
      background-color: #111827;
      border-top-left-radius: 8px;
      border-top-right-radius: 8px;
    }

    .debug-header h3 {
      color: #e5e7eb;
      margin: 0;
      font-size: 1rem;
    }

    .debug-console {
      padding: 10px 15px;
      overflow-y: auto;
      max-height: calc(40vh - 40px);
      font-family: monospace;
      font-size: 0.875rem;
      line-height: 1.4;
    }

    .debug-log {
      margin-bottom: 6px;
      word-break: break-word;
    }

    .debug-log-info {
      color: #93c5fd;
    }

    .debug-log-error {
      color: #f87171;
    }

    .debug-log-warning {
      color: #fbbf24;
    }

    .debug-log-success {
      color: #6ee7b7;
    }

    .debug-log-time {
      color: #9ca3af;
      font-size: 0.75rem;
      margin-right: 6px;
    }

    .debug-controls {
      display: flex;
      gap: 8px;
    }

    .debug-toggle {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 10px;
      align-items: center;
    }

    .debug-toggle label {
      cursor: pointer;
      display: flex;
      align-items: center;
      font-size: 0.875rem;
      user-select: none;
    }

    .debug-toggle input[type="checkbox"] {
      width: auto;
      margin-right: 6px;
    }
  `;
  
  // Add styles to document head if they don't already exist
  if (!document.getElementById('debug-styles')) {
    const styleElement = document.createElement('style');
    styleElement.id = 'debug-styles';
    styleElement.textContent = debugStyles;
    document.head.appendChild(styleElement);
  }
}
