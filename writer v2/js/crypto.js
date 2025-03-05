/**
 * crypto.js
 * Handles encryption and decryption for NFC tag data with space-optimized formats
 */

/**
 * Compact Encryption Module - Optimized for NFC tag space
 * Uses Web Crypto API with fallback to CryptoJS
 */
export const CompactCrypto = {
  /**
   * Convert string to byte array
   * @param {string} str - String to convert
   * @returns {Uint8Array} - Byte array
   */
  strToBytes(str) {
    return new TextEncoder().encode(str);
  },
  
  /**
   * Convert byte array to string
   * @param {Uint8Array} bytes - Byte array to convert
   * @returns {string} - Decoded string
   */
  bytesToStr(bytes) {
    return new TextDecoder().decode(bytes);
  },
  
  /**
   * Generate a cryptographic key from password
   * @param {string} password - Password to derive key from
   * @returns {Promise<Uint8Array>} - Derived key
   */
  async keyFromPassword(password) {
    const pwBytes = this.strToBytes(password);
    const salt = this.strToBytes('NFC-Tag-Salt');
    
    try {
      // Try Web Crypto API first
      const keyMaterial = await window.crypto.subtle.importKey(
        'raw', 
        pwBytes,
        { name: 'PBKDF2' }, 
        false, 
        ['deriveBits']
      );
      
      const key = await window.crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt,
          iterations: 1000, // Lower for performance on mobile
          hash: 'SHA-256'
        },
        keyMaterial,
        256 // 32 bytes
      );
      
      return new Uint8Array(key);
    } catch (e) {
      // Fallback for browsers without full Web Crypto support
      console.warn("Web Crypto PBKDF2 not available, using simpler key derivation");
      
      // Use CryptoJS for key derivation
      const simpleKey = CryptoJS.SHA256(password + "NFC-Tag-Salt");
      const keyBytes = new Uint8Array(32);
      
      // Convert CryptoJS WordArray to Uint8Array
      const words = simpleKey.words;
      for (let i = 0; i < 8; i++) {
        const word = words[i];
        keyBytes[i*4] = (word >> 24) & 0xff;
        keyBytes[i*4+1] = (word >> 16) & 0xff;
        keyBytes[i*4+2] = (word >> 8) & 0xff;
        keyBytes[i*4+3] = word & 0xff;
      }
      
      return keyBytes;
    }
  },
  
  /**
   * Convert bytes to base64url (more compact than regular base64)
   * @param {Uint8Array} bytes - Bytes to encode
   * @returns {string} - Base64url encoded string
   */
  bytesToBase64url(bytes) {
    const base64 = btoa(String.fromCharCode.apply(null, bytes));
    // Convert to base64url format (replace + with -, / with _, remove padding =)
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  
  /**
   * Convert base64url back to byte array
   * @param {string} base64url - Base64url encoded string
   * @returns {Uint8Array} - Decoded bytes
   */
  base64urlToBytes(base64url) {
    let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
    // Add padding if needed
    while (base64.length % 4) {
      base64 += '=';
    }
    
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  },
  
  /**
   * Encrypt data using AES-GCM with WebCrypto or AES with CryptoJS
   * @param {string|Uint8Array} data - Data to encrypt
   * @param {string} password - Password for encryption
   * @returns {Promise<string>} - Base64url encoded encrypted data
   */
  async encrypt(data, password) {
    try {
      // Convert data to bytes if it's a string
      const dataBytes = typeof data === 'string' ? this.strToBytes(data) : data;
      
      // Generate key from password
      const keyBytes = await this.keyFromPassword(password);
      
      try {
        // Try to use Web Crypto API for modern browsers
        const key = await window.crypto.subtle.importKey(
          'raw',
          keyBytes,
          { name: 'AES-GCM' },
          false,
          ['encrypt']
        );
        
        // Generate random IV (12 bytes)
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        
        // Encrypt
        const encrypted = await window.crypto.subtle.encrypt(
          {
            name: 'AES-GCM',
            iv
          },
          key,
          dataBytes
        );
        
        // Combine IV and encrypted data
        const result = new Uint8Array(iv.length + encrypted.byteLength);
        result.set(iv);
        result.set(new Uint8Array(encrypted), iv.length);
        
        // Convert to base64url
        return this.bytesToBase64url(result);
      } catch (webCryptoError) {
        // Fallback to CryptoJS if Web Crypto API fails
        console.warn("Web Crypto encryption failed, falling back to CryptoJS", webCryptoError);
        
        // Use CryptoJS for encryption
        const encrypted = CryptoJS.AES.encrypt(
          typeof data === 'string' ? data : this.bytesToStr(dataBytes),
          password
        ).toString();
        
        return encrypted;
      }
    } catch (error) {
      console.error("Encryption error:", error);
      throw new Error("Failed to encrypt data: " + error.message);
    }
  },
  
  /**
   * Decrypt data using AES-GCM with WebCrypto or AES with CryptoJS
   * @param {string} encryptedData - Base64url encoded encrypted data
   * @param {string} password - Password for decryption
   * @returns {Promise<string>} - Decrypted string
   */
  async decrypt(encryptedData, password) {
    try {
      // Try to decrypt with Web Crypto first
      try {
        // Convert from base64url
        const encryptedBytes = this.base64urlToBytes(encryptedData);
        
        // Extract IV (first 12 bytes)
        const iv = encryptedBytes.slice(0, 12);
        
        // Extract ciphertext
        const ciphertext = encryptedBytes.slice(12);
        
        // Generate key from password
        const keyBytes = await this.keyFromPassword(password);
        
        // Import as CryptoKey
        const key = await window.crypto.subtle.importKey(
          'raw',
          keyBytes,
          { name: 'AES-GCM' },
          false,
          ['decrypt']
        );
        
        // Decrypt
        const decrypted = await window.crypto.subtle.decrypt(
          {
            name: 'AES-GCM',
            iv
          },
          key,
          ciphertext
        );
        
        // Convert to string
        return this.bytesToStr(new Uint8Array(decrypted));
      } catch (webCryptoError) {
        // If that fails, try CryptoJS
        console.warn("Web Crypto decryption failed, trying CryptoJS", webCryptoError);
        
        // Use CryptoJS for decryption
        const decryptedBytes = CryptoJS.AES.decrypt(encryptedData, password);
        const decryptedText = decryptedBytes.toString(CryptoJS.enc.Utf8);
        
        if (!decryptedText) {
          throw new Error("Decryption produced empty result");
        }
        
        return decryptedText;
      }
    } catch (error) {
      console.error("Decryption error:", error);
      throw new Error("Failed to decrypt data: " + error.message);
    }
  }
};

