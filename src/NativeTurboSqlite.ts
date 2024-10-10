import type { TurboModule } from "react-native";
import { TurboModuleRegistry } from "react-native";

export interface SqlResult {
  rows: Array<{ [key: string]: any }>;
  rowsAffected: number;
  insertId?: number;
}

export interface Spec extends TurboModule {
  getVersionString(): string;

  openDatabase(name: string): boolean;

  executeSql(sql: string, params: Array<string | number | null>): SqlResult;
}

export default TurboModuleRegistry.getEnforcing<Spec>("TurboSqliteCxx");
