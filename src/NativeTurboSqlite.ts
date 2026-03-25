import type { TurboModule } from "react-native";
import { TurboModuleRegistry } from "react-native";
import type { UnsafeObject } from "react-native/Libraries/Types/CodegenTypes";
import type { Database, TurboSqliteModule } from "./TurboSqliteTypes";

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
   * Opens a database asynchronously.
   *
   * @param path The path to the database file.
   * @param encryptionKey Optional encryption key for SQLCipher. Only works if the library is built with SQLCipher support enabled.
   * @returns An opaque HostObject-backed database value.
   */
  openDatabaseAsync(
    path: string,
    encryptionKey?: string
  ): Promise<UnsafeObject>;

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

  openDatabaseAsync(path: string, encryptionKey?: string): Promise<Database> {
    return NativeTurboSqlite.openDatabaseAsync(
      path,
      encryptionKey
    ) as Promise<Database>;
  },

  getVersionString(): string {
    return NativeTurboSqlite.getVersionString();
  },
};

export default TurboSqlite;
