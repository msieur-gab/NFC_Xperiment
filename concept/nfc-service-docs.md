# NFC-Accessible Encrypted Data Service

## Overview
A secure service that allows users to access different types of encrypted personal data through NFC tags. The service encrypts sensitive information and makes it accessible via unique URLs that can be embedded in NFC tags.

## Purpose
- Provide secure access to personal information through NFC scanning
- Support different types of data (e.g., resume, health data) with appropriate display templates
- Ensure data security through encryption
- Make sensitive information easily accessible in case of emergencies

## Supported Data Types

### Resume (CV)
- Personal and professional information
- Work experience
- Skills
- Professional achievements

### Health Data
- Emergency contact information
- Blood type
- Allergies
- Current medications
- Critical health information

## Technical Architecture

### Data Storage & Encryption
- Data is stored in encrypted `.eva` files
- Each file contains:
  ```json
  {
    "hash": "12-character-hash",
    "data": "encrypted-data-string",
    "salt": "encryption-salt",
    "iv": "initialization-vector"
  }
  ```
- AES encryption with salt and initialization vector
- Unique hash for each data file
- Files are accessed through the hash only

### Data Creation Process
1. User inputs data through web interface
2. Data is structured based on type (CV/Health)
3. System generates a unique hash
4. Data is encrypted with AES encryption
5. Encrypted file is generated with `.eva` extension
6. Hash URL is provided for NFC tag programming

### Data Access Process
1. User scans NFC tag containing URL
2. System extracts hash from URL
3. Locates corresponding encrypted file
4. Decrypts data using stored key
5. Determines data type from decrypted content
6. Renders appropriate template

## Security Features

### Encryption
- AES-256 encryption
- Unique salt and IV for each file
- Server-side decryption
- Key never exposed to client

### Access Control
- Hash-based access
- No direct file access
- Rate limiting options
- HTTPS required

## Deployment Options

### Standard Web Server
- PHP-based implementation
- Apache/Nginx configuration
- `.htaccess` for additional security
- Environment variables for key storage

### Cloudflare Implementation
- Serverless architecture using Workers
- R2 storage for encrypted files
- Workers KV for key management
- Edge computing benefits
- Built-in DDoS protection

## Usage Example

1. Create Encrypted Data:
   ```javascript
   // Input data through web interface
   const data = {
     type: 'cv',
     content: {
       name: 'John Doe',
       title: 'Software Engineer',
       // ...other fields
     }
   };
   // System encrypts and generates hash
   ```

2. Access Data:
   - URL Format: `https://service.com/[hash]`
   - Example: `https://service.com/4f1650cc2f3e`

## Security Considerations

### Key Management
- Secure key storage in server environment
- Regular key rotation
- Different keys for different data types (optional)

### Access Patterns
- Rate limiting implementation
- IP-based restrictions (optional)
- Access logging
- Anomaly detection

### Data Protection
- No unencrypted storage
- Secure key transmission
- Server-side decryption only
- Data validation

## Implementation Requirements

### Server-Side
- PHP 7.4+ or Cloudflare Workers
- OpenSSL support
- Secure environment variables
- Proper file permissions

### Client-Side
- Modern web browser
- JavaScript enabled
- NFC capability (for tag scanning)

## Future Enhancements
- Additional data types
- Multi-factor authentication
- Expiring links
- Emergency access protocols
- Audit logging
- Backup and recovery procedures

## Monitoring and Maintenance
- Access logs analysis
- Key rotation schedule
- Security updates
- Performance monitoring
- Error tracking

## Emergency Procedures
- Key compromise protocol
- Data recovery process
- Emergency contact procedures
- Incident response plan