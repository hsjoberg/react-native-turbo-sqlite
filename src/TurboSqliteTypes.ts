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

/**
 * A database object.
 *
 * This object is returned by the `openDatabase` function.
 * Can be used to execute SQL statements on the database.
 */
export interface Database {
  /**
   * Executes an SQL statement synchronously.
   *
   * This is the supported API on native platforms. Web callers must use
   * `executeSqlAsync()`.
   *
   * @param sql The SQL statement to execute.
   * @param params An array of parameters to bind to the SQL statement.
   * @returns A SqlResult object.
   */
  executeSql: (sql: string, params: Params) => SqlResult;

  /**
   * Executes an SQL statement asynchronously.
   *
   * @param sql The SQL statement to execute.
   * @param params An array of parameters to bind to the SQL statement.
   * @returns A promise resolving to a SqlResult object.
   */
  executeSqlAsync: (sql: string, params: Params) => Promise<SqlResult>;

  /**
   * Closes the database synchronously.
   */
  close: () => void;

  /**
   * Closes the database asynchronously.
   */
  closeAsync: () => Promise<void>;
}

export interface TurboSqliteModule {
  /**
   * Opens a database synchronously.
   *
   * This is the supported API on native platforms. Web callers must use
   * `openDatabaseAsync()`.
   *
   * @param path The path to the database file.
   * @param encryptionKey Optional encryption key for SQLCipher. Only works if the library is built with SQLCipher support enabled.
   * @returns A Database object.
   */
  openDatabase(path: string, encryptionKey?: string): Database;

  /**
   * Opens a database asynchronously.
   *
   * @param path The path to the database file.
   * @param encryptionKey Optional encryption key for SQLCipher. Only works if the library is built with SQLCipher support enabled.
   * @returns A promise resolving to a Database object.
   */
  openDatabaseAsync(path: string, encryptionKey?: string): Promise<Database>;

  /**
   * Returns the version of the SQLite library in use synchronously.
   */
  getVersionString(): string;
}
