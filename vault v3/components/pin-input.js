class PinInput extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.digits = 4;
    this._value = '';
    this.render();
    this._setupEventListeners();
  }
  
  static get observedAttributes() {
    return ['digits', 'label', 'placeholder'];
  }
  
  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'digits' && newValue && !isNaN(newValue)) {
      this.digits = parseInt(newValue, 10);
      this.render();
      this._setupEventListeners();
    }
    if (name === 'label' || name === 'placeholder') {
      this.render();
    }
  }
  
  get value() {
    return this._value;
  }
  
  set value(val) {
    if (val === null || val === undefined) val = '';
    val = val.toString().slice(0, this.digits);
    this._value = val;
    
    // Update the hidden input value
    const hiddenInput = this.shadowRoot.querySelector('.pin-hidden-input');
    if (hiddenInput) {
      hiddenInput.value = val;
    }
    
    // Update the display
    this._updateDisplay();
  }
  
  clear() {
    this._value = '';
    const hiddenInput = this.shadowRoot.querySelector('.pin-hidden-input');
    if (hiddenInput) {
      hiddenInput.value = '';
      hiddenInput.focus();
    }
    this._updateDisplay();
  }
  
  _setupEventListeners() {
    const hiddenInput = this.shadowRoot.querySelector('.pin-hidden-input');
    const pinDisplay = this.shadowRoot.querySelector('.pin-display');
    
    // Handle clicks on the display to focus the hidden input
    pinDisplay.addEventListener('click', () => {
      hiddenInput.focus();
    });
    
    // Handle input event on the hidden input
    hiddenInput.addEventListener('input', (e) => {
      // Only allow numbers
      const numericValue = e.target.value.replace(/[^0-9]/g, '');
      
      // Limit to the number of digits
      const truncatedValue = numericValue.slice(0, this.digits);
      
      // Update the hidden input if needed
      if (e.target.value !== truncatedValue) {
        e.target.value = truncatedValue;
      }
      
      // Update our internal value
      this._value = truncatedValue;
      
      // Update the display
      this._updateDisplay();
      
      // Dispatch input event
      this.dispatchEvent(new Event('input'));
      
      // If we have all digits, dispatch complete event
      if (truncatedValue.length === this.digits) {
        this.dispatchEvent(new Event('complete'));
      }
    });
    
    // Handle keydown for backspace and delete
    hiddenInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && this._value.length > 0) {
        this.dispatchEvent(new Event('complete'));
      }
    });
    
    // Handle the toggle button
    const toggleBtn = this.shadowRoot.querySelector('.toggle-pin');
    toggleBtn.addEventListener('click', () => {
      this._toggleVisibility();
    });
  }
  
  _toggleVisibility() {
    const display = this.shadowRoot.querySelector('.pin-display');
    const toggleBtn = this.shadowRoot.querySelector('.toggle-pin');
    
    const isHidden = display.classList.contains('password-mode');
    
    if (isHidden) {
      display.classList.remove('password-mode');
      toggleBtn.textContent = 'Hide';
    } else {
      display.classList.add('password-mode');
      toggleBtn.textContent = 'Show';
    }
    
    this._updateDisplay();
  }
  
  _updateDisplay() {
    const display = this.shadowRoot.querySelector('.pin-display');
    const isHidden = display.classList.contains('password-mode');
    const digits = Array.from({ length: this.digits });
    
    // Clear existing content
    display.innerHTML = '';
    
    // Create digit holders
    digits.forEach((_, i) => {
      const digitHolder = document.createElement('div');
      digitHolder.className = 'digit-holder';
      
      if (i < this._value.length) {
        // This digit has a value
        if (isHidden) {
          // Show a dot for password mode
          digitHolder.textContent = '●';
        } else {
          // Show the actual digit
          digitHolder.textContent = this._value[i];
        }
        digitHolder.classList.add('filled');
      }
      
      display.appendChild(digitHolder);
    });
  }
  
  render() {
    const label = this.getAttribute('label') || 'PIN';
    
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        
        .pin-container {
          display: flex;
          flex-direction: column;
          margin-bottom: 15px;
        }
        
        label {
          display: block;
          margin-bottom: 5px;
          font-weight: 500;
        }
        
        .pin-input-area {
          position: relative;
        }
        
        .pin-hidden-input {
          position: absolute;
          opacity: 0;
          width: 100%;
          height: 100%;
          top: 0;
          left: 0;
          border: none;
          z-index: 2;
          cursor: pointer;
        }
        
        .pin-display {
          display: flex;
          gap: 8px;
          justify-content: center;
          align-items: center;
          min-height: 50px;
          cursor: text;
        }
        
        .digit-holder {
          width: 40px;
          height: 50px;
          border: 1px solid #e5e7eb;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          background-color: #f9fafb;
        }
        
        .digit-holder.filled {
          background-color: #f3f4f6;
          border-color: #d1d5db;
        }
        
        .toggle-pin {
          background: none;
          border: none;
          color: #2563eb;
          cursor: pointer;
          padding: 5px;
          margin-left: 5px;
          font-size: 14px;
        }
        
        .controls {
          display: flex;
          align-items: center;
          margin-top: 5px;
          justify-content: center;
        }
      </style>
      
      <div class="pin-container">
        ${label ? `<label>${label}</label>` : ''}
        <div class="pin-input-area">
          <input 
            type="tel" 
            class="pin-hidden-input" 
            inputmode="numeric" 
            pattern="[0-9]*" 
            autocomplete="one-time-code"
            maxlength="${this.digits}"
          />
          <div class="pin-display password-mode">
            ${Array(this.digits).fill().map(() => `
              <div class="digit-holder"></div>
            `).join('')}
          </div>
        </div>
        <div class="controls">
          <button class="toggle-pin" type="button">Show</button>
        </div>
      </div>
    `;
    
    // Initialize the display
    this._updateDisplay();
  }
}

customElements.define('pin-input', PinInput);