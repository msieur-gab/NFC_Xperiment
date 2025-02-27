/**
 * FragmentEffect - A text animation effect with random character fragments
 */
class FragmentEffect {
    /**
     * Create a new FragmentEffect instance
     * @param {Object} options - Configuration options
     * @param {HTMLElement} options.element - The DOM element to render the effect in
     * @param {string[]} options.messages - Array of messages to cycle through
     * @param {string[]} [options.colors=['lightgray', 'gray', 'darkgray', 'white']] - Colors for random characters
     * @param {number} [options.typingSpeed=40] - Milliseconds between typing steps
     * @param {number} [options.tailLength=20] - Number of random characters to show after text
     * @param {number} [options.delayBetweenMessages=15] - How long to pause between messages
     * @param {boolean} [options.randomizeMessages=false] - Whether to randomize message order
     */
    constructor(options) {
        this.element = options.element;
        this.messages = options.messages;
        this.colors = options.colors || ['lightgray', 'gray', 'darkgray', 'white'];
        this.typingSpeed = options.typingSpeed || 80;
        this.tailLength = options.tailLength || 20;
        this.delayBetweenMessages = options.delayBetweenMessages || 15;
        this.randomizeMessages = options.randomizeMessages || false;
        
        // Internal state
        this.state = {
            text: '',
            messageIndex: 0,
            charIndex: 0,
            direction: 'forward',
            delay: this.delayBetweenMessages,
            step: 2
        };
        
        this.animationFrame = null;
    }
    
    /**
     * Get a random color from the colors array
     * @returns {string} A random color
     */
    getRandomColor() {
        return this.colors[Math.floor(Math.random() * this.colors.length)];
    }
    
    /**
     * Generate a random character
     * @returns {string} A random character
     */
    getRandomChar() {
        return String.fromCharCode(Math.random() * (127 - 33) + 33);
    }
    
    /**
     * Create a document fragment with random colored characters
     * @param {number} count - Number of random characters to generate
     * @returns {DocumentFragment} Fragment containing the random characters
     */
    getRandomColoredString(count) {
        const fragment = document.createDocumentFragment();
        for (let i = 0; i < count; i++) {
            const char = document.createElement('span');
            char.textContent = this.getRandomChar();
            char.style.color = this.getRandomColor();
            fragment.appendChild(char);
        }
        return fragment;
    }
    
    /**
     * Render the current state of the animation
     */
    render() {
        const currentMessage = this.messages[this.state.messageIndex];
        
        if (this.state.step) {
            this.state.step--;
        } else {
            this.state.step = 2;
            
            if (this.state.direction === 'forward') {
                if (this.state.charIndex < currentMessage.length) {
                    this.state.text += currentMessage[this.state.charIndex];
                    this.state.charIndex++;
                } else {
                    if (this.state.delay) {
                        this.state.delay--;
                    } else {
                        this.state.direction = 'backward';
                        this.state.delay = this.delayBetweenMessages;
                    }
                }
            } else {
                if (this.state.charIndex > 0) {
                    this.state.text = this.state.text.slice(0, -1);
                    this.state.charIndex--;
                } else {
                    if (this.randomizeMessages) {
                        this.state.messageIndex = Math.floor(Math.random() * this.messages.length);
                    } else {
                        this.state.messageIndex = (this.state.messageIndex + 1) % this.messages.length;
                    }
                    this.state.direction = 'forward';
                }
            }
        }
        
        this.element.textContent = this.state.text;
        this.element.appendChild(this.getRandomColoredString(
            Math.min(this.tailLength, currentMessage.length - this.state.charIndex)
        ));
        
        this.animationFrame = setTimeout(() => this.render(), this.typingSpeed);
    }
    
    /**
     * Start the animation
     * @param {number} [delay=1000] - Delay before starting in milliseconds
     */
    start(delay = 1000) {
        setTimeout(() => this.render(), delay);
    }
    
    /**
     * Stop the animation
     */
    stop() {
        if (this.animationFrame) {
            clearTimeout(this.animationFrame);
            this.animationFrame = null;
        }
    }
    
    /**
     * Change the messages being displayed
     * @param {string[]} newMessages - New array of messages
     */
    setMessages(newMessages) {
        this.messages = newMessages;
        this.state.messageIndex = 0;
        this.state.charIndex = 0;
        this.state.text = '';
        this.state.direction = 'forward';
    }
    
    /**
     * Add random characters to any text
     * @param {string} text - The text to add random characters to
     * @param {number} [count=5] - Number of random characters to add
     * @returns {HTMLElement} A span element with the text and random characters
     */
    static addRandomCharsToText(text, count = 5) {
        const container = document.createElement('span');
        const textNode = document.createTextNode(text);
        container.appendChild(textNode);
        
        const effect = new FragmentEffect({
            element: container,
            messages: [text]
        });
        
        container.appendChild(effect.getRandomColoredString(count));
        return container;
    }
    
