import { useMemo, useState } from "react";

import TurboSqlite, {
  type Database,
  type SqlResult,
} from "react-native-turbo-sqlite";

type LogEntry = {
  level: "info" | "error";
  message: string;
};

const DB_NAME = "turbo-sqlite-example-web.db";

function formatResult(label: string, result: SqlResult): string {
  return `${label}: ${JSON.stringify(result, null, 2)}`;
}

export default function App() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [database, setDatabase] = useState<Database | null>(null);

  const logStyles = useMemo(
    () => ({
      info: { color: "#dbeafe" },
      error: { color: "#fecaca" },
    }),
    []
  );

  const appendLog = (level: LogEntry["level"], message: string) => {
    setLogs((currentLogs) => [...currentLogs, { level, message }]);
  };

  const handleOpen = async () => {
    try {
      const db = await TurboSqlite.openDatabaseAsync(DB_NAME);
      setDatabase(db);
      appendLog("info", `Opened ${DB_NAME}`);
    } catch (error) {
      appendLog("error", String(error));
    }
  };

  const handleDemo = async () => {
    if (!database) {
      appendLog("error", "Open the database first.");
      return;
    }

    try {
      await database.executeSqlAsync(
        "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, age INTEGER)",
        []
      );

      const insertResult = await database.executeSqlAsync(
        "INSERT INTO users (name, age) VALUES (?, ?)",
        ["Alice", 30]
      );
      appendLog("info", formatResult("Insert", insertResult));

      const selectResult = await database.executeSqlAsync(
        "SELECT * FROM users ORDER BY id DESC",
        []
      );
      appendLog("info", formatResult("Select", selectResult));
    } catch (error) {
      appendLog("error", String(error));
    }
  };

  const handleClose = async () => {
    if (!database) {
      return;
    }

    try {
      await database.closeAsync();
      setDatabase(null);
      appendLog("info", "Closed database");
    } catch (error) {
      appendLog("error", String(error));
    }
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, #243b53, #102a43 45%, #08131f 100%)",
        color: "#f8fafc",
        fontFamily:
          '"IBM Plex Sans", ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        <h1 style={{ fontSize: 32, marginBottom: 8 }}>
          TurboSqlite Web Example
        </h1>
        <p style={{ maxWidth: 720, color: "#cbd5e1", lineHeight: 1.5 }}>
          This example uses the async web runtime backed by
          `@sqlite.org/sqlite-wasm` in a worker with OPFS persistence.
        </p>

        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 12,
            marginTop: 24,
            marginBottom: 24,
          }}
        >
          <button onClick={handleOpen} disabled={database !== null}>
            Open database
          </button>
          <button onClick={handleDemo} disabled={database === null}>
            Run demo queries
          </button>
          <button onClick={handleClose} disabled={database === null}>
            Close database
          </button>
          <button onClick={() => setLogs([])}>Clear logs</button>
        </div>

        <pre
          style={{
            minHeight: 320,
            padding: 16,
            borderRadius: 16,
            border: "1px solid rgba(148, 163, 184, 0.25)",
            backgroundColor: "rgba(15, 23, 42, 0.7)",
            overflow: "auto",
            whiteSpace: "pre-wrap",
          }}
        >
          {logs.length === 0
            ? "No logs yet."
            : logs.map((entry, index) => (
                <div
                  key={`${entry.level}-${index}`}
                  style={logStyles[entry.level]}
                >
                  {entry.message}
                </div>
              ))}
        </pre>
      </div>
    </main>
  );
}
