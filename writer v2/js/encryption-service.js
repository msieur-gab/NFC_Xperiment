// encryption-service.js
class EncryptionService {
    constructor() {
        // Ensure CryptoJS is available
        if (typeof CryptoJS === 'undefined') {
            throw new Error('CryptoJS library is required');
        }
    }

    /**
     * Encrypt data with a given key
     * @param {Object} data - The data to encrypt
     * @param {string} key - The encryption key
     * @returns {string} Encrypted data
     */
    encrypt(data, key) {
        try {
            return CryptoJS.AES.encrypt(
                JSON.stringify(data), 
                key
            ).toString();
        } catch (error) {
            console.error('Encryption error:', error);
            throw new Error('Failed to encrypt data');
        }
    }

    /**
     * Decrypt data with a given key
     * @param {string} encryptedData - The encrypted data
     * @param {string} key - The decryption key
     * @returns {Object} Decrypted data
     */
    decrypt(encryptedData, key) {
        try {
            const bytes = CryptoJS.AES.decrypt(encryptedData, key);
            return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
        } catch (error) {
            console.error('Decryption error:', error);
            throw new Error('Failed to decrypt data');
        }
    }

    /**
     * Generate a secure random token
     * @param {Object} settings - Token generation settings
     * @returns {string} Generated token
     */
    generateToken(settings) {
        const format = settings.tokenFormat;
        const length = parseInt(settings.tokenLength);
        
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
     * Create an encrypted record for NFC tag
     * @param {string} type - Type of record (owner/reader)
     * @param {Object} data - Data to encrypt
     * @param {string} key - Encryption key
     * @returns {Object} Encrypted record
     */
    createEncryptedRecord(type, data, key) {
        const encryptedData = this.encrypt(data, key);
        
        return {
            recordType: "text",
            data: JSON.stringify({
                type: `encrypted_${type}`,
                data: encryptedData
            })
        };
    }
}

export default EncryptionService;