    /**
     * Apply random character effect to an existing element
     * @param {HTMLElement} element - The element to apply the effect to
     * @param {Object} options - Configuration options
     * @param {number} [options.density=0.1] - Percentage of characters to replace (0-1)
     * @param {number} [options.minFragments=3] - Minimum number of fragments to add
     * @param {number} [options.updateInterval=2000] - Milliseconds between updates
     * @param {string[]} [options.colors] - Colors for the random characters
     * @returns {Object} Control object with stop method
     */
    static applyToElement(element, options = {}) {
        const density = options.density || 0.1;
        const minFragments = options.minFragments || 3;
        const updateInterval = options.updateInterval || 2000;
        const colors = options.colors || ['lightgray', 'gray', 'darkgray', 'white'];
        
        // Store the original text
        const originalText = element.textContent;
        let intervalId;
        
        // Function to update the text with random characters
        const updateText = () => {
            // Create a copy of the original text
            let newText = originalText;
            const charArray = newText.split('');
            
            // Calculate how many characters to replace
            const replaceCount = Math.max(
                minFragments, 
                Math.floor(charArray.length * density)
            );
            
            // Replace random characters
            for (let i = 0; i < replaceCount; i++) {
                const randomIndex = Math.floor(Math.random() * charArray.length);
                // Skip spaces
                if (charArray[randomIndex] !== ' ' && charArray[randomIndex] !== '\n') {
                    charArray[randomIndex] = String.fromCharCode(Math.random() * (127 - 33) + 33);
                }
            }
            
            // Convert back to HTML with colored spans for the random chars
            element.innerHTML = '';
            let lastReplaced = false;
            
            charArray.forEach((char, index) => {
                if (char !== originalText[index]) {
                    // This is a replaced character
                    const span = document.createElement('span');
                    span.textContent = char;
                    span.style.color = colors[Math.floor(Math.random() * colors.length)];
                    element.appendChild(span);
                    lastReplaced = true;
                } else {
                    // Original character
                    if (lastReplaced) {
                        // Start a new text node
                        element.appendChild(document.createTextNode(char));
                        lastReplaced = false;
                    } else {
                        // Append to the last text node
                        const lastNode = element.lastChild;
                        if (lastNode && lastNode.nodeType === Node.TEXT_NODE) {
                            lastNode.textContent += char;
                        } else {
                            element.appendChild(document.createTextNode(char));
                        }
                    }
                }
            });
        };
        
        // Initial update
        updateText();
        
        // Set interval for updates
        intervalId = setInterval(updateText, updateInterval);
        
        // Return control object
        return {
            stop: () => {
                clearInterval(intervalId);
                element.textContent = originalText;
            },
            update: updateText
        };
    }
    
