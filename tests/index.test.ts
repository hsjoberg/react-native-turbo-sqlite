import TurboSqlite, { mockReady } from "../src/mocks";

describe("TurboSqlite mock", () => {
  beforeAll(async () => {
    await mockReady;
  });

  test("test", () => {
    const database = TurboSqlite.openDatabase("");

    database.executeSql(
      "CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)",
      []
    );
    const insertResult = database.executeSql(
      "INSERT INTO test (name) VALUES (?)",
      ["Test Name"]
    );
    const result = database.executeSql("SELECT * FROM test", []);

    expect(result.rows.length).toBe(1);
    const firstRow = result.rows[0];
    expect(firstRow).toBeDefined();
    expect(firstRow?.name).toBe("Test Name");
    expect(insertResult.rowsAffected).toBe(1);
    expect(insertResult.insertId).toBe(1);

    database.close();
  });

  test("async mock API", async () => {
    const database = await TurboSqlite.openDatabaseAsync("");

    await database.executeSqlAsync(
      "CREATE TABLE test_async (id INTEGER PRIMARY KEY, name TEXT)",
      []
    );
    await database.executeSqlAsync("INSERT INTO test_async (name) VALUES (?)", [
      "Async Name",
    ]);
    const result = await database.executeSqlAsync(
      "SELECT * FROM test_async",
      []
    );

    expect(result.rows.length).toBe(1);
    expect(result.rows[0]?.name).toBe("Async Name");

    await database.closeAsync();
  });
});
