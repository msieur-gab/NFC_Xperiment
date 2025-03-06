/**
 * NFC Vault Crypto Module
 * Handles all cryptographic operations using Web Crypto API
 */

// Convert string to ArrayBuffer
function str2ab(str) {
    const encoder = new TextEncoder();
    return encoder.encode(str);
}

// Convert ArrayBuffer to string
function ab2str(buf) {
    const decoder = new TextDecoder();
    return decoder.decode(buf);
}

// Convert base64 string to ArrayBuffer
function base64ToArrayBuffer(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

// Convert ArrayBuffer to base64 string
function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

// Derive an encryption key from PIN using PBKDF2
async function deriveKey(pin, salt = null) {
    // If no salt provided, create a random one
    if (!salt) {
        salt = crypto.getRandomValues(new Uint8Array(16));
    } else if (typeof salt === 'string') {
        // If salt is a base64 string, convert it to ArrayBuffer
        salt = base64ToArrayBuffer(salt);
    }
    
    // Convert PIN to ArrayBuffer
    const pinData = str2ab(pin);
    
    // Import PIN as a key
    const pinKey = await crypto.subtle.importKey(
        'raw',
        pinData,
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
    );
    
    // Derive a key using PBKDF2
    const derivedKey = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt,
            iterations: 100000,
            hash: 'SHA-256'
        },
        pinKey,
        {
            name: 'AES-GCM',
            length: 256
        },
        true,
        ['encrypt', 'decrypt']
    );
    
    return { derivedKey, salt };
}

// Generate a random IV for AES-GCM
function generateIV() {
    return crypto.getRandomValues(new Uint8Array(12));
}

// Encrypt data using AES-GCM
async function encrypt(data, key, iv) {
    const dataBuffer = str2ab(data);
    
    // Encrypt the data
    const encryptedData = await crypto.subtle.encrypt(
        {
            name: 'AES-GCM',
            iv: iv
        },
        key,
        dataBuffer
    );
    
    // Return Base64 encoded encrypted data
    return arrayBufferToBase64(encryptedData);
}

// Decrypt data using AES-GCM
async function decrypt(encryptedData, key, iv) {
    try {
        // Convert Base64 to ArrayBuffer
        const encryptedBuffer = base64ToArrayBuffer(encryptedData);
        
        // Decrypt the data
        const decryptedBuffer = await crypto.subtle.decrypt(
            {
                name: 'AES-GCM',
                iv: iv
            },
            key,
            encryptedBuffer
        );
        
        // Convert the decrypted ArrayBuffer to string
        return ab2str(decryptedBuffer);
    } catch (error) {
        console.error('Decryption error:', error);
        return null;
    }
}

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
