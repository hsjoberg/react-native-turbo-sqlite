import React from "react";
import { StyleSheet, View, Text, Button, useColorScheme } from "react-native";

import TurboSqlite, { type Database } from "../../src/NativeTurboSqlite";

import {
  DocumentDirectoryPath,
  unlink,
  exists,
} from "@dr.pogodin/react-native-fs";

let dbIsEncrypted = false;

const runCRUDs = async (db: Database) => {
  try {
    // Create a table
    const createTableResult = db.executeSql(
      "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, age INTEGER)",
      []
    );
    console.log("Create table result:", createTableResult);

    // Insert some data
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

    // Select data
    const selectResult = db.executeSql("SELECT * FROM users", []);
    console.log("Select result:", selectResult);

    // Display the selected data
    console.log("Users:");
    selectResult.rows.forEach((row) => {
      console.log(`ID: ${row.id}, Name: ${row.name}, Age: ${row.age}`);
    });

    // Update data
    const updateResult = db.executeSql(
      "UPDATE users SET age = ? WHERE name = ?",
      [31, "Alice"]
    );
    console.log("Update result:", updateResult);

    // Select data again to verify update
    const selectAfterUpdateResult = db.executeSql("SELECT * FROM users", []);
    console.log("Select after update result:", selectAfterUpdateResult);

    // Delete data
    const deleteResult = db.executeSql("DELETE FROM users WHERE name = ?", [
      "Bob",
    ]);
    console.log("Delete result:", deleteResult);

    // Final select to show remaining data
    const finalSelectResult = db.executeSql("SELECT * FROM users", []);
    console.log("Final select result:", finalSelectResult);

    // Delete all data
    const deleteAllResult = db.executeSql("DELETE FROM users", []);
    console.log("Delete all result:", deleteAllResult);

    db.close();
  } catch (error: any) {
    console.error("SQLite error:", error.message);
  }
};

const testSqliteTurboModule = async (encrypted: boolean) => {
  try {
    const dbPath = DocumentDirectoryPath + "/test/test.db";
    const newDBIsDifferent =
      (encrypted && !dbIsEncrypted) || (!encrypted && dbIsEncrypted);

    // Delete existing database file to start fresh
    if (newDBIsDifferent && (await exists(dbPath))) {
      console.log("🚨 Deleting db, as we are changing encryption");
      await unlink(dbPath);
      dbIsEncrypted = encrypted;
    }

    let db: Database;

    if (encrypted) {
      db = TurboSqlite.openDatabase(dbPath, "super-secret-key");
    } else {
      db = TurboSqlite.openDatabase(dbPath);
    }

    runCRUDs(db);

    db.close();
  } catch (error: any) {
    console.error("SQLite error:", error.message);
  }
};

export default function App(): React.FunctionComponentElement<{}> {
  const colorScheme = useColorScheme();
  const isDarkMode = colorScheme === "dark";
  return (
    <View style={styles.container}>
      <Text style={{ color: isDarkMode ? "#FFFFFF" : "#000000" }}>
        {TurboSqlite.getVersionString()}
      </Text>
      <Button
        title="test sqlite"
        onPress={() => testSqliteTurboModule(false)}
        testID="test-sqlite-button"
      />
      <Button
        title="test sqlcipher"
        onPress={() => testSqliteTurboModule(true)}
        testID="test-sqlcipher-button"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