    /**
     * Create a simple random encryption effect that changes individual characters with color pulsing
     * @param {HTMLElement} element - The element to apply the effect to
     * @param {Object} options - Configuration options
     * @param {number} [options.minActiveChars=5] - Minimum number of characters to animate at once
     * @param {number} [options.maxActiveChars=10] - Maximum number of characters to animate at once
     * @param {number} [options.updateInterval=80] - Milliseconds between animation updates
     * @param {number} [options.minPauseDuration=100] - Minimum milliseconds between adding new characters
     * @param {number} [options.maxPauseDuration=1000] - Maximum milliseconds between adding new characters
     * @param {number} [options.minChangeCount=5] - Minimum times each character changes before fading out
     * @param {number} [options.maxChangeCount=20] - Maximum times each character changes before fading out
     * @param {number} [options.fadeSteps=5] - Number of steps to fade out the effect
     * @param {string[]} [options.colors] - Base colors for the random characters
     * @param {string[]} [options.charSet] - Set of characters to use
     * @returns {Object} Control object with stop method
     */
    static createSimpleEncryptionEffect(element, options = {}) {
        const minActiveChars = options.minActiveChars || 5;
        const maxActiveChars = options.maxActiveChars || 10;
        const updateInterval = options.updateInterval || 80;
        const minPauseDuration = options.minPauseDuration || 100;
        const maxPauseDuration = options.maxPauseDuration || 1000;
        const minChangeCount = options.minChangeCount || 5;
        const maxChangeCount = options.maxChangeCount || 20;
        const fadeSteps = options.fadeSteps || 5;
        const baseColors = options.colors || ['#666666', '#777777', '#888888', '#999999', '#aaaaaa', '#bbbbbb', '#cccccc', '#dddddd', '#ffffff'];
        
        // Default character set (encryption-like characters)
        const defaultCharSet = '!@#$%^&*()_+-=[]{}|;:<>?~`ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const charSet = options.charSet || defaultCharSet;
        
        // Get a random pause duration
        const getRandomPauseDuration = () => {
            return Math.floor(Math.random() * (maxPauseDuration - minPauseDuration + 1)) + minPauseDuration;
        };
        
        // Get a random change count
        const getRandomChangeCount = () => {
            return Math.floor(Math.random() * (maxChangeCount - minChangeCount + 1)) + minChangeCount;
        };
        
        // Format the text into a grid
        const formatTextGrid = (text) => {
            const cleanText = text.replace(/\s+/g, '');
            
            // Calculate optimal grid dimensions based on container size
            const containerWidth = element.clientWidth || 128;
            
            // Estimate character dimensions (monospace font)
            const charWidth = 8; // Approximate width in pixels
            
            // Calculate how many characters can fit per line
            const charsPerLine = Math.max(8, Math.floor(containerWidth / charWidth));
            
            // Create the grid
            const grid = [];
            
            for (let i = 0; i < cleanText.length; i += charsPerLine) {
                const line = cleanText.substr(i, charsPerLine);
                grid.push(line.split(''));
            }
            
            return grid;
        };
        
        // Get the original text and create a grid
        const originalText = element.textContent.replace(/\s+/g, '');
        const grid = formatTextGrid(originalText);
        
        // Create a display grid that will be modified
        let displayGrid = JSON.parse(JSON.stringify(grid));
        
        // Track active animation characters
        let activeChars = [];
        let fadingChars = []; // Track characters that are fading out
        let intervalId;
        let isAddingChars = false;
        
        // Get a color based on the pulse position
        const getPulseColor = (pulsePosition) => {
            // Create a sine wave that oscillates between 0 and 1
            const wave = (Math.sin(pulsePosition * Math.PI) + 1) / 2;
            
            // Map the wave to a color index
            const colorIndex = Math.floor(wave * (baseColors.length - 1));
            return baseColors[colorIndex];
        };
        
        // Fade out a color towards white
        const fadeOutColor = (color, step, totalSteps) => {
            // Parse the hex color
            const r = parseInt(color.slice(1, 3), 16);
            const g = parseInt(color.slice(3, 5), 16);
            const b = parseInt(color.slice(5, 7), 16);
            
            // Calculate the step size for each component
            const stepR = (255 - r) / totalSteps;
            const stepG = (255 - g) / totalSteps;
            const stepB = (255 - b) / totalSteps;
            
            // Calculate the new color
            const newR = Math.min(255, Math.floor(r + stepR * step));
            const newG = Math.min(255, Math.floor(g + stepG * step));
            const newB = Math.min(255, Math.floor(b + stepB * step));
            
            // Convert back to hex
            return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
        };
        
        // Select a random character position that's not already active
        const selectRandomCharPosition = () => {
            // Create a list of all possible positions
            const allPositions = [];
            for (let r = 0; r < grid.length; r++) {
                const cols = grid[r].length;
                for (let c = 0; c < cols; c++) {
                    // Check if this position is already active or fading
                    const isActive = activeChars.some(char => char.row === r && char.col === c);
                    const isFading = fadingChars.some(char => char.row === r && char.col === c);
                    if (!isActive && !isFading) {
                        allPositions.push({ row: r, col: c });
                    }
                }
            }
            
            // If no positions are available, return null
            if (allPositions.length === 0) {
                return null;
            }
            
            // Return a random position
            return allPositions[Math.floor(Math.random() * allPositions.length)];
        };
        
        // Add a new random character to animate
        const addRandomChar = () => {
            if (isAddingChars || activeChars.length >= maxActiveChars) {
                return;
            }
            
            isAddingChars = true;
            
            const pos = selectRandomCharPosition();
            if (pos) {
                const maxChanges = getRandomChangeCount();
                activeChars.push({
                    row: pos.row,
                    col: pos.col,
                    changeCount: 0,
                    maxChanges: maxChanges,
                    pulsePosition: 0,
                    pulseDirection: 1, // 1 for increasing brightness, -1 for decreasing
                    pulseSpeed: 1 / maxChanges, // Adjust speed based on change count
                    char: charSet[Math.floor(Math.random() * charSet.length)],
                    originalChar: grid[pos.row][pos.col] // Store the original character
                });
            }
            
            isAddingChars = false;
            
            // Schedule adding another character if we're below the minimum
            if (activeChars.length < minActiveChars) {
                setTimeout(addRandomChar, getRandomPauseDuration());
            }
        };
        
        // Start adding characters until we reach the minimum
        const startAddingChars = () => {
            // Add the first character immediately
            addRandomChar();
            
            // Schedule adding more characters with random delays
            const addMoreChars = () => {
                if (activeChars.length < minActiveChars) {
                    setTimeout(() => {
                        addRandomChar();
                        addMoreChars();
                    }, getRandomPauseDuration());
                }
            };
            
            addMoreChars();
        };
        
        // Update the display
        const updateDisplay = () => {
            // Reset display grid to original
            displayGrid = JSON.parse(JSON.stringify(grid));
            
            // Process each active character
            const completedChars = [];
            
            // First, update and render active characters
            activeChars.forEach((char, index) => {
                // Update pulse position
                char.pulsePosition += char.pulseDirection * char.pulseSpeed;
                
                // Reverse direction if we hit the bounds
                if (char.pulsePosition >= 1) {
                    char.pulseDirection = -1;
                    char.pulsePosition = 1;
                } else if (char.pulsePosition <= 0) {
                    char.pulseDirection = 1;
                    char.pulsePosition = 0;
                }
                
                // Increment change count
                char.changeCount++;
                
                // If we've reached the maximum changes, move to fading array
                if (char.changeCount >= char.maxChanges) {
                    // Create a fading character with the same properties
                    fadingChars.push({
                        row: char.row,
                        col: char.col,
                        char: char.char,
                        originalChar: char.originalChar,
                        pulsePosition: char.pulsePosition,
                        fadeStep: 0,
                        totalFadeSteps: fadeSteps
                    });
                    
                    // Mark for removal from active array
                    completedChars.push(index);
                    return;
                }
                
                // Change the character
                char.char = charSet[Math.floor(Math.random() * charSet.length)];
                
                // Get color based on pulse position
                const color = getPulseColor(char.pulsePosition);
                
                // Update the cell
                if (displayGrid[char.row] && displayGrid[char.row][char.col]) {
                    displayGrid[char.row][char.col] = {
                        char: char.char,
                        color: color
                    };
                }
            });
            
            // Then, update and render fading characters
            const completedFadingChars = [];
            
            fadingChars.forEach((char, index) => {
                char.fadeStep++;
                
                if (char.fadeStep >= char.totalFadeSteps) {
                    // Fade-out complete, mark for removal
                    completedFadingChars.push(index);
                    return;
                }
                
                // Calculate fade progress (0 to 1)
                const fadeProgress = char.fadeStep / char.totalFadeSteps;
                
                // Interpolate between the random character and original character
                let displayChar;
                if (fadeProgress < 0.5) {
                    // First half: keep the random character
                    displayChar = char.char;
                } else {
                    // Second half: switch to original character
                    displayChar = char.originalChar;
                }
                
                // Apply fade-out to color
                const baseColor = getPulseColor(char.pulsePosition);
                const fadedColor = fadeOutColor(baseColor, char.fadeStep, char.totalFadeSteps);
                
                // Update the cell
                if (displayGrid[char.row] && displayGrid[char.row][char.col]) {
                    displayGrid[char.row][char.col] = {
                        char: displayChar,
                        color: fadedColor
                    };
                }
            });
            
            // Remove completed active characters
            for (let i = completedChars.length - 1; i >= 0; i--) {
                activeChars.splice(completedChars[i], 1);
            }
            
            // Remove completed fading characters
            for (let i = completedFadingChars.length - 1; i >= 0; i--) {
                fadingChars.splice(completedFadingChars[i], 1);
            }
            
            // If we removed any characters, maybe add new ones
            if (completedChars.length > 0 && activeChars.length < maxActiveChars) {
                setTimeout(addRandomChar, getRandomPauseDuration());
            }
            
            // Render the grid
            renderGrid();
        };
        
        // Render the grid to the element
        const renderGrid = () => {
            element.innerHTML = '';
            
            displayGrid.forEach(row => {
                const rowElement = document.createElement('div');
                rowElement.style.whiteSpace = 'pre';
                rowElement.style.lineHeight = '1';
                rowElement.style.height = '1em';
                
                let currentSpan = null;
                let currentColor = null;
                
                row.forEach(cell => {
                    if (typeof cell === 'object') {
                        // This is a modified cell with color
                        if (cell.color !== currentColor) {
                            currentSpan = document.createElement('span');
                            currentSpan.style.color = cell.color;
                            rowElement.appendChild(currentSpan);
                            currentColor = cell.color;
                        }
                        currentSpan.textContent += cell.char;
                    } else {
                        // This is an original character
                        if (currentColor !== null) {
                            currentSpan = document.createElement('span');
                            rowElement.appendChild(currentSpan);
                            currentColor = null;
                        }
                        
                        if (!currentSpan) {
                            currentSpan = document.createElement('span');
                            rowElement.appendChild(currentSpan);
                        }
                        
                        currentSpan.textContent += cell;
                    }
                });
                
                element.appendChild(rowElement);
            });
        };
        
        // Start adding characters
        startAddingChars();
        
        // Initial render
        renderGrid();
        
        // Start the animation
        intervalId = setInterval(updateDisplay, updateInterval);
        
        // Return control object
        return {
            stop: () => {
                clearInterval(intervalId);
                // Restore original text
                element.textContent = originalText;
            },
            update: updateDisplay,
            reset: () => {
                activeChars = [];
                fadingChars = [];
                startAddingChars();
                renderGrid();
            }
        };
    }
    
