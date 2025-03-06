class NfcScanAnimation extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.render();
    this._visible = false;
    this._mode = 'scan'; // scan, write, error
  }
  
  static get observedAttributes() {
    return ['visible', 'mode', 'message'];
  }
  
  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'visible') {
      this._visible = newValue !== null;
      this._updateVisibility();
    }
    if (name === 'mode') {
      if (['scan', 'write', 'error'].includes(newValue)) {
        this._mode = newValue;
        this._updateMode();
      }
    }
    if (name === 'message') {
      this._updateMessage(newValue);
    }
  }
  
  show(mode = 'scan', message = null) {
    this._visible = true;
    this._mode = mode;
    this._updateVisibility();
    this._updateMode();
    
    if (message) {
      this._updateMessage(message);
    } else {
      // Default messages based on mode
      let defaultMessage = 'Waiting for NFC tag...';
      if (mode === 'write') {
        defaultMessage = 'Writing to NFC tag...';
      } else if (mode === 'error') {
        defaultMessage = 'Error with NFC tag';
      }
      this._updateMessage(defaultMessage);
    }
    
    this.dispatchEvent(new CustomEvent('show'));
  }
  
  hide() {
    this._visible = false;
    this._updateVisibility();
    this.dispatchEvent(new CustomEvent('hide'));
  }
  
  _updateVisibility() {
    const container = this.shadowRoot.querySelector('.nfc-animation');
    if (this._visible) {
      container.classList.add('visible');
    } else {
      container.classList.remove('visible');
    }
  }
  
  _updateMode() {
    const container = this.shadowRoot.querySelector('.nfc-animation');
    container.dataset.mode = this._mode;
    
    // Remove all mode classes
    container.classList.remove('scan-mode', 'write-mode', 'error-mode');
    
    // Add current mode class
    container.classList.add(`${this._mode}-mode`);
  }
  
  _updateMessage(message) {
    if (!message) return;
    const messageEl = this.shadowRoot.querySelector('.scan-text');
    messageEl.textContent = message;
  }
  
  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }
        
        .nfc-animation {
          display: none;
          text-align: center;
          padding: 30px;
          background-color: rgba(37, 99, 235, 0.05);
          border-radius: 8px;
          border: 1px solid rgba(37, 99, 235, 0.2);
          margin: 20px 0;
          opacity: 0;
          transform: translateY(10px);
          transition: opacity 0.3s, transform 0.3s;
        }
        
        .nfc-animation.visible {
          display: block;
          opacity: 1;
          transform: translateY(0);
        }
        
        .pulse-container {
          position: relative;
          width: 80px;
          height: 80px;
          margin: 0 auto 20px;
        }
        
        .pulse {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          border-radius: 50%;
          background-color: rgba(37, 99, 235, 0.1);
          animation: pulse 2s infinite;
        }
        
        .phone-icon {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 40px;
          height: 40px;
          background-color: rgba(37, 99, 235, 0.7);
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .phone-icon::after {
          content: '';
          display: block;
          width: 20px;
          height: 20px;
          background-color: white;
          mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'%3E%3Crect x='5' y='2' width='14' height='20' rx='2' ry='2'/%3E%3Cline x1='12' y1='18' x2='12' y2='18'/%3E%3C/svg%3E");
          mask-size: contain;
          mask-repeat: no-repeat;
          mask-position: center;
        }
        
        .scan-text {
          font-size: 1.2rem;
          font-weight: 500;
          color: #2563eb;
          margin-bottom: 10px;
        }
        
        .scan-instructions {
          background-color: #eff6ff;
          padding: 10px;
          border-radius: 4px;
          font-weight: 500;
          margin-top: 10px;
          color: #2563eb;
        }
        
        @keyframes pulse {
          0% {
            transform: scale(0.5);
            opacity: 0.8;
          }
          100% {
            transform: scale(1.5);
            opacity: 0;
          }
        }
        
        @keyframes pulse-vibrate {
          0%, 100% {
            transform: scale(0.95);
          }
          50% {
            transform: scale(1.05);
          }
          25%, 75% {
            transform: translateX(-5px);
          }
          30%, 70% {
            transform: translateX(5px);
          }
        }
        
        /* Write mode */
        .nfc-animation.write-mode .pulse {
          animation: pulse-vibrate 1s infinite;
          background-color: rgba(16, 185, 129, 0.2);
        }
        
        .nfc-animation.write-mode {
          background-color: rgba(16, 185, 129, 0.05);
          border: 1px solid rgba(16, 185, 129, 0.2);
        }
        
        .nfc-animation.write-mode .scan-text {
          color: #10b981;
        }
        
        .nfc-animation.write-mode .scan-instructions {
          background-color: #ecfdf5;
          color: #10b981;
        }
        
        .nfc-animation.write-mode .phone-icon {
          background-color: rgba(16, 185, 129, 0.7);
        }
        
        /* Error mode */
        .nfc-animation.error-mode .pulse {
          animation: pulse 1.5s infinite;
          background-color: rgba(239, 68, 68, 0.2);
        }
        
        .nfc-animation.error-mode {
          background-color: rgba(239, 68, 68, 0.05);
          border: 1px solid rgba(239, 68, 68, 0.2);
        }
        
        .nfc-animation.error-mode .scan-text {
          color: #ef4444;
        }
        
        .nfc-animation.error-mode .scan-instructions {
          background-color: #fef2f2;
          color: #ef4444;
        }
        
        .nfc-animation.error-mode .phone-icon {
          background-color: rgba(239, 68, 68, 0.7);
        }
      </style>
      
      <div class="nfc-animation">
        <div class="pulse-container">
          <div class="pulse"></div>
          <div class="phone-icon"></div>
        </div>
        <p class="scan-text">Waiting for NFC tag...</p>
        <div class="scan-instructions">
          Bring the NFC tag to the back of your device
        </div>
      </div>
    `;
  }
}

customElements.define('nfc-scan-animation', NfcScanAnimation);
