# NFC Multi-User Tag App

## Overview

The NFC Multi-User Tag App is a web application that allows you to create and manage encrypted NFC tags with multi-user access control. The app uses the Web NFC API to read and write to NFC tags directly from your browser, using owner and reader-specific tokens to control access to the encrypted data.

## Key Features

- **Owner-Key Encryption**: Use the owner's token as the encryption key for secure data storage
- **Multi-User Access Control**: Define multiple readers with different access levels
- **Role-Based Permissions**: Owners can modify tags, readers have limited view access
- **Encrypted Contacts Storage**: Save reader information securely on your device
- **Progressive Web App**: Works offline and can be installed on your device

## User Flow

### Creating a New Tag

1. **Generate Owner Token**
   - Enter a custom token or generate a random one
   - This token will be required for full access to the tag

2. **Add Readers**
   - Define who can access this tag with restricted permissions
   - Each reader gets their own unique token
   - Optionally load saved readers from your encrypted contacts

3. **Write to NFC Tag**
   - Tap an NFC tag to your device
   - The app will warn you if the tag already contains data
   - Confirm to write the encrypted data to the tag

### Accessing an Existing Tag

1. **Scan the Tag**
   - The app automatically detects encrypted tags
   - You'll be prompted to enter your access token

2. **Enter Your Token**
   - Provide either an owner or reader token
   - The app will decrypt the data using your token

3. **Access Based on Role**
   - **Owner Access**: View all information and manage readers
   - **Reader Access**: View only information relevant to your reader ID

### Managing an Existing Tag (Owners Only)

1. **View Tag Information**
   - See all reader tokens
   - Manage the tag's permissions

2. **Add or Remove Readers**
   - Grant access to new readers
   - Revoke access from existing readers

3. **Save Changes**
   - Write updated information back to the tag
   - Previous data is securely overwritten

### Managing Contacts

1. **Unlock Contact Database**
   - Enter your owner token to decrypt saved contacts
   - The contacts are stored securely on your device

2. **Manage Reader Contacts**
   - Add or remove reader information
   - Use saved readers when creating new tags

## Security Model

- **Unique Encryption Keys**: Each tag uses the owner token as its encryption key
- **No Plaintext Sensitive Data**: All sensitive information is encrypted on the tag
- **Client-Side Security**: Encryption and decryption happen locally on your device
- **No Server Dependency**: Works completely offline with local encrypted storage

## Technical Requirements

- **Device Requirements**:
  - NFC-compatible smartphone or tablet
  - Modern browser supporting Web NFC API (Chrome for Android 89+)
  - JavaScript enabled

- **Permissions**:
  - NFC permission (requested when first using the app)
  - Local storage permission for saving contacts

## Privacy Considerations

- No data is transmitted to any server
- All encryption and decryption happens locally on your device
- Tokens are never stored unencrypted
- Contact data is encrypted before being saved to local storage