/**
 * Compact data serialization for NFC tags
 * @param {string} ownerToken - Owner token for encryption
 * @param {Array} readers - Array of reader objects
 * @returns {Promise<Object>} - Encrypted compact object ready for tag
 */
export async function encryptTagData(ownerToken, readers) {
  // Create compact data structure with short property names
  const tagData = {
    o: ownerToken, // owner token
    r: readers.map(reader => ({ 
      i: reader.id,    // reader id
      t: reader.token  // reader token
    })),
    ts: Date.now() // timestamp
  };
  
  // Compact JSON representation
  const jsonStr = JSON.stringify(tagData);
  
  // Optional compression step could be added here
  // const compressedStr = LZString.compressToUTF16(jsonStr);
  
  // Encrypt with our compact crypto
  const encryptedData = await CompactCrypto.encrypt(jsonStr, ownerToken);
  
  // Create very compact wrapper structure
  return {
    v: "1", // version
    d: encryptedData // encrypted data
  };
}

/**
 * Decrypt compact tag data
 * @param {Object} encryptedObj - The encrypted compact object from tag
 * @param {string} token - Token for decryption
 * @returns {Promise<Object>} - Decrypted tag data
 */
export async function decryptTagData(encryptedObj, token) {
  // Validate input
  if (!encryptedObj || !encryptedObj.d || !encryptedObj.v) {
    throw new Error("Invalid encrypted data format");
  }
  
  try {
    // Decrypt data
    const decryptedJson = await CompactCrypto.decrypt(encryptedObj.d, token);
    
    // Optional decompression step if compression was used
    // const decompressedJson = LZString.decompressFromUTF16(decryptedJson);
    
    // Parse JSON
    const tagData = JSON.parse(decryptedJson);
    
    // Convert from compact format to standard format
    return {
      owner: {
        id: "owner",
        token: tagData.o
      },
      readers: tagData.r.map(reader => ({
        id: reader.i,
        token: reader.t
      })),
      timestamp: tagData.ts
    };
  } catch (error) {
    throw new Error("Failed to decrypt tag data: " + error.message);
  }
}

/**
 * Legacy format compatibility - convert from CryptoJS format
 * @param {Object} legacyData - Legacy tag data in old format
 * @param {string} token - Token for decryption
 * @returns {Promise<Object>} - Decrypted standard format data
 */
export async function decryptLegacyData(legacyData, token) {
  if (legacyData.type === "encrypted_nfc_multi_user" && legacyData.data) {
    try {
      // Decrypt with CryptoJS (legacy format)
      const decryptedBytes = CryptoJS.AES.decrypt(legacyData.data, token);
      const decryptedText = decryptedBytes.toString(CryptoJS.enc.Utf8);
      
      if (!decryptedText) {
        throw new Error("Decryption failed - incorrect token");
      }
      
      // Parse the decrypted data
      return JSON.parse(decryptedText);
    } catch (error) {
      throw new Error("Failed to decrypt legacy tag data: " + error.message);
    }
  } else {
    throw new Error("Unrecognized legacy format");
  }
}
