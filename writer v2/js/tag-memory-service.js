// tag-memory-service.js - Handles tag type detection and memory calculations
import eventBus from './event-bus.js';

class TagMemoryService {
    constructor() {
        // Common NFC tag types and their typical capacities (in bytes)
        this.tagTypes = {
            'TYPE1': 96,      // Type 1 tags (Topaz)
            'TYPE2': 144,     // Type 2 tags (MIFARE Ultralight)
            'TYPE3': 4096,    // Type 3 tags (FeliCa)
            'TYPE4': 32768,   // Type 4 tags (MIFARE DESFire)
            'TYPE5': 512,     // Type 5 tags (ISO 15693)
            'MIFARE_CLASSIC': 716, // MIFARE Classic 1K
            'NTAG213': 144,   // NTAG213
            'NTAG215': 504,   // NTAG215
            'NTAG216': 888    // NTAG216
        };
    }

    init() {
        // Add tag type selector to advanced settings
        this.addTagTypeSelector();
        
        eventBus.publish('log', { message: 'Tag memory service initialized', type: 'info' });
        
        // Set up event listeners
        document.addEventListener('click', event => {
            if (event.target && event.target.id === 'apply-tag-type-btn') {
                this.applyManualTagType();
            }
        });
    }

    // Function to estimate tag memory capacity and usage with improved tag detection
    estimateTagMemory(message) {
        // Default to a conservative estimate if we can't determine the type
        let estimatedCapacity = 504; // Default to NTAG215 size as middle ground
        let tagTypeGuess = 'NTAG215'; // More likely to be this common type
        
        // Check for manual tag type override
        const manualTagType = localStorage.getItem('manual_tag_type');
        if (manualTagType) {
            if (manualTagType === 'ntag213') {
                tagTypeGuess = 'NTAG213';
                estimatedCapacity = 144;
                eventBus.publish('log', { message: 'Using manually selected tag type: NTAG213', type: 'info' });
            } else if (manualTagType === 'ntag215') {
                tagTypeGuess = 'NTAG215';
                estimatedCapacity = 504;
                eventBus.publish('log', { message: 'Using manually selected tag type: NTAG215', type: 'info' });
            } else if (manualTagType === 'ntag216') {
                tagTypeGuess = 'NTAG216';
                estimatedCapacity = 888;
                eventBus.publish('log', { message: 'Using manually selected tag type: NTAG216', type: 'info' });
            } else if (manualTagType === 'mifare_ultralight') {
                tagTypeGuess = 'TYPE2';
                estimatedCapacity = 144;
                eventBus.publish('log', { message: 'Using manually selected tag type: MIFARE Ultralight', type: 'info' });
            } else if (manualTagType === 'mifare_classic') {
                tagTypeGuess = 'MIFARE_CLASSIC';
                estimatedCapacity = 716;
                eventBus.publish('log', { message: 'Using manually selected tag type: MIFARE Classic', type: 'info' });
            }
        } else {
            // Try to determine tag type from serial number or other properties
            if (message.serialNumber) {
                const serialHex = message.serialNumber.toLowerCase();
                eventBus.publish('log', { message: `Tag serial number: ${serialHex}`, type: 'info' });
                
                // NTAG detection based on serial number patterns
                if (serialHex.startsWith('04')) {
                    // Most NXP NTAG start with 04
                    
                    // Try to determine specific NTAG type from serial number
                    // NTAG213/215/216 typically have 7-byte UIDs (14 hex chars)
                    if (serialHex.length === 14) {
                        // Check for specific manufacturer bytes that might indicate type
                        const manuBytes = serialHex.substring(2, 6);
                        
                        if (manuBytes === '0102') {
                            tagTypeGuess = 'NTAG216';
                            estimatedCapacity = 888;
                        } else if (manuBytes === '0103') {
                            tagTypeGuess = 'NTAG215';
                            estimatedCapacity = 504;
                        } else if (manuBytes === '0104') {
                            tagTypeGuess = 'NTAG213';
                            estimatedCapacity = 144;
                        } else {
                            // If we can't determine exactly, try to guess from the data size
                            
                            // If the tag already has data, we can make a better guess based on usage
                            if (message.records && message.records.length > 0) {
                                // Calculate current data size
                                let totalSize = 0;
                                for (const record of message.records) {
                                    try {
                                        if (record.data) {
                                            if (record.data instanceof ArrayBuffer) {
                                                totalSize += record.data.byteLength;
                                            } else {
                                                const blob = new Blob([record.data]);
                                                totalSize += blob.size;
                                            }
                                        }
                                    } catch (e) {
                                        // Ignore errors in size calculation
                                    }
                                }
                                
                                // If data size is large, it's probably a larger tag
                                if (totalSize > 400) {
                                    tagTypeGuess = 'NTAG216';
                                    estimatedCapacity = 888;
                                } else if (totalSize > 120) {
                                    tagTypeGuess = 'NTAG215';
                                    estimatedCapacity = 504;
                                } else {
                                    tagTypeGuess = 'NTAG213';
                                    estimatedCapacity = 144;
                                }
                            }
                        }
                    } else if (serialHex.length === 16) {
                        // Likely a MIFARE Ultralight or NTAG21x with 8-byte UID
                        tagTypeGuess = 'NTAG216';
                        estimatedCapacity = 888; // Assume larger capacity to be safe
                    }
                } else if (serialHex.startsWith('08')) {
                    // Likely a MIFARE Classic
                    tagTypeGuess = 'MIFARE_CLASSIC';
                    estimatedCapacity = 716;
                }
                
                // Add manual override for testing specific tags from URL params
                // This helps when you know exactly what tag you're using
                const urlParams = new URLSearchParams(window.location.search);
                const tagTypeParam = urlParams.get('tagtype');
                if (tagTypeParam) {
                    if (tagTypeParam === 'ntag213') {
                        tagTypeGuess = 'NTAG213';
                        estimatedCapacity = 144;
                    } else if (tagTypeParam === 'ntag215') {
                        tagTypeGuess = 'NTAG215';
                        estimatedCapacity = 504;
                    } else if (tagTypeParam === 'ntag216') {
                        tagTypeGuess = 'NTAG216';
                        estimatedCapacity = 888;
                    }
                }
            }
        }
        
        // Calculate current usage
        let currentUsage = 0;
        if (message.records) {
            for (const record of message.records) {
                try {
                    // Calculate size of this record
                    // NDEF overhead: ~6-8 bytes per record
                    const recordOverhead = 8;
                    
                    // Data size
                    let dataSize = 0;
                    if (record.data) {
                        if (record.data instanceof ArrayBuffer) {
                            dataSize = record.data.byteLength;
                        } else {
                            // Try to estimate size for other data types
                            const blob = new Blob([record.data]);
                            dataSize = blob.size;
                        }
                    }
                    
                    // Add type length if present
                    let typeSize = 0;
                    if (record.recordType) {
                        typeSize = record.recordType.length;
                    }
                    
                    // Total for this record
                    const recordSize = recordOverhead + dataSize + typeSize;
                    currentUsage += recordSize;
                    
                    eventBus.publish('log', { 
                        message: `Record size: ${recordSize} bytes (${record.recordType || 'unknown type'})`,
                        type: 'info' 
                    });
                    
                } catch (e) {
                    eventBus.publish('log', { message: `Error calculating record size: ${e}`, type: 'warning' });
                }
            }
        }
        
        // Add NDEF message overhead (approximately 10-16 bytes)
        currentUsage += 16;
        
        // Calculate remaining space
        const remainingSpace = Math.max(0, estimatedCapacity - currentUsage);
        const usagePercentage = Math.min(100, Math.round((currentUsage / estimatedCapacity) * 100));
        
        eventBus.publish('log', { 
            message: `Tag type: ${tagTypeGuess}, Capacity: ${estimatedCapacity} bytes, Used: ${currentUsage} bytes (${usagePercentage}%)`, 
            type: 'info' 
        });
        
        return {
            tagType: tagTypeGuess,
            estimatedCapacity,
            currentUsage,
            remainingSpace,
            usagePercentage,
            isManuallySet: !!manualTagType
        };
    }

