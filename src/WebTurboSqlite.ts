/// <reference lib="dom" />

import type {
  Database,
  Params,
  SqlResult,
  TurboSqliteModule,
} from "./TurboSqliteTypes";
import type { Worker1Promiser } from "@sqlite.org/sqlite-wasm";

type ConfigGetResult = {
  version?: {
    libVersion?: string;
  };
  vfsList?: string[];
};

type OpenResult = {
  dbId: string;
  persistent: boolean;
};

const SYNC_API_ERROR =
  "Synchronous TurboSqlite APIs are not available on web. Use the *Async APIs instead.";
const WEB_SQLCIPHER_ERROR =
  "SQLCipher is not supported by the web TurboSqlite backend.";
const WEB_OPFS_ERROR =
  "TurboSqlite web persistence requires OPFS support. Use TurboSqlite mocks for non-persistent web tests.";

let promiserPromise: Promise<Worker1Promiser> | null = null;
let configPromise: Promise<ConfigGetResult> | null = null;

async function createWorkerPromiser(): Promise<Worker1Promiser> {
  const module = await import("@sqlite.org/sqlite-wasm");

  // The ESM export is already the promise-returning worker factory at runtime,
  // but the published typings still describe the older synchronous shape.
  const promiserFactory =
    module.sqlite3Worker1Promiser as unknown as () => Promise<Worker1Promiser>;
  return promiserFactory();
}

function unsupportedSyncApi(methodName: string): never {
  throw new Error(`${methodName}: ${SYNC_API_ERROR}`);
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

async function getPromiser(): Promise<Worker1Promiser> {
  promiserPromise ??= createWorkerPromiser();
  return promiserPromise;
}

async function assertOpfsAvailable(promiser: Worker1Promiser): Promise<void> {
  configPromise ??= (async () => {
    const response = (await promiser("config-get", {})) as {
      result?: ConfigGetResult;
    };

    return response.result ?? {};
  })();

  const config = await configPromise;
  if (!config.vfsList?.includes("opfs")) {
    throw new Error(WEB_OPFS_ERROR);
  }
}

function toWebFilename(path: string): string {
  if (typeof path !== "string" || path.trim() === "") {
    throw new Error("Web database path must be a non-empty string");
  }

  const normalizedPath = path.replace(/\\/g, "/");
  if (normalizedPath.startsWith("file:")) {
    return normalizedPath.includes("vfs=")
      ? normalizedPath
      : `${normalizedPath}${normalizedPath.includes("?") ? "&" : "?"}vfs=opfs`;
  }

  return `file:${normalizedPath}?vfs=opfs`;
}

function toNumber(value: number | bigint | undefined): number {
  if (typeof value === "bigint") {
    return Number(value);
  }

  return typeof value === "number" ? value : 0;
}

type WorkerExecResult = {
  resultRows?: Array<Record<string, unknown>>;
  changeCount?: number | bigint;
  lastInsertRowId?: number | bigint;
};

function createWebDatabase(promiser: Worker1Promiser, dbId: string): Database {
  let isClosed = false;

  const ensureOpen = () => {
    if (isClosed) {
      throw new Error("Database is closed");
    }
  };

  const database: Database = {
    executeSql: () => unsupportedSyncApi("Database.executeSql"),
    executeSqlAsync: async (
      sql: string,
      params: Params
    ): Promise<SqlResult> => {
      ensureOpen();

      if (typeof sql !== "string" || !Array.isArray(params)) {
        throw new Error("Invalid arguments for executeSqlAsync");
      }

      // The worker runtime supports countChanges/lastInsertRowId, but the
      // current package typings do not expose those fields on Worker1ExecArgs.
      const execArgs = {
        sql,
        bind: normalizeParams(params),
        rowMode: "object",
        returnValue: "resultRows",
        resultRows: [],
        countChanges: true,
        lastInsertRowId: true,
      } as any;

      const response = (await promiser({
        type: "exec",
        dbId,
        args: execArgs,
      })) as { result?: WorkerExecResult };

      return {
        rows: response.result?.resultRows ?? [],
        rowsAffected: toNumber(response.result?.changeCount),
        insertId: toNumber(response.result?.lastInsertRowId),
      };
    },
    close: () => unsupportedSyncApi("Database.close"),
    closeAsync: async (): Promise<void> => {
      if (isClosed) {
        return;
      }

      await promiser({ type: "close", dbId, args: {} });
      isClosed = true;
    },
  };

  return database;
}

const TurboSqlite: TurboSqliteModule = {
  openDatabase(): Database {
    return unsupportedSyncApi("TurboSqlite.openDatabase");
  },

  async openDatabaseAsync(
    path: string,
    encryptionKey?: string
  ): Promise<Database> {
    if (encryptionKey) {
      throw new Error(`TurboSqlite.openDatabaseAsync: ${WEB_SQLCIPHER_ERROR}`);
    }

    const promiser = await getPromiser();
    await assertOpfsAvailable(promiser);
    const response = (await promiser("open", {
      filename: toWebFilename(path),
    })) as { result?: OpenResult };

    if (!response.result?.dbId) {
      throw new Error("Failed to open web database");
    }

    if (!response.result.persistent) {
      await promiser({
        type: "close",
        dbId: response.result.dbId,
        args: {},
      });
      throw new Error(WEB_OPFS_ERROR);
    }

    return createWebDatabase(promiser, response.result.dbId);
  },

  getVersionString(): string {
    return unsupportedSyncApi("TurboSqlite.getVersionString");
  },
};

export default TurboSqlite;
