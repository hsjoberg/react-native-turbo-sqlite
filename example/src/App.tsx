import React from "react";
import {
  Button,
  Platform,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";

import NativeExampleAppPaths from "./turbomodules/NativeExampleAppPaths";
import TurboSqlite, { type Database } from "../../src";

const getDatabasePath = (encrypted: boolean): string => {
  const directory = NativeExampleAppPaths.getDatabaseDirectory();
  const fileName = encrypted ? "test-sqlcipher.db" : "test-sqlite.db";
  return directory ? `${directory}/${fileName}` : fileName;
};

const runCRUDs = (db: Database) => {
  const createTableResult = db.executeSql(
    "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, age INTEGER)",
    []
  );
  console.log("Create table result:", createTableResult);

  const insertResult1 = db.executeSql(
    "INSERT INTO users (name, age) VALUES (?, ?)",
    ["Alice", 30]
  );
  console.log("Insert result 1:", insertResult1);

  const insertResult2 = db.executeSql(
    "INSERT INTO users (name, age) VALUES (?, ?)",
    ["Bob", 25]
  );
  console.log("Insert result 2:", insertResult2);

  const selectResult = db.executeSql("SELECT * FROM users", []);
  console.log("Select result:", selectResult);

  const updateResult = db.executeSql(
    "UPDATE users SET age = ? WHERE name = ?",
    [31, "Alice"]
  );
  console.log("Update result:", updateResult);

  const selectAfterUpdateResult = db.executeSql("SELECT * FROM users", []);
  console.log("Select after update result:", selectAfterUpdateResult);

  const deleteResult = db.executeSql("DELETE FROM users WHERE name = ?", [
    "Bob",
  ]);
  console.log("Delete result:", deleteResult);

  const finalSelectResult = db.executeSql("SELECT * FROM users", []);
  console.log("Final select result:", finalSelectResult);

  const deleteAllResult = db.executeSql("DELETE FROM users", []);
  console.log("Delete all result:", deleteAllResult);

  return {
    selectedRows: selectResult.rows.length,
    updatedRows: selectAfterUpdateResult.rows.length,
    remainingRows: finalSelectResult.rows.length,
    deletedRows: deleteAllResult.rowsAffected,
  };
};

const runCRUDsAsync = async (db: Database) => {
  const createTableResult = await db.executeSqlAsync(
    "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, age INTEGER)",
    []
  );
  console.log("Create table async result:", createTableResult);

  const insertResult1 = await db.executeSqlAsync(
    "INSERT INTO users (name, age) VALUES (?, ?)",
    ["Alice", 30]
  );
  console.log("Insert async result 1:", insertResult1);

  const insertResult2 = await db.executeSqlAsync(
    "INSERT INTO users (name, age) VALUES (?, ?)",
    ["Bob", 25]
  );
  console.log("Insert async result 2:", insertResult2);

  const selectResult = await db.executeSqlAsync("SELECT * FROM users", []);
  console.log("Select async result:", selectResult);

  const updateResult = await db.executeSqlAsync(
    "UPDATE users SET age = ? WHERE name = ?",
    [31, "Alice"]
  );
  console.log("Update async result:", updateResult);

  const selectAfterUpdateResult = await db.executeSqlAsync(
    "SELECT * FROM users",
    []
  );
  console.log("Select after update async result:", selectAfterUpdateResult);

  const deleteResult = await db.executeSqlAsync(
    "DELETE FROM users WHERE name = ?",
    ["Bob"]
  );
  console.log("Delete async result:", deleteResult);

  const finalSelectResult = await db.executeSqlAsync("SELECT * FROM users", []);
  console.log("Final async select result:", finalSelectResult);

  const deleteAllResult = await db.executeSqlAsync("DELETE FROM users", []);
  console.log("Delete all async result:", deleteAllResult);

  return {
    selectedRows: selectResult.rows.length,
    updatedRows: selectAfterUpdateResult.rows.length,
    remainingRows: finalSelectResult.rows.length,
    deletedRows: deleteAllResult.rowsAffected,
  };
};

const testSqliteTurboModule = async (encrypted: boolean) => {
  const dbPath = getDatabasePath(encrypted);
  let db: Database | undefined;

  try {
    if (encrypted) {
      db = TurboSqlite.openDatabase(dbPath, "super-secret-key");
    } else {
      db = TurboSqlite.openDatabase(dbPath);
    }

    const result = runCRUDs(db);

    return `Success (${encrypted ? "sqlcipher" : "sqlite"}) at ${dbPath}
Rows selected: ${result.selectedRows}
Rows after update: ${result.updatedRows}
Rows remaining before cleanup: ${result.remainingRows}
Rows deleted in cleanup: ${result.deletedRows}`;
  } catch (error: any) {
    console.error("SQLite error:", error.message);
    return `Error (${encrypted ? "sqlcipher" : "sqlite"}) at ${dbPath}
${error instanceof Error ? error.message : String(error)}`;
  } finally {
    db?.close();
  }
};

const testSqliteTurboModuleAsync = async (encrypted: boolean) => {
  const dbPath = getDatabasePath(encrypted);
  let db: Database | undefined;

  try {
    if (encrypted) {
      db = await TurboSqlite.openDatabaseAsync(dbPath, "super-secret-key");
    } else {
      db = await TurboSqlite.openDatabaseAsync(dbPath);
    }

    const result = await runCRUDsAsync(db);

    return `Async success (${encrypted ? "sqlcipher" : "sqlite"}) at ${dbPath}
Rows selected: ${result.selectedRows}
Rows after update: ${result.updatedRows}
Rows remaining before cleanup: ${result.remainingRows}
Rows deleted in cleanup: ${result.deletedRows}`;
  } catch (error: any) {
    console.error("SQLite async error:", error.message);
    return `Async error (${encrypted ? "sqlcipher" : "sqlite"}) at ${dbPath}
${error instanceof Error ? error.message : String(error)}`;
  } finally {
    if (db) {
      await db.closeAsync();
    }
  }
};

export default function App(): React.FunctionComponentElement<{}> {
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === "dark";
  const isWeb = Platform.OS === "web";
  const [version, setVersion] = React.useState("Loading TurboSqlite...");
  const [startupError, setStartupError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState(
    "Press a button to test TurboSqlite."
  );
  const textColor = isDarkMode ? "#FFFFFF" : "#000000";
  const backgroundColor = isDarkMode ? "#111111" : "#f5f5f5";

  React.useEffect(() => {
    try {
      if (isWeb) {
        setVersion("TurboSqlite web runtime (async-only)");
      } else {
        setVersion(TurboSqlite.getVersionString());
      }
    } catch (error) {
      setStartupError(
        error instanceof Error ? error.message : "Failed to load TurboSqlite"
      );
    }
  }, [isWeb]);

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <Text style={[styles.title, { color: textColor }]}>TurboSqlite</Text>
      <Text style={[styles.version, { color: textColor }]}>{version}</Text>
      <Text style={[styles.status, { color: textColor }]} selectable>
        {status}
      </Text>
      {startupError ? (
        <Text style={styles.error} selectable>
          {startupError}
        </Text>
      ) : null}
      {!isWeb ? (
        <Button
          title="test sqlite"
          onPress={() => {
            setStatus("Running sqlite test...");
            testSqliteTurboModule(false).then(setStatus);
          }}
          testID="test-sqlite-button"
        />
      ) : null}
      {!isWeb ? (
        <Button
          title="test sqlcipher"
          onPress={() => {
            setStatus("Running sqlcipher test...");
            testSqliteTurboModule(true).then(setStatus);
          }}
          testID="test-sqlcipher-button"
        />
      ) : null}
      <Button
        title="test sqlite async"
        onPress={() => {
          setStatus("Running sqlite async test...");
          testSqliteTurboModuleAsync(false).then(setStatus);
        }}
        testID="test-sqlite-async-button"
      />
      {!isWeb ? (
        <Button
          title="test sqlcipher async"
          onPress={() => {
            setStatus("Running sqlcipher async test...");
            testSqliteTurboModuleAsync(true).then(setStatus);
          }}
          testID="test-sqlcipher-async-button"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
  },
  title: { fontSize: 24, fontWeight: "600" },
  version: {},
  status: { textAlign: "center" },
  error: { color: "#b00020", textAlign: "center" },
});
