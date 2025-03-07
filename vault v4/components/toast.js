class ToastNotification extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.render();
    
    this._visible = false;
    this._timeout = null;
    this._queue = [];
  }
  
  static get observedAttributes() {
    return ['duration'];
  }
  
  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'duration') {
      this.duration = parseInt(newValue, 10) || 3000;
    }
  }
  
  get duration() {
    return this._duration || 3000;
  }
  
  set duration(val) {
    this._duration = val;
  }
  
  show(message, type = 'info', duration = null) {
    const toast = {
      message,
      type: ['success', 'error', 'info', 'warning'].includes(type) ? type : 'info',
      duration: duration || this.duration
    };
    
    if (this._visible) {
      this._queue.push(toast);
      return;
    }
    
    this._showToast(toast);
  }
  
  success(message, duration) {
    this.show(message, 'success', duration);
  }
  
  error(message, duration) {
    this.show(message, 'error', duration);
  }
  
  info(message, duration) {
    this.show(message, 'info', duration);
  }
  
  warning(message, duration) {
    this.show(message, 'warning', duration);
  }
  
  _showToast(toast) {
    if (this._timeout) {
      clearTimeout(this._timeout);
    }
    
    const container = this.shadowRoot.querySelector('.toast-container');
    const messageEl = this.shadowRoot.querySelector('.toast-message');
    const iconEl = this.shadowRoot.querySelector('.toast-icon');
    
    // Set type-specific styles
    container.className = `toast-container ${toast.type}`;
    
    // Set icon based on type
    let icon = '?';
    switch (toast.type) {
      case 'success':
        icon = '✓';
        break;
      case 'error':
        icon = '!';
        break;
      case 'warning':
        icon = '⚠️';
        break;
      case 'info':
        icon = 'i';
        break;
    }
    iconEl.textContent = icon;
    
    // Set message text
    messageEl.textContent = toast.message;
    
    // Show toast
    container.classList.add('visible');
    this._visible = true;
    
    // Hide after duration
    this._timeout = setTimeout(() => {
      this._hideToast();
    }, toast.duration);
  }
  
  _hideToast() {
    const container = this.shadowRoot.querySelector('.toast-container');
    container.classList.remove('visible');
    
    // Wait for animation to complete
    setTimeout(() => {
      this._visible = false;
      
      // Show next toast in queue if any
      if (this._queue.length > 0) {
        const nextToast = this._queue.shift();
        this._showToast(nextToast);
      }
    }, 300);
  }
  
  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          position: fixed;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 1000;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        
        .toast-container {
          display: flex;
          align-items: center;
          min-width: 300px;
          max-width: 90vw;
          padding: 12px 15px;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          opacity: 0;
          transform: translateY(20px);
          transition: transform 0.3s, opacity 0.3s;
          pointer-events: none;
        }
        
        .toast-container.visible {
          opacity: 1;
          transform: translateY(0);
          pointer-events: auto;
        }
        
        .toast-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 30px;
          height: 30px;
          min-width: 30px;
          border-radius: 50%;
          color: white;
          font-weight: bold;
          margin-right: 12px;
        }
        
        .toast-message {
          color: #1f2937;
          font-size: 14px;
          line-height: 1.4;
        }
        
        /* Type-specific styles */
        .toast-container.success {
          background-color: #ecfdf5;
          border-left: 4px solid #10b981;
        }
        
        .toast-container.success .toast-icon {
          background-color: #10b981;
        }
        
        .toast-container.error {
          background-color: #fef2f2;
          border-left: 4px solid #ef4444;
        }
        
        .toast-container.error .toast-icon {
          background-color: #ef4444;
        }
        
        .toast-container.info {
          background-color: #eff6ff;
          border-left: 4px solid #2563eb;
        }
        
        .toast-container.info .toast-icon {
          background-color: #2563eb;
        }
        
        .toast-container.warning {
          background-color: #fffbeb;
          border-left: 4px solid #f59e0b;
        }
        
        .toast-container.warning .toast-icon {
          background-color: #f59e0b;
        }
      </style>
      
      <div class="toast-container">
        <div class="toast-icon"></div>
        <div class="toast-message"></div>
      </div>
    `;
  }
}

customElements.define('toast-notification', ToastNotification);
