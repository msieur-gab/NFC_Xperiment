# NFC Multi-User Tag App

## Overview
A modular web application for managing NFC tags with multiple users and advanced encryption.

## Features
- NFC tag reading, writing, and updating
- Encrypted tag data
- Multiple user management
- Debug panel
- Advanced settings

## Prerequisites
- Modern web browser with Web NFC support (Chrome for Android recommended)
- Local web server (due to module imports)

## Setup
1. Clone the repository
2. Use a local web server to serve the files
   - Recommended: Use Python's simple server
     ```
     python3 -m http.server
     ```
   - Or use VS Code Live Server extension
   - Or use `npx http-server`

## External Dependencies
- CryptoJS (4.1.1)
- LocalForage (1.10.0)

## Browser Compatibility
- Web NFC is currently supported only in Chrome for Android
- Requires a secure context (HTTPS or localhost)

## Deployment
- Host on a secure HTTPS server
- Ensure proper CORS settings if using a remote server

## Troubleshooting
- Enable debug mode for detailed logs
- Check browser console for additional information
- Ensure NFC permissions are granted

## Contributing
1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a pull request

## License
[Your License Here]

## Contact
[Your Contact Information]