    /**
     * Create an animated encryption effect on an element
     * @param {HTMLElement} element - The element to apply the effect to
     * @param {Object} options - Configuration options
     * @param {number} [options.charCount=100] - Number of characters to display
     * @param {number} [options.updateInterval=100] - Milliseconds between updates
     * @param {number} [options.changeRate=0.2] - Percentage of characters to change each update (0-1)
     * @param {string[]} [options.colors] - Colors for the random characters
     * @param {string[]} [options.charSet] - Set of characters to use (defaults to encryption-like chars)
     * @param {boolean} [options.preserveLineBreaks=true] - Whether to maintain the structure with line breaks
     * @returns {Object} Control object with stop method
     */
    static createEncryptionEffect(element, options = {}) {
        const charCount = options.charCount || 100;
        const updateInterval = options.updateInterval || 100;
        const changeRate = options.changeRate || 0.2;
        const colors = options.colors || ['#8f8f8f', '#a0a0a0', '#b0b0b0', '#ffffff'];
        const preserveLineBreaks = options.preserveLineBreaks !== false;
        
        // Default character set (encryption-like characters)
        const defaultCharSet = '!@#$%^&*()_+-=[]{}|;:,./<>?~`ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const charSet = options.charSet || defaultCharSet;
        
        let intervalId;
        let chars = [];
        
        // Initialize the character array
        const initChars = () => {
            chars = [];
            
            if (preserveLineBreaks) {
                // Get the original text and preserve its structure
                const originalText = element.textContent;
                const lines = originalText.split('\n');
                
                lines.forEach((line, lineIndex) => {
                    const trimmedLine = line.trim();
                    if (trimmedLine.length === 0) {
                        // Empty line, just add a line break
                        chars.push({ char: '\n', color: null });
                    } else {
                        // Fill with random characters but preserve line length and breaks
                        for (let i = 0; i < trimmedLine.length; i++) {
                            const randomChar = charSet[Math.floor(Math.random() * charSet.length)];
                            const randomColor = colors[Math.floor(Math.random() * colors.length)];
                            chars.push({ char: randomChar, color: randomColor });
                        }
                        
                        // Add line break if not the last line
                        if (lineIndex < lines.length - 1) {
                            chars.push({ char: '\n', color: null });
                        }
                    }
                });
            } else {
                // Just fill with random characters up to charCount
                for (let i = 0; i < charCount; i++) {
                    const randomChar = charSet[Math.floor(Math.random() * charSet.length)];
                    const randomColor = colors[Math.floor(Math.random() * colors.length)];
                    chars.push({ char: randomChar, color: randomColor });
                }
            }
        };
        
        // Update the display
        const updateDisplay = () => {
            element.innerHTML = '';
            
            // Change some characters randomly
            const charsToChange = Math.max(1, Math.floor(chars.length * changeRate));
            
            for (let i = 0; i < charsToChange; i++) {
                const randomIndex = Math.floor(Math.random() * chars.length);
                // Skip line breaks
                if (chars[randomIndex].char !== '\n') {
                    chars[randomIndex].char = charSet[Math.floor(Math.random() * charSet.length)];
                    chars[randomIndex].color = colors[Math.floor(Math.random() * colors.length)];
                }
            }
            
            // Render the characters
            let currentSpan = null;
            
            chars.forEach(charObj => {
                if (charObj.char === '\n') {
                    // Add a line break
                    element.appendChild(document.createElement('br'));
                    currentSpan = null;
                    currentColor = null;
                } else {
                    // If we don't have a current span or the color changed, create a new one
                    if (!currentSpan || currentSpan.style.color !== charObj.color) {
                        currentSpan = document.createElement('span');
                        currentSpan.style.color = charObj.color;
                        element.appendChild(currentSpan);
                        currentColor = charObj.color;
                    }
                    
                    // Add the character to the current span
                    currentSpan.textContent += charObj.char;
                }
            });
        };
        
        // Initialize
        initChars();
        updateDisplay();
        
        // Set interval for updates
        intervalId = setInterval(updateDisplay, updateInterval);
        
        // Return control object
        return {
            stop: () => {
                clearInterval(intervalId);
            },
            update: updateDisplay,
            reset: () => {
                initChars();
                updateDisplay();
            }
        };
    }
    
