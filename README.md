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
🚫 Jest mocks
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
