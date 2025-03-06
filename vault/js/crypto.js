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
    try {
        // Pour le débogage, afficher une partie de l'entrée
        // console.log(`Converting base64 to ArrayBuffer: ${base64.substring(0, 20)}...`);
        
        const binaryString = atob(base64);
        // console.log(`Binary length: ${binaryString.length}`);
        
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
        // console.log(`ArrayBuffer created, length: ${bytes.byteLength}`);
        return bytes.buffer;
    } catch (error) {
        // console.error('Error in base64ToArrayBuffer:', error);
        
        // Alternative method for debugging
        try {
            // Try with window.atob
            const binaryString = window.atob(base64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            // console.log(`Alternative method worked, length: ${bytes.byteLength}`);
            return bytes.buffer;
        } catch (altError) {
            // console.error('Alternative method also failed:', altError);
            throw new Error(`Base64 conversion failed: ${error.message}`);
        }
    }
}

// Convert ArrayBuffer to base64 string
function arrayBufferToBase64(buffer) {
    try {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);
        // console.log(`Converted ArrayBuffer to base64: ${base64.substring(0, 20)}...`);
        return base64;
    } catch (error) {
        // console.error('Error in arrayBufferToBase64:', error);
        
        // Alternative method for debugging
        try {
            const bytes = new Uint8Array(buffer);
            let binary = '';
            for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            const base64 = window.btoa(binary);
            // console.log(`Alternative method worked: ${base64.substring(0, 20)}...`);
            return base64;
        } catch (altError) {
            // console.error('Alternative method also failed:', altError);
            throw new Error(`Base64 conversion failed: ${error.message}`);
        }
    }
}

// Derive an encryption key from PIN using PBKDF2
async function deriveKey(pin, salt = null) {
    try {
        // Si aucun sel fourni, créer un sel aléatoire
        if (!salt) {
            salt = crypto.getRandomValues(new Uint8Array(16));
        } else if (typeof salt === 'string') {
            // Si le sel est une chaîne base64, convertir en ArrayBuffer
            salt = base64ToArrayBuffer(salt);
        }
        
        // Convertir PIN en ArrayBuffer
        const pinData = str2ab(pin);
        
        // Importer le PIN comme clé
        const pinKey = await crypto.subtle.importKey(
            'raw',
            pinData,
            { name: 'PBKDF2' },
            false,
            ['deriveKey']
        );
        
        // Dériver une clé avec PBKDF2
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
    } catch (error) {
        // console.error('Error in deriveKey:', error);
        throw new Error(`Key derivation failed: ${error.message}`);
    }
}

// IMPORTANT: Pour test, utilisons AES-CBC au lieu de AES-GCM pour voir si c'est la source du problème
// Generate a random IV for AES
function generateIV() {
    // Pour AES-CBC, l'IV doit être de 16 octets
    return crypto.getRandomValues(new Uint8Array(16));
}

// Encrypt data using AES-CBC (pour test)
async function encrypt(data, key, iv) {
    try {
        const dataBuffer = str2ab(data);
        
        // Encrypt the data with AES-CBC instead of AES-GCM
        const encryptedData = await crypto.subtle.encrypt(
            {
                name: 'AES-CBC',
                iv: iv
            },
            key,
            dataBuffer
        );
        
        // Return Base64 encoded encrypted data
        return arrayBufferToBase64(encryptedData);
    } catch (error) {
        // console.error('Encryption error:', error);
        throw new Error(`Encryption failed: ${error.message}`);
    }
}

// Decrypt data using AES-CBC (pour test)
async function decrypt(encryptedData, key, iv) {
    try {
        // Convert Base64 to ArrayBuffer
        const encryptedBuffer = base64ToArrayBuffer(encryptedData);
        
        // Decrypt the data with AES-CBC
        const decryptedBuffer = await crypto.subtle.decrypt(
            {
                name: 'AES-CBC',
                iv: iv
            },
            key,
            encryptedBuffer
        );
        
        // Convert the decrypted ArrayBuffer to string
        return ab2str(decryptedBuffer);
    } catch (error) {
        // console.error('Decryption error:', error);
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