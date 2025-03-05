// encryption-service.js - Encryption and token generation
import eventBus from './event-bus.js';

class EncryptionService {
    constructor() {
        this.settings = {
            tokenFormat: 'readable',
            tokenLength: '12'
        };
    }

    init() {
        // Load settings for token generation
        this.loadSettings();
        eventBus.publish('log', { message: 'Encryption service initialized', type: 'info' });
    }

    loadSettings() {
        const savedSettings = localStorage.getItem('nfc_writer_settings');
        if (savedSettings) {
            try {
                this.settings = JSON.parse(savedSettings);
            } catch (e) {
                console.error('Failed to parse settings', e);
                eventBus.publish('log', { 
                    message: `Failed to parse settings: ${e}`, 
                    type: 'error' 
                });
            }
        }
    }

    // Generate token based on settings
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

    // Encrypt a payload with a key
    encrypt(data, key) {
        return CryptoJS.AES.encrypt(JSON.stringify(data), key).toString();
    }

    // Decrypt a payload with a key
    decrypt(encryptedData, key) {
        const decryptedBytes = CryptoJS.AES.decrypt(encryptedData, key);
        return JSON.parse(decryptedBytes.toString(CryptoJS.enc.Utf8));
    }

    // Create the owner record with encryption
    createOwnerRecord(ownerToken) {
        // Create owner data - this entire object will be encrypted
        const ownerData = {
            type: "owner",
            token: ownerToken
        };
        
        // Encrypt the entire owner data using the owner token as the key
        const encryptedData = this.encrypt(ownerData, ownerToken);
        
        // Return a record that only contains the encrypted data, not the actual token
        return {
            recordType: "text",
            data: JSON.stringify({
                type: "encrypted_owner",
                data: encryptedData
                // No token stored in clear text
            })
        };
    }

    // Create a reader record - encrypted with owner token
    createReaderRecord(reader, ownerToken) {
        // Create reader data - this entire object will be encrypted
        const readerData = {
            type: "reader",
            id: reader.id,
            token: reader.token
        };
        
        // Encrypt the entire reader data using the owner token as the key
        const encryptedData = this.encrypt(readerData, ownerToken);
        
        // Return a record that only contains the ID (for identification) and encrypted data
        return {
            recordType: "text",
            data: JSON.stringify({
                type: "encrypted_reader",
                id: reader.id, // Only the ID is in clear text for identification
                data: encryptedData
                // No token stored in clear text
            })
        };
    }

    // Try to decrypt owner record
    decryptOwnerRecord(record, token) {
        try {
            const decryptedData = this.decrypt(record.data, token);
            // Validate that it's an owner record and token matches
            if (decryptedData.type === "owner" && decryptedData.token === token) {
                return decryptedData;
            }
        } catch (error) {
            return null;
        }
        return null;
    }

    // Try to decrypt reader record
    decryptReaderRecord(record, ownerToken) {
        try {
            const decryptedData = this.decrypt(record.data, ownerToken);
            // Validate that it's a reader record
            if (decryptedData.type === "reader") {
                return {
                    id: decryptedData.id,
                    token: decryptedData.token
                };
            }
        } catch (error) {
            return null;
        }
        return null;
    }
}

// Create and export a singleton instance
const encryptionService = new EncryptionService();
export default encryptionService;
