/// <reference lib="dom" />

import type {
  Database,
  Params,
  SqlResult,
  TurboSqliteModule,
} from "./TurboSqliteTypes";
import { createBlobSqliteWorker } from "./sqlite-wasm-helpers/createBlobSqliteWorker";
import {
  sqlite3Worker1Promiser,
  type Worker1Promiser,
} from "./sqlite-wasm-helpers/sqlite3Worker1Promiser";

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

type OpenArgs = {
  filename: string;
  vfs?: string;
};

const SYNC_API_ERROR =
  "Synchronous TurboSqlite APIs are not available on web. Use the *Async APIs instead.";
const WEB_SQLCIPHER_ERROR =
  "SQLCipher is not supported by the web TurboSqlite backend.";

function getWebOpfsErrorMessage(): string {
  const fileSystemFileHandlePrototype =
    typeof globalThis.FileSystemFileHandle === "function"
      ? (globalThis.FileSystemFileHandle.prototype as {
          createSyncAccessHandle?: unknown;
        })
      : null;

  if (!globalThis.crossOriginIsolated) {
    return [
      "This app can't open a persistent database in this browser session because the page is not cross-origin isolated.",
      "If you control the site setup, enable the response headers `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`.",
    ].join(" ");
  }

  if (typeof navigator?.storage?.getDirectory !== "function") {
    return [
      "This browser can't open a persistent database because it does not support the required Origin Private File System APIs.",
      "Use a browser with OPFS support.",
    ].join(" ");
  }

  if (
    typeof globalThis.FileSystemFileHandle !== "function" ||
    typeof fileSystemFileHandlePrototype?.createSyncAccessHandle !== "function"
  ) {
    return [
      "This browser can't open a persistent database because it does not support OPFS sync access handles.",
      "Use a browser with full OPFS support.",
    ].join(" ");
  }

  return [
    "This app can't open a persistent database because the browser storage backend could not be initialized.",
    "If persistence should work here, verify that COOP/COEP headers are enabled and that the current browser fully supports OPFS sync access handles.",
  ].join(" ");
}

let promiserPromise: Promise<Worker1Promiser> | null = null;
let configPromise: Promise<ConfigGetResult> | null = null;

async function createWorkerPromiser(): Promise<Worker1Promiser> {
  return sqlite3Worker1Promiser({
    worker: createBlobSqliteWorker,
  });
}

function unsupportedSyncApi(methodName: string): never {
  throw new Error(`${methodName}: ${SYNC_API_ERROR}`);
}

function toWorkerError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === "string") {
    return new Error(error);
  }

  if (error && typeof error === "object") {
    const candidate = error as {
      message?: unknown;
      result?: {
        message?: unknown;
      };
    };
    const message =
      typeof candidate.result?.message === "string"
        ? candidate.result.message
        : typeof candidate.message === "string"
          ? candidate.message
          : null;

    if (message) {
      return new Error(message);
    }

    try {
      return new Error(JSON.stringify(error));
    } catch {
      return new Error("Unknown sqlite-wasm worker error");
    }
  }

  return new Error(String(error));
}

async function callPromiser<T>(
  promiser: Worker1Promiser,
  typeOrMessage:
    | string
    | { type: string; dbId?: string; args: Record<string, unknown> },
  args?: Record<string, unknown>
): Promise<T> {
  try {
    return args === undefined
      ? ((await promiser(
          typeOrMessage as {
            type: string;
            dbId?: string;
            args: Record<string, unknown>;
          }
        )) as T)
      : ((await promiser(typeOrMessage as string, args)) as T);
  } catch (error) {
    throw toWorkerError(error);
  }
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
    const response = (await callPromiser<{ result?: ConfigGetResult }>(
      promiser,
      "config-get",
      {}
    )) as {
      result?: ConfigGetResult;
    };

    return response.result ?? {};
  })();

  const config = await configPromise;
  if (!config.vfsList?.includes("opfs")) {
    throw new Error(getWebOpfsErrorMessage());
  }
}

