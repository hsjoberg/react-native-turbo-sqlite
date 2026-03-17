# react-native-turbo-sqlite

A Pure C++ TurboModule for Sqlite.

### Platform support:

```
✅ Android
✅ iOS
✅ macOS
🚫 Windows (planned)
🚫 Linux (maybe)
🚫 Web (maybe)
✅ Jest mocks (uses sql.js)
```

## Installation

This lib requires [new architecture](https://reactnative.dev/docs/the-new-architecture/landing-page)
enabled in your app. It will not work on the old architecture and there are no plans to support it.

```sh
yarn add react-native-turbo-sqlite
```

## Usage

```js
import TurboSqlite from "react-native-turbo-sqlite";
import { DocumentDirectoryPath } from "@dr.pogodin/react-native-fs";

// Open the database
const db = TurboSqlite.openDatabase(
  DocumentDirectoryPath + "/test.db"
);

// Create a table
const createTableResult = db.executeSql(
  "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, age INTEGER)",
  []
);
console.log("Create table result:", createTableResult);

// Insert some data
const insertResult = db.executeSql(
    "INSERT INTO users (name, age) VALUES (?, ?)",
    ["Alice", 30]
);
console.log("Insert result:", insertResult);

// Select data
const selectResult = db.executeSql("SELECT * FROM users", []);
console.log("Select result:", selectResult);
```

## Encryption Support (SQLCipher)

This library supports database encryption via [SQLCipher](https://www.zetetic.net/sqlcipher/). Encryption is **opt-in** and configured at build time.

### Enabling SQLCipher

Add the following configuration to your app's `package.json`:

```json
{
  "react-native-turbo-sqlite": {
    "sqlcipher": true
  }
}
```

**For monorepos:** Add the configuration to the root `package.json` of your monorepo.

After adding the configuration:

1. **iOS/macOS**: Run `pod install` in the `ios` directory
2. **Android**: Add OpenSSL dependency and rebuild (see Android setup below)

### Using Encrypted Databases

Once SQLCipher is enabled, pass an encryption key when opening a database:

```js
import TurboSqlite from "react-native-turbo-sqlite";
import { DocumentDirectoryPath } from "@dr.pogodin/react-native-fs";

// Open an encrypted database
const db = TurboSqlite.openDatabase(
  DocumentDirectoryPath + "/encrypted.db",
  "my-secret-encryption-key"
);

// Use the database normally
db.executeSql("CREATE TABLE IF NOT EXISTS secrets (id INTEGER PRIMARY KEY, data TEXT)", []);
```

### Important Notes

- **Without the encryption key**, SQLCipher databases cannot be opened
- **Changing the key** requires re-encrypting the entire database
- **Standard SQLite** databases can still be opened without providing a key
- **Key storage**: Store your encryption keys securely (e.g., using [react-native-keychain](https://github.com/oblador/react-native-keychain))

### Security Considerations

- Never hardcode encryption keys in your source code
- Use platform-specific secure storage for keys (Keychain on iOS, Keystore on Android)
- Consider using user-derived keys (e.g., from a password or biometric authentication)
- The encryption key is passed as a string and can be any length (recommended: 32+ characters)

### Platform-Specific Setup

#### iOS/macOS

No additional setup required. Uses CommonCrypto (via Security.framework) which is built-in.

**Note:** For macOS, remember to set `ENV['RCT_NEW_ARCH_ENABLED'] = '1'` in your `Podfile`.

#### Android

SQLCipher on Android requires OpenSSL. Add the following to your app's `android/app/build.gradle`:

```gradle
android {
    buildFeatures {
        prefab true
    }
}

dependencies {
    // Add OpenSSL dependency for SQLCipher
    implementation 'io.github.ronickg:openssl:3.3.3'
}
```

**Notes:**
- The OpenSSL version 3.3.3 is recommended (matches SQLCipher's requirements)
- Prefab is Android's modern system for native dependencies
- This will add ~6-7 MB to your APK (all architectures) or ~2-3 MB per architecture with APK splits

#### App Size Impact

- **Android**: ~6-7 MB (all architectures) or ~2-3 MB per architecture with APK splits
- **iOS/macOS**: ~1-2 MB per architecture

### Disabling Encryption

To switch back to standard SQLite:

1. Remove the configuration from `package.json`
2. Run `pod install` (iOS/macOS) or rebuild (Android)

## Why yet another sqlite lib?

Current sqlite libs for react-native such as op-sqlite and react-native-quick-sqlite do not support
out-of-tree platforms like react-native-windows and react-native-macos. Instead of working within
those libs I decided to write my own C++ TurboModule that has 100% code-sharing for all platforms.

Any other or future out-of-tree platform should easily be supported as long as it supports new
architecture. Let me know if you have any target that you wish should be supported.

## Contributing

See the [contributing guide](CONTRIBUTING.md) to learn how to contribute to the repository and the development workflow.

## License

MIT

---

Made with [create-react-native-library](https://github.com/callstack/react-native-builder-bob)
