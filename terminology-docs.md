# Murmur: Temporal Vault System Terminology

*Murmur: A soft, gentle sound of voices or whispers - echoes traveling across time*

## Core Concepts

| Term | Definition |
|------|------------|
| **Capsule** | Main container of time-related information, replacing the concept of "thread" |
| **Artifact** | Individual element placed on the timeline (image, text, audio recording, etc.) |
| **Reader** | User authorized to access content |
| **Author** | Creator of a capsule or artifact |
| **Timeline** | Temporal axis on which artifacts are positioned |
| **Timestamp** | Time marker associated with each artifact |
| **MediaType** | Content type categorization (Image, Audio, Text) |
| **Vault** | Encrypted storage containing all capsules |
| **Guardian** | Primary administrator/owner with full access rights |
| **Token** | Cryptographic access key |

## Artifact Types

| Type | Description |
|------|-------------|
| **Snapshot** | Image-based artifact |
| **Memoir** | Text-based artifact |
| **Echo** | Audio recording artifact |

## Data Structure Recommendations

```javascript
// Example Dexie.js schema
const db = new Dexie('temporalVault');
db.version(1).stores({
  capsules: '++id, guardianId, createdAt, lastModified',
  artifacts: '++id, capsuleId, authorId, timestamp, mediaType',
  readers: '++id, tokenHash',
  accessRights: '[capsuleId+readerId], capsuleId, readerId'
});
```

## Typical Operations

- **Seal Capsule**: Create and encrypt a new temporal capsule
- **Archive Artifact**: Add a new artifact to a capsule
- **Grant Access**: Authorize a reader to access a capsule
- **Traverse Timeline**: Navigate through artifacts chronologically
- **Unlock Vault**: Authenticate using NFC token to access content

## Security Considerations

- All artifacts are encrypted with capsule-specific keys
- Reader access is managed through asymmetric cryptography
- NFC tokens contain encrypted reader credentials
- Timeline metadata is encrypted to prevent information leakage
- Media content has separate encryption from metadata

## About the Name

"Murmur" comes from Latin "murmur" meaning a low, continuous sound. The name was chosen for this application because it evokes:

- The intimate and gentle nature of personal memories
- The subtle persistence of moments traveling through time
- The soft echo of past experiences reaching the present
- The quiet but meaningful preservation of personal history

The name reflects the application's core purpose: creating a secure temporal vault where memories and moments quietly persist, allowing the past to murmur its stories to the future.

## Synchronization Protocol

For synchronizing with remote MySQL database:
- Use incremental sync with last modified timestamps
- Implement conflict resolution for simultaneous edits
- Maintain local encrypted cache for offline access
- Queue updates when offline for later synchronization
