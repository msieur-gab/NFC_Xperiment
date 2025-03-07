/**
 * Enhanced Debug Console Web Component
 * A self-contained, mobile-friendly console for logging and debugging
 * that includes integration capabilities
 */

class EnhancedDebugConsole extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.logs = [];
    this.maxLogs = 100; // Default maximum number of logs to store
    this.isVisible = false;
    this.debugMode = false;
    this.render();
  }

  static get observedAttributes() {
    return ['visible', 'position', 'max-logs', 'auto-init', 'debug-mode'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'visible') {
      this.isVisible = newValue !== null;
      this.updateVisibility();
    } else if (name === 'position') {
      this.updatePosition(newValue);
    } else if (name === 'max-logs') {
      this.maxLogs = parseInt(newValue) || 100;
    } else if (name === 'auto-init') {
      // Auto-initialize if attribute is present
      if (newValue !== null) {
        this.initialize();
      }
    } else if (name === 'debug-mode') {
      this.debugMode = newValue !== null;
      if (this.debugMode && !this.initialized) {
        this.initialize();
      }
    }
  }

  connectedCallback() {
    // Add keyboard shortcut (Ctrl+`)
    document.addEventListener('keydown', this.handleKeyboardShortcut.bind(this));
    
    // Check if auto-init is set
    if (this.hasAttribute('auto-init')) {
      this.initialize();
    }
    
    // Check if debug mode should be enabled by URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('debug') === 'true') {
      this.debugMode = true;
      this.initialize();
    }
  }

  disconnectedCallback() {
    document.removeEventListener('keydown', this.handleKeyboardShortcut.bind(this));
  }

  handleKeyboardShortcut(event) {
    // Check for Ctrl/Cmd + ` (backtick)
    if ((event.ctrlKey || event.metaKey) && event.key === '`') {
      this.toggleVisibility();
      event.preventDefault();
    }
  }

  /**
   * Initialize the debug console and set up console overrides
   */
  initialize() {
    if (this.initialized) return;
    
    // Add the FAB button if it doesn't exist
    this.createFabButton();
    
    // Create global logger helper
    this.createGlobalLogger();
    
    // Override console methods to capture logs
    this.setupConsoleOverrides();
    
    // Add error handling
    this.setupErrorHandling();
    
    // Add debug indicator to page title if in debug mode
    if (this.debugMode) {
      if (!document.title.includes('[DEBUG]')) {
        document.title = `[DEBUG] ${document.title}`;
      }
    }
    
    // Add a log to indicate initialization
    console.info('Debug console initialized. Press Ctrl+` or tap the gear icon to toggle.');
    
    this.initialized = true;
  }

  /**
   * Create the floating action button to toggle the console
   */
  createFabButton() {
    let fabButton = document.querySelector('.debug-fab');
    if (!fabButton) {
      fabButton = document.createElement('div');
      fabButton.className = 'debug-fab';
      fabButton.innerHTML = '⚙️'; // Gear emoji
      fabButton.title = 'Open Debug Console (Ctrl+`)';
      
      // Add styles for the FAB button
      const style = document.createElement('style');
      style.textContent = `
        .debug-fab {
          position: fixed;
          bottom: 20px;
          right: 20px;
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background-color: #2563eb;
          color: white;
          box-shadow: 0 3px 5px rgba(0, 0, 0, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          cursor: pointer;
          z-index: 1000;
          transition: transform 0.2s;
        }
        
        .debug-fab:hover {
          transform: scale(1.05);
        }
      `;
      document.head.appendChild(style);
      document.body.appendChild(fabButton);
      
      // Add click event to toggle debug console
      fabButton.addEventListener('click', () => {
        this.toggleVisibility();
      });
    }
  }

  /**
   * Create a global helper for logging from anywhere in the app
   */
  createGlobalLogger() {
    window.DebugLogger = {
      log: (...args) => console.log(...args),
      info: (...args) => console.info(...args),
      warn: (...args) => console.warn(...args),
      error: (...args) => console.error(...args),
      debug: (...args) => console.debug(...args),
      clear: () => this.clear(),
      show: () => {
        this.isVisible = true;
        this.updateVisibility();
      },
      hide: () => {
        if (this.isVisible) {
          this.isVisible = false;
          this.updateVisibility();
        }
      }
    };
    
    // Add helper method to log NFC operations specially
    window.DebugLogger.nfc = (message) => {
      console.info(`[NFC] ${message}`);
    };
  }

  /**
   * Override console methods to capture logs
   */
  setupConsoleOverrides() {
    // Store original console methods
    const originalConsole = {
      log: console.log,
      warn: console.warn,
      error: console.error,
      info: console.info,
      debug: console.debug
    };

    // Override console.log
    console.log = (...args) => {
      this.addLogEntry('log', args);
      originalConsole.log.apply(console, args);
    };

    // Override console.warn
    console.warn = (...args) => {
      this.addLogEntry('warn', args);
      originalConsole.warn.apply(console, args);
    };

    // Override console.error
    console.error = (...args) => {
      this.addLogEntry('error', args);
      originalConsole.error.apply(console, args);
    };

    // Override console.info
    console.info = (...args) => {
      this.addLogEntry('info', args);
      originalConsole.info.apply(console, args);
    };

    // Override console.debug
    console.debug = (...args) => {
      this.addLogEntry('debug', args);
      originalConsole.debug.apply(console, args);
    };
  }

  /**
   * Set up error handling for unhandled errors
   */
  setupErrorHandling() {
    window.addEventListener('error', (event) => {
      console.error('[Unhandled Error]', event.error?.message || event.message, event.error);
    });
    
    window.addEventListener('unhandledrejection', (event) => {
      console.error('[Unhandled Promise Rejection]', event.reason);
    });
  }

  /**
   * Add a log entry to the console
   */
  addLogEntry(type, args) {
    // Create timestamp
    const now = new Date();
    const timestamp = `${now.toLocaleTimeString()}.${String(now.getMilliseconds()).padStart(3, '0')}`;
    
    // Format args
    let formattedArgs = args.map(arg => {
      if (arg === null) return 'null';
      if (arg === undefined) return 'undefined';
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg);
        } catch (e) {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');

    // Add log to our array
    this.logs.push({
      type,
      timestamp,
      content: formattedArgs
    });

    // Trim logs if we have too many
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Update the display if visible
    this.updateLogDisplay();
  }

  /**
   * Update the log display in the UI
   */
  updateLogDisplay() {
    if (!this.isVisible) return;

    const logContainer = this.shadowRoot.querySelector('.log-container');
    if (!logContainer) return;

    // Clear and rebuild the log display
    logContainer.innerHTML = '';
    
    this.logs.forEach(log => {
      const logElement = document.createElement('div');
      logElement.className = `log-entry ${log.type}`;
      
      // Build log content with timestamp
      logElement.innerHTML = `
        <span class="log-timestamp">${log.timestamp}</span>
        <span class="log-content">${this.escapeHtml(log.content)}</span>
      `;
      
      logContainer.appendChild(logElement);
    });

    // Auto-scroll to bottom
    logContainer.scrollTop = logContainer.scrollHeight;
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(html) {
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
  }

  /**
   * Add a custom log entry
   */
  addLog(type, ...args) {
    this.addLogEntry(type, args);
    return true;
  }

  /**
   * Clear all logs
   */
  clear() {
    this.logs = [];
    this.updateLogDisplay();
    return true;
  }

  /**
   * Toggle the visibility of the console
   */
  toggleVisibility() {
    this.isVisible = !this.isVisible;
    this.updateVisibility();
    
    if (this.isVisible) {
      this.updateLogDisplay();
    }
  }

  /**
   * Update the visibility of the console in the UI
   */
  updateVisibility() {
    const container = this.shadowRoot.querySelector('.debug-console');
    if (container) {
      if (this.isVisible) {
        container.classList.add('visible');
        document.body.classList.add('debug-console-active');
      } else {
        container.classList.remove('visible');
        document.body.classList.remove('debug-console-active');
      }
    }
  }

  /**
   * Update the position of the console
   */
  updatePosition(position) {
    const container = this.shadowRoot.querySelector('.debug-console');
    if (!container) return;

    // Remove all position classes
    container.classList.remove('position-bottom', 'position-top');

    // Add appropriate position class
    if (position === 'top') {
      container.classList.add('position-top');
    } else {
      container.classList.add('position-bottom');
    }
  }

  /**
   * Copy all logs to the clipboard
   */
  copyLogs() {
    const logText = this.logs.map(log => 
      `[${log.timestamp}] [${log.type}] ${log.content}`
    ).join('\n');

    navigator.clipboard.writeText(logText)
      .then(() => {
        const copyButton = this.shadowRoot.querySelector('#copy-button');
        copyButton.textContent = 'Copied!';
        
        setTimeout(() => {
          copyButton.textContent = 'Copy All';
        }, 2000);
      })
      .catch(err => {
        console.error('Failed to copy logs:', err);
        alert('Failed to copy logs. Please check permissions.');
      });
  }

  /**
   * Add debug logging methods to specific modules
   */
  enhanceModule(module, name) {
    if (!module) return;
    
    // Get all function properties
    const functions = Object.keys(module).filter(key => 
      typeof module[key] === 'function'
    );
    
    // Enhance each function with logging
    functions.forEach(funcName => {
      const originalFunc = module[funcName];
      module[funcName] = function(...args) {
        console.debug(`[${name}] Calling ${funcName}()`);
        try {
          const result = originalFunc.apply(this, args);
          
          // Handle promises specially
          if (result instanceof Promise) {
            return result.then(
              value => {
                console.debug(`[${name}] ${funcName}() completed successfully`);
                return value;
              },
              error => {
                console.error(`[${name}] ${funcName}() failed:`, error);
                throw error;
              }
            );
          }
          
          console.debug(`[${name}] ${funcName}() completed`);
          return result;
        } catch (error) {
          console.error(`[${name}] ${funcName}() threw error:`, error);
          throw error;
        }
      };
    });
    
    console.info(`[Debug] Enhanced ${functions.length} functions in ${name} module`);
  }

  /**
   * Render the console UI
   */
  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          --console-height: 40vh;
          --console-bg: rgba(30, 30, 30, 0.95);
          --console-border: #555;
          --header-bg: #333;
          --log-color: #eee;
          --log-info-color: #8cdcfe;
          --log-warn-color: #ffc107;
          --log-error-color: #f44336;
          --log-debug-color: #9cdcfe;
          --timestamp-color: #888;
          --primary-color: #2563eb;
        }

        .debug-console {
          display: none;
          position: fixed;
          left: 0;
          right: 0;
          bottom: 0;
          height: var(--console-height);
          background-color: var(--console-bg);
          color: var(--log-color);
          font-family: monospace;
          font-size: 12px;
          z-index: 10000;
          flex-direction: column;
          border-top: 1px solid var(--console-border);
          transition: transform 0.3s;
          transform: translateY(100%);
          touch-action: pan-x pan-y;
        }

        .debug-console.position-top {
          top: 0;
          bottom: auto;
          border-top: none;
          border-bottom: 1px solid var(--console-border);
          transform: translateY(-100%);
        }

        .debug-console.visible {
          display: flex;
          transform: translateY(0);
        }

        .console-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 10px;
          background-color: var(--header-bg);
          border-bottom: 1px solid var(--console-border);
          user-select: none;
        }

        .console-title {
          font-weight: bold;
        }

        .console-controls {
          display: flex;
          gap: 8px;
        }

        .console-button {
          background-color: #444;
          color: #fff;
          border: none;
          border-radius: 4px;
          padding: 4px 8px;
          font-size: 11px;
          cursor: pointer;
        }

        .console-button:hover {
          background-color: #555;
        }

        .console-button.danger {
          background-color: #b71c1c;
        }

        .console-button.danger:hover {
          background-color: #d32f2f;
        }

        .console-button.success {
          background-color: #2e7d32;
        }

        .console-button.success:hover {
          background-color: #388e3c;
        }

        .log-container {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
          -webkit-overflow-scrolling: touch;
        }

        .log-entry {
          padding: 4px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
          word-break: break-word;
          white-space: pre-wrap;
        }

        .log-timestamp {
          color: var(--timestamp-color);
          margin-right: 8px;
        }

        .log-content {
          display: inline;
        }

        .log-entry.info .log-content {
          color: var(--log-info-color);
        }

        .log-entry.warn .log-content {
          color: var(--log-warn-color);
        }

        .log-entry.error .log-content {
          color: var(--log-error-color);
        }

        .log-entry.debug .log-content {
          color: var(--log-debug-color);
        }

        .drag-handle {
          height: 8px;
          background-color: #444;
          cursor: ns-resize;
          position: relative;
        }

        .drag-handle::after {
          content: "";
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          width: 40px;
          height: 3px;
          background-color: #666;
          border-radius: 2px;
        }

        .console-filters {
          display: flex;
          gap: 5px;
          padding: 5px 10px;
          background-color: rgba(0, 0, 0, 0.2);
        }

        .filter-checkbox {
          display: flex;
          align-items: center;
          gap: 3px;
          cursor: pointer;
        }

        .filter-checkbox input {
          margin: 0;
        }

        @media (max-width: 480px) {
          .console-button {
            padding: 4px 6px;
            font-size: 10px;
          }
          
          .console-filters {
            flex-wrap: wrap;
          }
        }
      </style>

      <div class="debug-console position-bottom">
        <div class="drag-handle" id="drag-handle"></div>
        <div class="console-header">
          <div class="console-title">Debug Console</div>
          <div class="console-controls">
            <button class="console-button success" id="copy-button">Copy All</button>
            <button class="console-button danger" id="clear-button">Clear</button>
            <button class="console-button" id="close-button">Close</button>
          </div>
        </div>
        <div class="console-filters">
          <label class="filter-checkbox">
            <input type="checkbox" checked data-type="log">
            <span>Log</span>
          </label>
          <label class="filter-checkbox">
            <input type="checkbox" checked data-type="info">
            <span>Info</span>
          </label>
          <label class="filter-checkbox">
            <input type="checkbox" checked data-type="warn">
            <span>Warn</span>
          </label>
          <label class="filter-checkbox">
            <input type="checkbox" checked data-type="error">
            <span>Error</span>
          </label>
          <label class="filter-checkbox">
            <input type="checkbox" checked data-type="debug">
            <span>Debug</span>
          </label>
        </div>
        <div class="log-container"></div>
      </div>
    `;

    // Set up event listeners
    this.setupEventListeners();
  }

  /**
   * Set up event listeners for the console UI
   */
  setupEventListeners() {
    // Close button
    const closeButton = this.shadowRoot.querySelector('#close-button');
    closeButton.addEventListener('click', () => this.toggleVisibility());

    // Clear button
    const clearButton = this.shadowRoot.querySelector('#clear-button');
    clearButton.addEventListener('click', () => this.clear());

    // Copy button
    const copyButton = this.shadowRoot.querySelector('#copy-button');
    copyButton.addEventListener('click', () => this.copyLogs());

    // Drag handle for resizing
    const dragHandle = this.shadowRoot.querySelector('#drag-handle');
    let startY, startHeight;

    const onDragStart = (e) => {
      startY = e.clientY || (e.touches && e.touches[0].clientY);
      const consoleElement = this.shadowRoot.querySelector('.debug-console');
      startHeight = parseInt(window.getComputedStyle(consoleElement).height, 10);
      
      document.addEventListener('mousemove', onDragMove);
      document.addEventListener('touchmove', onDragMove);
      document.addEventListener('mouseup', onDragEnd);
      document.addEventListener('touchend', onDragEnd);
      e.preventDefault();
    };

    const onDragMove = (e) => {
      const y = e.clientY || (e.touches && e.touches[0].clientY);
      const consoleElement = this.shadowRoot.querySelector('.debug-console');
      
      if (consoleElement.classList.contains('position-bottom')) {
        const newHeight = startHeight - (y - startY);
        consoleElement.style.height = `${Math.max(150, newHeight)}px`;
      } else {
        const newHeight = startHeight + (y - startY);
        consoleElement.style.height = `${Math.max(150, newHeight)}px`;
      }
    };

    const onDragEnd = () => {
      document.removeEventListener('mousemove', onDragMove);
      document.removeEventListener('touchmove', onDragMove);
      document.removeEventListener('mouseup', onDragEnd);
      document.removeEventListener('touchend', onDragEnd);
    };

    dragHandle.addEventListener('mousedown', onDragStart);
    dragHandle.addEventListener('touchstart', onDragStart);

    // Filter checkboxes
    const filterCheckboxes = this.shadowRoot.querySelectorAll('.filter-checkbox input');
    filterCheckboxes.forEach(checkbox => {
      checkbox.addEventListener('change', () => {
        this.applyFilters();
      });
    });
  }

  /**
   * Apply filters to show/hide log types
   */
  applyFilters() {
    const logEntries = this.shadowRoot.querySelectorAll('.log-entry');
    const activeFilters = Array.from(this.shadowRoot.querySelectorAll('.filter-checkbox input:checked'))
      .map(input => input.dataset.type);

    logEntries.forEach(entry => {
      const type = Array.from(entry.classList)
        .find(cls => ['log', 'info', 'warn', 'error', 'debug'].includes(cls));
      
      if (activeFilters.includes(type)) {
        entry.style.display = '';
      } else {
        entry.style.display = 'none';
      }
    });
  }
}

// Register the web component
customElements.define('enhanced-debug-console', EnhancedDebugConsole);
