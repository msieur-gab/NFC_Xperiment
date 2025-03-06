class PinInput extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.digits = 4;
    this.render();
    this._value = '';
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
    
    const inputs = this.shadowRoot.querySelectorAll('.pin-digit');
    for (let i = 0; i < inputs.length; i++) {
      inputs[i].value = val[i] || '';
    }
  }
  
  clear() {
    this.value = '';
    const firstInput = this.shadowRoot.querySelector('.pin-digit');
    if (firstInput) firstInput.focus();
  }
  
  _setupEventListeners() {
    const inputs = this.shadowRoot.querySelectorAll('.pin-digit');
    
    inputs.forEach((input, index) => {
      // Handle input event (works better on mobile than keydown)
      input.addEventListener('input', (e) => {
        // Get the new value
        const newChar = input.value.slice(-1);
        
        // Reset the input to just the last digit entered
        input.value = newChar;
        
        // Update our internal value
        this._updateValue();
        
        // Auto advance to next field if we have a value and not on last field
        if (newChar && index < inputs.length - 1) {
          inputs[index + 1].focus();
        }
        
        // If this is the last input and we have a value, send complete event
        if (index === inputs.length - 1 && newChar) {
          setTimeout(() => {
            this.dispatchEvent(new Event('complete'));
          }, 10);
        }
      });
      
      // Also handle keydown for special keys (backspace, arrows)
      input.addEventListener('keydown', (e) => {
        // Handle backspace - if empty and not first input, go back
        if (e.key === 'Backspace') {
          if (input.value === '' && index > 0) {
            // Focus previous input
            inputs[index - 1].focus();
            // Clear previous input
            setTimeout(() => {
              inputs[index - 1].value = '';
              this._updateValue();
            }, 0);
          } else if (input.value !== '') {
            // Clear current input if it has a value
            setTimeout(() => {
              input.value = '';
              this._updateValue();
            }, 0);
          }
        } 
        // Handle left arrow
        else if (e.key === 'ArrowLeft' && index > 0) {
          inputs[index - 1].focus();
        } 
        // Handle right arrow
        else if (e.key === 'ArrowRight' && index < inputs.length - 1) {
          inputs[index + 1].focus();
        }
        // Handle delete key
        else if (e.key === 'Delete') {
          input.value = '';
          this._updateValue();
        }
      });
      
      // Handle focus events to select text on focus
      input.addEventListener('focus', () => {
        // Select all text in input when focused
        setTimeout(() => input.select(), 0);
      });
      
      // Handle paste events
      input.addEventListener('paste', (e) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text/plain');
        if (/^\d+$/.test(pasted)) {
          this.value = pasted;
          this._updateValue();
          
          // Trigger complete event if we have enough digits
          if (this._value.length >= this.digits) {
            this.dispatchEvent(new Event('complete'));
          }
        }
      });
    });
    
    // Handle the toggle button
    const toggleBtn = this.shadowRoot.querySelector('.toggle-pin');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const inputs = this.shadowRoot.querySelectorAll('.pin-digit');
        const type = inputs[0].type === 'password' ? 'text' : 'password';
        
        inputs.forEach(input => input.type = type);
        toggleBtn.textContent = type === 'password' ? 'Show' : 'Hide';
      });
    }
  }
  
  _updateValue() {
    const inputs = this.shadowRoot.querySelectorAll('.pin-digit');
    this._value = Array.from(inputs).map(input => input.value).join('');
    this.dispatchEvent(new Event('input'));
    
    // Check if all digits are filled
    if (this._value.length === this.digits) {
      this.dispatchEvent(new Event('complete'));
    }
  }
  
  render() {
    const label = this.getAttribute('label') || 'PIN';
    const placeholder = this.getAttribute('placeholder') || '';
    
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
        
        .pin-fields {
          display: flex;
          gap: 8px;
          justify-content: center;
        }
        
        .pin-digit {
          width: 40px;
          height: 50px;
          border: 1px solid #e5e7eb;
          border-radius: 4px;
          font-size: 20px;
          text-align: center;
          transition: border-color 0.2s;
        }
        
        .pin-digit:focus {
          outline: none;
          border-color: #2563eb;
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
        }
        
        .pin-digit.filled {
          background-color: #f3f4f6;
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
        <div class="pin-fields">
          ${Array(this.digits).fill().map(() => `
            <input 
              type="password" 
              class="pin-digit" 
              maxlength="1" 
              autocomplete="off"
              inputmode="numeric"
              pattern="[0-9]*"
              placeholder="${placeholder.charAt(0) || ''}"
            />
          `).join('')}
        </div>
        <div class="controls">
          <button class="toggle-pin" type="button">Show</button>
        </div>
      </div>
    `;
    
    // Immediately set up the toggle button
    const toggleBtn = this.shadowRoot.querySelector('.toggle-pin');
    toggleBtn.addEventListener('click', () => {
      const inputs = this.shadowRoot.querySelectorAll('.pin-digit');
      const type = inputs[0].type === 'password' ? 'text' : 'password';
      
      inputs.forEach(input => input.type = type);
      toggleBtn.textContent = type === 'password' ? 'Show' : 'Hide';
    });
  }
}

customElements.define('pin-input', PinInput);