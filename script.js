/**
 * TextScrambler - A class for creating animated text scrambling effects
 */
class TextScrambler {
  /**
   * Create a new TextScrambler instance
   * @param {Object} options - Configuration options
   */
  constructor(options = {}) {
    // Default configuration with destructuring for cleaner code
    const {
      element = document.querySelector('.scrambler'),
      prefix = ' ',
      messages = [
        'welcome to whisper',
        'this content is encrypted',
        'use your physical token to unlock',
        'tap a capsule and swipe your card',
        'memories in safe place'
      ],
      colors = ['lightgray', 'gray', 'darkgray', 'white'],
      delay = 15,
      step = 2,
      tail = 20,
      timeout = 40,
      initialDelay = 1000,
      charSet = { min: 33, max: 126 }, // ASCII range for random characters
      autoStart = false
    } = options;

    // Store configuration
    this.config = {
      element: typeof element === 'string' ? document.querySelector(element) : element,
      prefix,
      messages,
      colors,
      delay,
      step,
      tail,
      timeout,
      initialDelay,
      charSet,
      autoStart
    };

    // Validate element
    if (!this.config.element || !(this.config.element instanceof HTMLElement)) {
      console.error('TextScrambler: Invalid element provided');
      return;
    }

    // Animation state
    this.state = {
      text: '',
      prefixP: -this.config.tail,
      messageIndex: 0,
      charIndex: 0,
      direction: 'forward',
      delay: this.config.delay,
      step: this.config.step,
      running: false
    };

    // Bind methods to preserve 'this' context
    this.render = this.render.bind(this);
    
    // Auto-start if configured
    if (this.config.autoStart) {
      this.start();
    }
  }

  /**
   * Get a random color from the configured colors
   * @returns {string} A random color
   */
  getRandomColor() {
    return this.config.colors[Math.floor(Math.random() * this.config.colors.length)];
  }

  /**
   * Generate a random character within the configured range
   * @returns {string} A random character
   */
  getRandomChar() {
    const { min, max } = this.config.charSet;
    return String.fromCharCode(Math.floor(Math.random() * (max - min + 1)) + min);
  }

  /**
   * Create a document fragment with random colored characters
   * @param {number} count - Number of characters to generate
   * @returns {DocumentFragment} Fragment containing colored characters
   */
  getRandomColoredString(count) {
    const fragment = document.createDocumentFragment();
    
    // Performance optimization: create elements only once if count > 0
    if (count <= 0) return fragment;
    
    for (let i = 0; i < count; i++) {
      const char = document.createElement('span');
      char.textContent = this.getRandomChar();
      char.style.color = this.getRandomColor();
      fragment.appendChild(char);
    }
    return fragment;
  }

  /**
   * Main render function that updates the text
   */
  render() {
    if (!this.state.running) return;
    
    const message = this.config.messages[this.state.messageIndex];

    if (this.state.step) {
      this.state.step--;
    } else {
      this.state.step = this.config.step;
      
      if (this.state.prefixP < this.config.prefix.length) {
        // Handle prefix animation
        if (this.state.prefixP >= 0) {
          this.state.text += this.config.prefix[this.state.prefixP];
        }
        this.state.prefixP++;
      } else {
        // Handle message animation
        if (this.state.direction === 'forward') {
          if (this.state.charIndex < message.length) {
            // Type forward
            this.state.text += message[this.state.charIndex];
            this.state.charIndex++;
          } else {
            // Pause at the end
            if (this.state.delay) {
              this.state.delay--;
            } else {
              this.state.direction = 'backward';
              this.state.delay = this.config.delay;
            }
          }
        } else {
          if (this.state.charIndex > 0) {
            // Delete backward
            this.state.text = this.state.text.slice(0, -1);
            this.state.charIndex--;
          } else {
            // Move to next message
            this.state.messageIndex = (this.state.messageIndex + 1) % this.config.messages.length;
            this.state.direction = 'forward';
          }
        }
      }
    }

    // Update DOM
    this.config.element.textContent = this.state.text;
    
    // Calculate number of random characters to append
    const randomCharCount = this.state.prefixP < this.config.prefix.length
      ? Math.min(this.config.tail, this.config.tail + this.state.prefixP)
      : Math.min(this.config.tail, message.length - this.state.charIndex);
    
    // Append random characters
    this.config.element.appendChild(this.getRandomColoredString(randomCharCount));
    
    // Schedule next frame
    this.animationId = setTimeout(this.render, this.config.timeout);
  }

  /**
   * Start the animation
   * @returns {TextScrambler} The instance for method chaining
   */
  start() {
    if (this.state.running) return this;
    
    this.state.running = true;
    this.animationId = setTimeout(this.render, this.config.initialDelay);
    return this;
  }

  /**
   * Stop the animation
   * @returns {TextScrambler} The instance for method chaining
   */
  stop() {
    if (!this.state.running) return this;
    
    this.state.running = false;
    if (this.animationId) {
      clearTimeout(this.animationId);
      this.animationId = null;
    }
    return this;
  }

  /**
   * Reset the animation state
   * @returns {TextScrambler} The instance for method chaining
   */
  reset() {
    this.stop();
    
    this.state = {
      text: '',
      prefixP: -this.config.tail,
      messageIndex: 0,
      charIndex: 0,
      direction: 'forward',
      delay: this.config.delay,
      step: this.config.step,
      running: false
    };
    
    this.config.element.textContent = '';
    
    return this;
  }

  /**
   * Update the configuration
   * @param {Object} options - New configuration options
   * @returns {TextScrambler} The instance for method chaining
   */
  update(options = {}) {
    const wasRunning = this.state.running;
    this.stop();
    
    // Update config with new options
    Object.keys(options).forEach(key => {
      if (key in this.config) {
        this.config[key] = options[key];
      }
    });
    
    // Restart if it was running
    if (wasRunning) {
      this.start();
    }
    
    return this;
  }
}

// Initialize the default scrambler when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Create the default scrambler with the whisper messages
  new TextScrambler({
    element: '.scrambler',
    messages: [
      'welcome to whisper',
      // 'gD4r%gsj&js*352g^hdTg^',
      'this content is encrypted',
      // '}ds5%4fd*jd&{ds2G@3x#',
      'use your physical token to unlock',
      // 'gd8j&g^sd[yw4$fd%j93jsu{',
      'tap a capsule and swipe your card',
      // 'd<u86&yeh%ge#lt04^hd&kc@3sj',
      'memories in safe place',
      'G,>h7JS54g@kd0e{kd>/3r4es?sd@4s'
    ],
    autoStart: true
  });
  
  // Uncomment to create additional instances
  /*
  new TextScrambler({
    element: '.scrambler-2',
    messages: ['Different', 'messages', 'here'],
    colors: ['red', 'blue', 'green'],
    timeout: 60,
    autoStart: true
  });
  */
}); 