function isSpecialWebFilename(path: string): boolean {
  const normalizedPath = path.replace(/\\/g, "/");

  return (
    normalizedPath === "" ||
    normalizedPath === ":memory:" ||
    normalizedPath.startsWith("file::memory:")
  );
}

function getFileUriVfs(path: string): string | null {
  const match = /(?:^|[?&])vfs=([^&]+)/.exec(path);
  return typeof match?.[1] === "string" ? decodeURIComponent(match[1]) : null;
}

function getFileUriMode(path: string): string | null {
  const match = /(?:^|[?&])mode=([^&]+)/.exec(path);
  return typeof match?.[1] === "string" ? decodeURIComponent(match[1]) : null;
}

function encodePlainWebFilename(path: string): string {
  return path
    .split("/")
    .map((segment) => (segment === "" ? "" : encodeURIComponent(segment)))
    .join("/");
}

function toWebOpenArgs(path: string): OpenArgs {
  if (typeof path !== "string") {
    throw new Error("Web database path must be a string");
  }

  const normalizedPath = path.replace(/\\/g, "/");
  if (isSpecialWebFilename(normalizedPath)) {
    return { filename: normalizedPath };
  }

  if (normalizedPath.trim() === "") {
    throw new Error("Web database path must be a non-empty string");
  }

  if (normalizedPath.startsWith("file:")) {
    const vfs = getFileUriVfs(normalizedPath);
    const mode = getFileUriMode(normalizedPath);

    return {
      filename: normalizedPath,
      vfs: vfs ?? (mode === "memory" ? undefined : "opfs"),
    };
  }

  return {
    filename: `file:${encodePlainWebFilename(normalizedPath)}`,
    vfs: "opfs",
  };
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
  let state: "open" | "closing" | "closed" = "open";
  let closePromise: Promise<void> | null = null;

  const ensureOpen = () => {
    if (state !== "open") {
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

      const execArgs = {
        sql,
        bind: normalizeParams(params),
        rowMode: "object",
        returnValue: "resultRows",
        resultRows: [],
        countChanges: true,
        lastInsertRowId: true,
      } as any;

      const response = (await callPromiser<{ result?: WorkerExecResult }>(
        promiser,
        {
          type: "exec",
          dbId,
          args: execArgs,
        }
      )) as { result?: WorkerExecResult };

      return {
        rows: response.result?.resultRows ?? [],
        rowsAffected: toNumber(response.result?.changeCount),
        insertId: toNumber(response.result?.lastInsertRowId),
      };
    },
    close: () => unsupportedSyncApi("Database.close"),
    closeAsync: async (): Promise<void> => {
      if (state === "closed") {
        return;
      }

      if (state === "closing") {
        await closePromise;
        return;
      }

      state = "closing";
      closePromise = callPromiser<void>(promiser, {
        type: "close",
        dbId,
        args: {},
      });

      try {
        await closePromise;
        state = "closed";
      } catch (error) {
        state = "open";
        closePromise = null;
        throw error;
      }
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
    const openArgs = toWebOpenArgs(path);
    const needsOpfs = openArgs.vfs === "opfs";

    if (needsOpfs) {
      await assertOpfsAvailable(promiser);
    }

    const response = (await callPromiser<{ result?: OpenResult }>(
      promiser,
      "open",
      openArgs
    )) as { result?: OpenResult };

    if (!response.result?.dbId) {
      throw new Error("Failed to open web database");
    }

    if (needsOpfs && !response.result.persistent) {
      await callPromiser<void>(promiser, {
        type: "close",
        dbId: response.result.dbId,
        args: {},
      });
      throw new Error(getWebOpfsErrorMessage());
    }

    return createWebDatabase(promiser, response.result.dbId);
  },

  getVersionString(): string {
    return unsupportedSyncApi("TurboSqlite.getVersionString");
  },
};

export default TurboSqlite;
