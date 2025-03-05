// reader-manager.js
class ReaderManager {
    constructor(eventBus) {
        this.eventBus = eventBus;
        this.readers = [];
        this.settings = {
            tokenFormat: 'readable',
            tokenLength: '12'
        };
    }

    /**
     * Add a new reader
     * @param {string} readerId - Unique identifier for the reader
     * @param {string} [readerToken] - Optional token for the reader
     */
    addReader(readerId, readerToken = null) {
        // Check if reader already exists
        if (this.readers.some(reader => reader.id === readerId)) {
            this.eventBus.emit('status:warning', `Reader "${readerId}" already exists`);
            return false;
        }

        // Generate token if not provided
        if (!readerToken) {
            readerToken = this.generateToken();
        }

        // Add reader
        const newReader = { id: readerId, token: readerToken };
        this.readers.push(newReader);

        // Emit event for UI update
        this.eventBus.emit('readers:updated', this.readers);
        this.eventBus.emit('status:success', `Reader "${readerId}" added`);

        return true;
    }

    /**
     * Remove a reader by index
     * @param {number} index - Index of reader to remove
     */
    removeReader(index) {
        if (index < 0 || index >= this.readers.length) {
            this.eventBus.emit('status:error', 'Invalid reader index');
            return false;
        }

        const removedReader = this.readers.splice(index, 1)[0];

        // Emit events
        this.eventBus.emit('readers:updated', this.readers);
        this.eventBus.emit('status:info', `Reader "${removedReader.id}" removed`);

        return true;
    }

    /**
     * Generate a token based on current settings
     * @returns {string} Generated token
     */
    generateToken() {
        const format = this.settings.tokenFormat;
        const length = parseInt(this.settings.tokenLength);
        
        if (format === 'readable') {
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
            let result = '';
            for (let i = 0; i < length; i++) {
                if (i > 0 && i % 4 === 0) result += '-';
                result += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            return result;
        } else {
            return CryptoJS.lib.WordArray.random(length / 2).toString();
        }
    }

    /**
     * Update reader settings
     * @param {Object} newSettings - New settings for token generation
     */
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        this.eventBus.emit('settings:updated', this.settings);
    }

    /**
     * Get current list of readers
     * @returns {Array} List of readers
     */
    getReaders() {
        return [...this.readers];
    }
}

export default ReaderManager;