    /**
     * Create a traveling encryption effect with tails moving through the text
     * @param {HTMLElement} element - The element to apply the effect to
     * @param {Object} options - Configuration options
     * @param {number} [options.tailLength=10] - Number of characters in each tail
     * @param {number} [options.updateInterval=80] - Milliseconds between updates
     * @param {number} [options.travelSpeed=1] - How many characters to move per update
     * @param {string[]} [options.colors] - Colors for the random characters
     * @param {string[]} [options.charSet] - Set of characters to use
     * @param {boolean} [options.bidirectional=true] - Whether to have tails moving in both directions
     * @param {boolean} [options.preserveLayout=false] - Whether to preserve exact text layout including line breaks
     * @returns {Object} Control object with stop method
     */
    static createTravelingEncryptionEffect(element, options = {}) {
        const tailLength = options.tailLength || 10;
        const updateInterval = options.updateInterval || 80;
        const travelSpeed = options.travelSpeed || 1;
        const colors = options.colors || ['#666666', '#777777', '#888888', '#999999', '#aaaaaa', '#bbbbbb', '#cccccc', '#dddddd', '#ffffff'];
        const bidirectional = options.bidirectional !== false;
        const preserveLayout = options.preserveLayout || false;
        
        // Default character set (encryption-like characters)
        const defaultCharSet = '!@#$%^&*()_+-=[]{}|;:<>?~`ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const charSet = options.charSet || defaultCharSet;
        
        // Store the original text
        const originalText = element.textContent;
        
        // Create a structured representation of the text
        let textStructure = [];
        let linearText = '';
        
        if (preserveLayout) {
            // Preserve the exact layout including line breaks
            const lines = originalText.split('\n');
            lines.forEach((line, lineIndex) => {
                const chars = line.split('');
                chars.forEach(char => {
                    textStructure.push({
                        char: char,
                        lineBreak: false
                    });
                    linearText += char;
                });
                
                // Add line break if not the last line
                if (lineIndex < lines.length - 1) {
                    textStructure.push({
                        char: '\n',
                        lineBreak: true
                    });
                }
            });
        } else {
            // Just create a linear representation
            linearText = originalText.replace(/\s+/g, '');
            for (let i = 0; i < linearText.length; i++) {
                textStructure.push({
                    char: linearText[i],
                    lineBreak: false
                });
            }
        }
        
        // Initialize positions for the tails
        let forwardTailStart = 0;
        let backwardTailStart = linearText.length - 1;
        
        let intervalId;
        
        // Function to get a gradient color based on position in the tail
        const getTailColor = (position, tailLength) => {
            // Map position to a color index
            const colorIndex = Math.floor((position / tailLength) * colors.length);
            return colors[Math.min(colorIndex, colors.length - 1)];
        };
        
        // Update the display
        const updateDisplay = () => {
            // Create a copy of the text structure
            const displayStructure = JSON.parse(JSON.stringify(textStructure));
            
            // Map of positions in linearText to positions in displayStructure
            const positionMap = new Map();
            let linearPos = 0;
            
            for (let i = 0; i < displayStructure.length; i++) {
                if (!displayStructure[i].lineBreak) {
                    positionMap.set(linearPos, i);
                    linearPos++;
                }
            }
            
            // Apply the forward-moving tail
            for (let i = 0; i < tailLength; i++) {
                const linearPos = (forwardTailStart + i) % linearText.length;
                const structurePos = positionMap.get(linearPos);
                
                if (structurePos !== undefined) {
                    // Replace with a random character
                    displayStructure[structurePos] = {
                        char: charSet[Math.floor(Math.random() * charSet.length)],
                        color: getTailColor(tailLength - i, tailLength), // Brightest at the head
                        lineBreak: false
                    };
                }
            }
            
            // Apply the backward-moving tail if bidirectional
            if (bidirectional) {
                for (let i = 0; i < tailLength; i++) {
                    const linearPos = (backwardTailStart - i + linearText.length) % linearText.length;
                    const structurePos = positionMap.get(linearPos);
                    
                    if (structurePos !== undefined) {
                        // Replace with a random character
                        displayStructure[structurePos] = {
                            char: charSet[Math.floor(Math.random() * charSet.length)],
                            color: getTailColor(tailLength - i, tailLength), // Brightest at the head
                            lineBreak: false
                        };
                    }
                }
            }
            
            // Move the tails for the next update
            forwardTailStart = (forwardTailStart + travelSpeed) % linearText.length;
            if (bidirectional) {
                backwardTailStart = (backwardTailStart - travelSpeed + linearText.length) % linearText.length;
            }
            
            // Render the characters
            element.innerHTML = '';
            let currentSpan = null;
            let currentColor = null;
            
            displayStructure.forEach((charObj) => {
                if (charObj.lineBreak) {
                    // Add a line break
                    element.appendChild(document.createElement('br'));
                    currentSpan = null;
                    currentColor = null;
                } else {
                    const color = charObj.color || '';
                    
                    // If color changed or we don't have a span, create a new one
                    if (color !== currentColor) {
                        currentSpan = document.createElement('span');
                        if (color) {
                            currentSpan.style.color = color;
                        }
                        element.appendChild(currentSpan);
                        currentColor = color;
                    }
                    
                    // Add the character
                    currentSpan.textContent += charObj.char;
                }
            });
        };
        
        // Initialize and start the animation
        updateDisplay();
        intervalId = setInterval(updateDisplay, updateInterval);
        
        // Return control object
        return {
            stop: () => {
                clearInterval(intervalId);
                element.textContent = originalText;
            },
            update: updateDisplay,
            reset: () => {
                forwardTailStart = 0;
                backwardTailStart = linearText.length - 1;
                updateDisplay();
            }
        };
    }
    
