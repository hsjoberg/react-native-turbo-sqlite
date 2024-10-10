# react-native-turbo-sqlite

Pure C++ TurboModule for Sqlite

### Platform support:

```
✅ Android
✅ iOS
✅ macOS
🚫 Windows (planned)
🚫 Web (maybe)
🚫 Jest mocks
```

## Installation

```sh
npm install react-native-turbo-sqlite
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

// Insert some data
const insertResult1 = db.executeSql(
    "INSERT INTO users (name, age) VALUES (?, ?)",
    ["Alice", 30]
);
console.log("Insert result:", insertResult1);

// Select data
const selectResult = db.executeSql("SELECT * FROM users", []);
console.log("Select result:", selectResult);
```


## Contributing

See the [contributing guide](CONTRIBUTING.md) to learn how to contribute to the repository and the development workflow.

## License

MIT

---

Made with [create-react-native-library](https://github.com/callstack/react-native-builder-bob)
