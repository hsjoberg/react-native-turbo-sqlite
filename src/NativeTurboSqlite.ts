import type { TurboModule } from "react-native";
import { TurboModuleRegistry } from "react-native";

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

export interface Spec extends TurboModule {
  /**
   * Opens a database.
   * If the directory does not exist, it will be created.
   *
   * @param path The path to the database file.
   * @returns A Database object.
   */
  openDatabase(path: string): Database;

  /**
   * Returns the version of the SQLite library in use.
   */
  getVersionString(): string;
}

export default TurboModuleRegistry.getEnforcing<Spec>("TurboSqliteCxx");
