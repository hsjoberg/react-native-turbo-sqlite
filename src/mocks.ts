import type { Params, Spec } from "./NativeTurboSqlite";

import initSqlJs from "sql.js";
import type {
  Database as SqlJsDatabase,
  QueryExecResult,
  SqlJsStatic,
} from "sql.js";

let sqlJs: SqlJsStatic | null = null;
const databases = new Map<string, Uint8Array>();

export const mockReady: Promise<void> = initSqlJs().then((SQL) => {
  sqlJs = SQL;
});

function ensureSqlJs(): SqlJsStatic {
  if (!sqlJs) {
    throw new Error("SQL.js is not initialized yet.");
  }
  return sqlJs;
}

function normalizeParams(params: Params): Array<string | number | null> {
  return params.map((param) => {
    if (typeof param === "string") {
      return param;
    }
    if (typeof param === "number") {
      return param;
    }
    if (typeof param === "boolean") {
      throw new Error("Unsupported parameter type boolean. Convert to number");
    }
    if (param === null || param === undefined) {
      return null;
    }
    if (typeof param === "bigint") {
      throw new Error("Unsupported parameter type BigInt");
    }
    if (typeof param === "symbol") {
      throw new Error("Unsupported parameter type Symbol");
    }
    if (typeof param === "object") {
      throw new Error("Unsupported parameter type Object");
    }
    throw new Error("Unsupported parameter type");
  });
}

function getInsertId(db: SqlJsDatabase): number {
  const insertIdResult = db.exec("SELECT last_insert_rowid() AS insertId");
  const value = insertIdResult[0]?.values[0]?.[0];
  return typeof value === "number" ? value : Number(value ?? 0);
}

function mapRows(
  result: QueryExecResult | undefined
): Array<Record<string, unknown>> {
  if (!result) {
    return [];
  }

  return result.values.map((rawRow) => {
    const row: Record<string, unknown> = {};
    for (let i = 0; i < result.columns.length; i += 1) {
      const value = rawRow[i];
      if (value instanceof Uint8Array) {
        throw new Error("Unsupported column type SQLITE_BLOB");
      }
      row[result.columns[i] as string] = value;
    }
    return row;
  });
}

const TurboSqlite: Spec = {
  getVersionString: () => {
    const SQL = ensureSqlJs();
    const versionDb = new SQL.Database();
    try {
      const result = versionDb.exec("SELECT sqlite_version() AS version");
      const version = result[0]?.values[0]?.[0];
      return typeof version === "string" ? version : String(version ?? "");
    } finally {
      versionDb.close();
    }
  },
  openDatabase: (path: string) => {
    const SQL = ensureSqlJs();
    const key = path ?? "";
    const existingData = databases.get(key);
    const db = existingData
      ? new SQL.Database(existingData)
      : new SQL.Database();
    let isClosed = false;

    return {
      executeSql: (sqlStatement: string, params: Params) => {
        if (isClosed) {
          throw new Error("Database is closed");
        }

        if (typeof sqlStatement !== "string" || !Array.isArray(params)) {
          throw new Error("Invalid arguments for executeSql");
        }

        const queryResults = db.exec(sqlStatement, normalizeParams(params));
        return {
          rows: mapRows(queryResults[0]),
          rowsAffected: db.getRowsModified(),
          insertId: getInsertId(db),
        };
      },
      close: () => {
        if (!isClosed) {
          databases.set(key, db.export());
          db.close();
          isClosed = true;
        }
      },
    };
  },
};

export default TurboSqlite;
