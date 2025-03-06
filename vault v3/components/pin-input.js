class PinInput extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.digits = 4;
    this._value = '';
    this.render();
  }
  
  static get observedAttributes() {
    return ['digits', 'label'];
  }
  
  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'digits' && newValue && !isNaN(newValue)) {
      this.digits = parseInt(newValue, 10);
    }
    this.render();
  }
  
  get value() {
    const input = this.shadowRoot.querySelector('input');
    return input ? input.value : '';
  }
  
  set value(val) {
    const input = this.shadowRoot.querySelector('input');
    if (input) {
      input.value = val;
    }
    this._value = val;
  }
  
  clear() {
    const input = this.shadowRoot.querySelector('input');
    if (input) {
      input.value = '';
    }
    this._value = '';
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
          margin-bottom: 8px;
          font-weight: 500;
        }
        
        input {
          width: 100%;
          padding: 12px;
          font-size: 20px;
          text-align: center;
          border: 1px solid #ccc;
          border-radius: 4px;
          margin-bottom: 10px;
        }
        
        input:focus {
          outline: none;
          border-color: #2563eb;
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2);
        }
        
        .toggle-btn {
          background: none;
          border: none;
          color: #2563eb;
          cursor: pointer;
          font-size: 14px;
          padding: 5px 10px;
          align-self: center;
        }
      </style>
      
      <div class="pin-container">
        <label for="pin-input">${label}</label>
        <input 
          id="pin-input"
          type="password"
          inputmode="numeric"
          pattern="[0-9]*"
          maxlength="${this.digits}"
          autocomplete="off"
        >
        <button class="toggle-btn" type="button">Show PIN</button>
      </div>
    `;
    
    const input = this.shadowRoot.querySelector('input');
    const toggleBtn = this.shadowRoot.querySelector('.toggle-btn');
    
    input.addEventListener('input', () => {
      this._value = input.value;
      
      if (input.value.length === parseInt(this.digits)) {
        this.dispatchEvent(new Event('complete'));
      }
      
      this.dispatchEvent(new Event('input'));
    });
    
    toggleBtn.addEventListener('click', () => {
      if (input.type === 'password') {
        input.type = 'text';
        toggleBtn.textContent = 'Hide PIN';
      } else {
        input.type = 'password';
        toggleBtn.textContent = 'Show PIN';
      }
    });
  }
}

customElements.define('pin-input', PinInput);