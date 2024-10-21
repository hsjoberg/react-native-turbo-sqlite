jest.mock("react-native-turbo-sqlite", () => require("../src/mocks"));

const TurboSqlite = require("react-native-turbo-sqlite").default;

describe("TurboSqlite mock", () => {
  beforeAll((done) => {
    // Wait for sql.js to initialize
    setTimeout(done, 1000);
  });

  test("test", () => {
    const database = TurboSqlite.openDatabase("");

    database.executeSql(
      "CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)",
      []
    );
    database.executeSql("INSERT INTO test (name) VALUES (?)", ["Test Name"]);
    const result = database.executeSql("SELECT * FROM test", []);

    expect(result.rows.length).toBe(1);
    expect(result.rows[0][1]).toBe("Test Name");

    database.close();
  });
});
