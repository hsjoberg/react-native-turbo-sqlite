import type { TurboModule } from "react-native";
import { TurboModuleRegistry } from "react-native";
import type { UnsafeObject } from "react-native/Libraries/Types/CodegenTypes";

/**
 * A database object.
 *
 * This object is returned by the `openDatabase` function.
 * Can be used to execute SQL statements on the database.
 */
export interface Database {
  /**
   * Executes an SQL statement.
   *
   * @param sql The SQL statement to execute.
   * @param params An array of parameters to bind to the SQL statement.
   * @returns A SqlResult object.
   */
  executeSql: (sql: string, params: Params) => SqlResult;

  /**
   * Closes the database.
   */
  close: () => void;
}

/**
 * An array of parameters to bind to the SQL statement.
 */
export type Params = Array<string | number | null | undefined | boolean>;

/**
 * The result of an SQL statement.
 *
 * Contains the rows returned by the statement, the number of rows affected,
 * and the ID of the last inserted row.
 */
export interface SqlResult {
  /**
   * An array of rows returned by the SQL statement.
   */
  rows: Array<{ [key: string]: any }>;

  /**
   * The number of rows affected by the SQL statement.
   */
  rowsAffected: number;

  /**
   * The ID of the last inserted row.
   */
  insertId: number;
}

export interface TurboSqliteModule {
  /**
   * Opens a database.
   * If the directory does not exist, it will be created.
   *
   * @param path The path to the database file.
   * @param encryptionKey Optional encryption key for SQLCipher. Only works if the library is built with SQLCipher support enabled.
   * @returns A Database object.
   */
  openDatabase(path: string, encryptionKey?: string): Database;

  /**
   * Returns the version of the SQLite library in use.
   */
  getVersionString(): string;
}

export interface Spec extends TurboModule {
  /**
   * Opens a database.
   * If the directory does not exist, it will be created.
   *
   * @param path The path to the database file.
   * @param encryptionKey Optional encryption key for SQLCipher. Only works if the library is built with SQLCipher support enabled.
   * @returns An opaque HostObject-backed database value.
   */
  openDatabase(path: string, encryptionKey?: string): UnsafeObject;

  /**
   * Returns the version of the SQLite library in use.
   */
  getVersionString(): string;
}

const NativeTurboSqlite =
  TurboModuleRegistry.getEnforcing<Spec>("TurboSqliteCxx");

const TurboSqlite: TurboSqliteModule = {
  openDatabase(path: string, encryptionKey?: string): Database {
    return NativeTurboSqlite.openDatabase(path, encryptionKey) as Database;
  },

  getVersionString(): string {
    return NativeTurboSqlite.getVersionString();
  },
};

export default TurboSqlite;