    // Add a manual tag type selector to the UI
    addTagTypeSelector() {
        // Create the selector HTML
        const selectorHTML = `
            <div class="tag-type-selector">
                <h4>Manual Tag Type Selection</h4>
                <p>If your tag type is incorrectly detected, select it manually:</p>
                <select id="manual-tag-type">
                    <option value="">Auto-detect (default)</option>
                    <option value="ntag213">NTAG213 (144 bytes)</option>
                    <option value="ntag215">NTAG215 (504 bytes)</option>
                    <option value="ntag216">NTAG216 (888 bytes)</option>
                    <option value="mifare_ultralight">MIFARE Ultralight (144 bytes)</option>
                    <option value="mifare_classic">MIFARE Classic (716 bytes)</option>
                </select>
                <button id="apply-tag-type-btn">Apply</button>
            </div>
        `;
        
        // Add to UI in advanced settings tab after content is loaded
        document.addEventListener('DOMContentLoaded', () => {
            const advancedTab = document.getElementById('advanced-tab');
            if (advancedTab) {
                const settingsCard = advancedTab.querySelector('.card');
                if (settingsCard) {
                    const div = document.createElement('div');
                    div.className = 'form-group';
                    div.innerHTML = selectorHTML;
                    settingsCard.appendChild(div);
                    
                    // Set initial selection
                    const savedType = localStorage.getItem('manual_tag_type');
                    if (savedType) {
                        document.getElementById('manual-tag-type').value = savedType;
                    }
                }
            }
        });
    }

    // Apply the manually selected tag type
    applyManualTagType() {
        const selector = document.getElementById('manual-tag-type');
        if (selector) {
            const selectedType = selector.value;
            
            if (selectedType) {
                // Store in localStorage for persistence
                localStorage.setItem('manual_tag_type', selectedType);
                eventBus.publish('log', { message: `Manual tag type set to: ${selectedType}`, type: 'info' });
                
                // Update status display
                eventBus.publish('showStatus', { 
                    message: `Tag type manually set to: ${selectedType.toUpperCase()}` 
                });
            } else {
                // Clear manual override
                localStorage.removeItem('manual_tag_type');
                eventBus.publish('log', { message: 'Manual tag type selection cleared', type: 'info' });
                
                // Update status display
                eventBus.publish('showStatus', { message: 'Tag type detection set to automatic' });
            }
            
            // Publish event to refresh memory info display if needed
            eventBus.publish('tagTypeChanged', {});
        }
    }
}

// Create and export a singleton instance
const tagMemoryService = new TagMemoryService();
export default tagMemoryService;