    /**
     * Create a spreading encryption effect that starts from random points with fade-out
     * @param {HTMLElement} element - The element to apply the effect to
     * @param {Object} options - Configuration options
     * @param {number} [options.spreadRadius=5] - How far the effect spreads from each point
     * @param {number} [options.updateInterval=60] - Milliseconds between animation updates
     * @param {number} [options.minPauseDuration=3000] - Minimum milliseconds to pause before selecting new points
     * @param {number} [options.maxPauseDuration=9000] - Maximum milliseconds to pause before selecting new points
     * @param {number} [options.fadeSteps=5] - Number of steps to fade out the effect
     * @param {number} [options.maxActivePoints=4] - Maximum number of active points at once
     * @param {string[]} [options.colors] - Colors for the random characters
     * @param {string[]} [options.charSet] - Set of characters to use
     * @returns {Object} Control object with stop method
     */
    static createSpreadingEncryptionEffect(element, options = {}) {
        const spreadRadius = options.spreadRadius || 5;
        const updateInterval = options.updateInterval || 60;
        const minPauseDuration = options.minPauseDuration || 3000;
        const maxPauseDuration = options.maxPauseDuration || 9000;
        const fadeSteps = options.fadeSteps || 5;
        const maxActivePoints = options.maxActivePoints || 4;
        const colors = options.colors || ['#666666', '#777777', '#888888', '#999999', '#aaaaaa', '#bbbbbb', '#cccccc', '#dddddd', '#ffffff'];
        
        // Default character set (encryption-like characters)
        const defaultCharSet = '!@#$%^&*()_+-=[]{}|;:<>?~`ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const charSet = options.charSet || defaultCharSet;
        
        // Get a random pause duration
        const getRandomPauseDuration = () => {
            return Math.floor(Math.random() * (maxPauseDuration - minPauseDuration + 1)) + minPauseDuration;
        };
        
        // Format the text into a grid that fills the container
        const formatTextGrid = (text) => {
            const cleanText = text.replace(/\s+/g, '');
            
            // Calculate optimal grid dimensions based on container size
            const containerWidth = element.clientWidth || 128;
            const containerHeight = element.clientHeight || 100;
            
            // Estimate character dimensions (monospace font)
            const charWidth = 8; // Approximate width in pixels
            const charHeight = 12; // Approximate height in pixels
            
            // Calculate how many characters can fit per line
            const charsPerLine = Math.max(8, Math.floor(containerWidth / charWidth));
            
            // Create the grid
            const grid = [];
            
            for (let i = 0; i < cleanText.length; i += charsPerLine) {
                const line = cleanText.substr(i, charsPerLine);
                grid.push(line.split(''));
            }
            
            return grid;
        };
        
        // Get the original text and create a grid
        const originalText = element.textContent.replace(/\s+/g, '');
        const grid = formatTextGrid(originalText);
        
        // Create a display grid that will be modified
        let displayGrid = JSON.parse(JSON.stringify(grid));
        
        // Track active animation points
        let activePoints = [];
        let animationStep = 0;
        let isFadingOut = false;
        let fadeStep = 0;
        let isPaused = false;
        let intervalId;
        
        // Store all modified cells for fade-out
        let modifiedCells = [];
        
        // Select a random point in the grid
        const selectRandomPoint = () => {
            const rows = grid.length;
            if (rows === 0) return null;
            
            // Try up to 10 times to find a point that's not too close to existing points
            for (let attempt = 0; attempt < 10; attempt++) {
                const row = Math.floor(Math.random() * rows);
                const cols = grid[row].length;
                if (cols === 0) continue;
                
                const col = Math.floor(Math.random() * cols);
                
                // Check if this point is too close to any existing active point
                let tooClose = false;
                for (const point of activePoints) {
                    const distance = Math.abs(row - point.row) + Math.abs(col - point.col);
                    if (distance < spreadRadius * 1.5) {
                        tooClose = true;
                        break;
                    }
                }
                
                if (!tooClose) {
                    return { row, col, step: 0 };
                }
            }
            
            // If we couldn't find a good point after 10 attempts, just return a random one
            const row = Math.floor(Math.random() * rows);
            const cols = grid[row].length;
            if (cols === 0) return null;
            
            const col = Math.floor(Math.random() * cols);
            return { row, col, step: 0 };
        };
        
        // Add a new random point if we're under the limit
        const maybeAddRandomPoint = () => {
            if (activePoints.length < maxActivePoints) {
                const point = selectRandomPoint();
                if (point) {
                    activePoints.push(point);
                    
                    // Schedule adding another point with random delay
                    if (activePoints.length < maxActivePoints) {
                        setTimeout(maybeAddRandomPoint, getRandomPauseDuration());
                    }
                }
            }
        };
        
        // Get a color based on distance from center
        const getColorByDistance = (distance, maxDistance) => {
            // Reverse the index so brightest colors are at the center
            const index = Math.floor(((maxDistance - distance) / maxDistance) * colors.length);
            return colors[Math.max(0, Math.min(colors.length - 1, index))];
        };
        
        // Fade out a color towards white
        const fadeOutColor = (color, step, totalSteps) => {
            // Parse the hex color
            const r = parseInt(color.slice(1, 3), 16);
            const g = parseInt(color.slice(3, 5), 16);
            const b = parseInt(color.slice(5, 7), 16);
            
            // Calculate the step size for each component
            const stepR = (255 - r) / totalSteps;
            const stepG = (255 - g) / totalSteps;
            const stepB = (255 - b) / totalSteps;
            
            // Calculate the new color
            const newR = Math.min(255, Math.floor(r + stepR * step));
            const newG = Math.min(255, Math.floor(g + stepG * step));
            const newB = Math.min(255, Math.floor(b + stepB * step));
            
            // Convert back to hex
            return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
        };
        
        // Update the display
        const updateDisplay = () => {
            // Reset display grid to original
            displayGrid = JSON.parse(JSON.stringify(grid));
            modifiedCells = [];
            
            // Process each active point
            const completedPoints = [];
            
            activePoints.forEach((point, index) => {
                // If this point is fading out
                if (point.isFadingOut) {
                    point.fadeStep++;
                    
                    if (point.fadeStep >= fadeSteps) {
                        // Fade-out complete, mark for removal
                        completedPoints.push(index);
                        return;
                    }
                    
                    // Apply fade-out to this point's modified cells
                    point.modifiedCells.forEach(cell => {
                        const { row, col, originalChar, color } = cell;
                        
                        // Fade the color towards white
                        const fadedColor = fadeOutColor(color, point.fadeStep, fadeSteps);
                        
                        // Update the cell
                        if (displayGrid[row] && displayGrid[row][col]) {
                            displayGrid[row][col] = {
                                char: originalChar,
                                color: fadedColor
                            };
                            
                            // Add to global modified cells
                            modifiedCells.push(cell);
                        }
                    });
                } else {
                    // Normal animation mode
                    
                    // If we've reached the maximum spread, start fade-out
                    if (point.step >= spreadRadius) {
                        point.isFadingOut = true;
                        point.fadeStep = 0;
                        return;
                    }
                    
                    // Increment animation step
                    point.step++;
                    
                    // Initialize modified cells array if needed
                    if (!point.modifiedCells) {
                        point.modifiedCells = [];
                    }
                    
                    // Clear previous modified cells for this point
                    point.modifiedCells = [];
                    
                    // Apply the effect around this point
                    for (let r = Math.max(0, point.row - point.step); r <= Math.min(grid.length - 1, point.row + point.step); r++) {
                        if (!displayGrid[r]) continue;
                        
                        for (let c = Math.max(0, point.col - point.step); c <= Math.min(displayGrid[r].length - 1, point.col + point.step); c++) {
                            // Calculate Manhattan distance from the point
                            const distance = Math.abs(r - point.row) + Math.abs(c - point.col);
                            
                            // Only affect cells within the current step
                            if (distance <= point.step) {
                                // Probability of changing decreases with distance
                                const changeProbability = 1 - (distance / (point.step + 1));
                                
                                if (Math.random() < changeProbability) {
                                    // Get a random character and color
                                    const randomChar = charSet[Math.floor(Math.random() * charSet.length)];
                                    const cellColor = getColorByDistance(distance, point.step);
                                    
                                    // Store the cell for this point's fade-out
                                    const cell = {
                                        row: r,
                                        col: c,
                                        originalChar: randomChar,
                                        color: cellColor
                                    };
                                    
                                    point.modifiedCells.push(cell);
                                    
                                    // Add to global modified cells
                                    modifiedCells.push(cell);
                                    
                                    // Replace with the random character
                                    displayGrid[r][c] = {
                                        char: randomChar,
                                        color: cellColor
                                    };
                                }
                            }
                        }
                    }
                }
            });
            
            // Remove completed points
            for (let i = completedPoints.length - 1; i >= 0; i--) {
                activePoints.splice(completedPoints[i], 1);
            }
            
            // If we removed any points, maybe add a new one
            if (completedPoints.length > 0) {
                setTimeout(maybeAddRandomPoint, getRandomPauseDuration());
            }
            
            // Render the grid
            renderGrid();
        };
        
        // Render the grid to the element
        const renderGrid = () => {
            element.innerHTML = '';
            
            displayGrid.forEach(row => {
                const rowElement = document.createElement('div');
                rowElement.style.whiteSpace = 'pre';
                rowElement.style.lineHeight = '1';
                rowElement.style.height = '1em';
                
                let currentSpan = null;
                let currentColor = null;
                
                row.forEach(cell => {
                    if (typeof cell === 'object') {
                        // This is a modified cell with color
                        if (cell.color !== currentColor) {
                            currentSpan = document.createElement('span');
                            currentSpan.style.color = cell.color;
                            rowElement.appendChild(currentSpan);
                            currentColor = cell.color;
                        }
                        currentSpan.textContent += cell.char;
                    } else {
                        // This is an original character
                        if (currentColor !== null) {
                            currentSpan = document.createElement('span');
                            rowElement.appendChild(currentSpan);
                            currentColor = null;
                        }
                        
                        if (!currentSpan) {
                            currentSpan = document.createElement('span');
                            rowElement.appendChild(currentSpan);
                        }
                        
                        currentSpan.textContent += cell;
                    }
                });
                
                element.appendChild(rowElement);
            });
        };
        
        // Start with one random point
        maybeAddRandomPoint();
        
        // Initial render
        renderGrid();
        
        // Start the animation
        intervalId = setInterval(updateDisplay, updateInterval);
        
        // Return control object
        return {
            stop: () => {
                clearInterval(intervalId);
                // Restore original text
                element.textContent = originalText;
            },
            update: updateDisplay,
            reset: () => {
                activePoints = [];
                maybeAddRandomPoint();
                renderGrid();
            }
        };
    }
    
    /**
     * Generate random encryption-like text
     * @param {number} length - Length of text to generate
     * @param {string} [charSet] - Set of characters to use
     * @returns {string} Generated text
     */
    static generateRandomText(length, charSet = '!@#$%^&*()_+-=[]{}|;:<>?~`ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789') {
        let result = '';
        for (let i = 0; i < length; i++) {
            result += charSet.charAt(Math.floor(Math.random() * charSet.length));
        }
        return result;
    }
    
    /**
     * Initialize a container with random encryption-like text
     * @param {HTMLElement} element - The element to initialize
     * @param {Object} options - Configuration options
     * @param {number} [options.textLength=200] - Length of random text to generate
     * @param {string} [options.charSet] - Set of characters to use
     * @returns {void}
     */
    static initializeWithRandomText(element, options = {}) {
        const textLength = options.textLength || 200;
        const charSet = options.charSet || '!@#$%^&*()_+-=[]{}|;:<>?~`ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        
        // Generate random text
        const randomText = this.generateRandomText(textLength, charSet);
        
        // Set the element's text content
        element.textContent = randomText;
    }
} 