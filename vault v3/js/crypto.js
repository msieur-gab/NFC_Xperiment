/**
 * NFC Vault Crypto Module
 * Handles all cryptographic operations using CryptoJS
 * This version replaces Web Crypto API with CryptoJS for better mobile compatibility
 */

// Generate a random readable key
function generateReadableKey(length = 12) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    
    for (let i = 0; i < length; i++) {
        if (i > 0 && i % 4 === 0) result += '-';
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return result;
}

// Generate a random PIN (4 digits)
function generateRandomPin() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

// Generate a random IV for AES
function generateIV() {
    return CryptoJS.lib.WordArray.random(16);
}

// Convert IV to base64 string for storage
function arrayBufferToBase64(wordArray) {
    return CryptoJS.enc.Base64.stringify(wordArray);
}

// Convert base64 string to WordArray for CryptoJS
function base64ToArrayBuffer(base64) {
    return CryptoJS.enc.Base64.parse(base64);
}

// Simple conversion helpers (not used with CryptoJS but kept for API compatibility)
function str2ab(str) {
    return str;
}

function ab2str(buf) {
    return buf;
}

// Derive a key from PIN - with CryptoJS we don't need PBKDF2
// We'll just use the PIN directly as the key
async function deriveKey(pin, salt = null) {
    // In this simplified version, we don't use salt
    // The PIN is used directly as the encryption key
    // This is less secure but more compatible
    const derivedKey = pin;
    
    return { derivedKey, salt: null };
}

// Encrypt data using AES-CBC
async function encrypt(data, key, iv) {
    try {
        // With CryptoJS, we use the PIN directly as the key
        const encrypted = CryptoJS.AES.encrypt(
            data,
            key,
            {
                iv: iv,
                mode: CryptoJS.mode.CBC,
                padding: CryptoJS.pad.Pkcs7
            }
        );
        
        return encrypted.toString();
    } catch (error) {
        console.error('Encryption error:', error);
        throw new Error(`Encryption failed: ${error.message}`);
    }
}

// Decrypt data using AES-CBC
async function decrypt(encryptedData, key, iv) {
    try {
        // With CryptoJS, we use the PIN directly as the key
        const decrypted = CryptoJS.AES.decrypt(
            encryptedData,
            key,
            {
                iv: iv,
                mode: CryptoJS.mode.CBC,
                padding: CryptoJS.pad.Pkcs7
            }
        );
        
        return decrypted.toString(CryptoJS.enc.Utf8);
    } catch (error) {
        console.error('Decryption error:', error);
        return null;
    }
}

// Export the functions
export {
    deriveKey,
    generateIV,
    encrypt,
    decrypt,
    arrayBufferToBase64,
    base64ToArrayBuffer,
    str2ab,
    ab2str,
    generateReadableKey,
    generateRandomPin
};