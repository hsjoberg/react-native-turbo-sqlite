const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const { promisify } = require("util");

const execAsync = promisify(exec);
const iosBundleId = "org.reactjs.native.example.TurboSqliteExample";
const androidAppId = "com.turbosqliteexample";
const databaseDirectoryName = "test";

// Helper to assert boolean values (workaround for Detox overriding expect)
function assertTrue(value, message) {
  if (!value) {
    throw new Error(message || "Assertion failed: expected true");
  }
}

function assertFalse(value, message) {
  if (value) {
    throw new Error(message || "Assertion failed: expected false");
  }
}

/**
 * Helper function to get the booted iOS simulator device ID
 */
async function getBootedIOSDeviceId() {
  const { stdout: bootedDevice } = await execAsync(
    `xcrun simctl list devices booted | grep -o '[A-F0-9]\\{8\\}-[A-F0-9]\\{4\\}-[A-F0-9]\\{4\\}-[A-F0-9]\\{4\\}-[A-F0-9]\\{12\\}' | head -1`
  );
  const deviceId = bootedDevice.trim();

  if (!deviceId) {
    throw new Error("No booted simulator found");
  }

  return deviceId;
}

/**
 * Helper function to get the app's data container on iOS simulator
 */
async function getIOSDataContainerPath() {
  const deviceId = await getBootedIOSDeviceId();
  const { stdout } = await execAsync(
    `xcrun simctl get_app_container ${deviceId} ${iosBundleId} data`
  );
  const containerPath = stdout.trim();

  if (!containerPath) {
    throw new Error("App data container not found in simulator");
  }

  return containerPath;
}

/**
 * Helper function to find the app's Documents directory on iOS simulator
 */
async function findIOSDocumentsPath(fileName) {
  const dbPath = path.join(
    await getIOSDataContainerPath(),
    "Documents",
    databaseDirectoryName,
    fileName
  );

  if (!fs.existsSync(dbPath)) {
    throw new Error("Database file not found in simulator");
  }

  return dbPath;
}

/**
 * Helper function to find the app's Documents directory on Android emulator
 */
async function findAndroidDocumentsPath(fileName) {
  const dbPath = `/data/data/${androidAppId}/files/${databaseDirectoryName}/${fileName}`;
  const { stdout } = await execAsync(
    `adb shell "run-as ${androidAppId} sh -c \\"if [ -f '${dbPath}' ]; then printf '%s' '${dbPath}'; fi\\""`
  );
  const resolvedPath = stdout.trim();

  if (!resolvedPath) {
    throw new Error("Database file not found in app sandbox");
  }

  return resolvedPath;
}

async function deleteIOSDatabaseArtifacts(fileName) {
  const databaseDirectory = path.join(
    await getIOSDataContainerPath(),
    "Documents",
    databaseDirectoryName
  );

  for (const suffix of [fileName, `${fileName}-wal`, `${fileName}-shm`]) {
    fs.rmSync(path.join(databaseDirectory, suffix), { force: true });
  }
}

async function deleteAndroidDatabaseArtifacts(fileName) {
  const databasePath = `/data/data/${androidAppId}/files/${databaseDirectoryName}/${fileName}`;
  await execAsync(
    `adb shell "run-as ${androidAppId} sh -c \\"rm -f '${databasePath}' '${databasePath}-wal' '${databasePath}-shm'\\""`
  );
}

async function deleteDatabaseArtifacts(fileName) {
  if (device.getPlatform() === "ios") {
    await deleteIOSDatabaseArtifacts(fileName);
  } else {
    await deleteAndroidDatabaseArtifacts(fileName);
  }
}

/**
 * Reads the first 16 bytes of a file to check the SQLite header
 */
async function readDatabaseHeader(filePath) {
  if (device.getPlatform() === "ios") {
    // For iOS simulator, we can read directly
    const buffer = fs.readFileSync(filePath);
    return buffer.slice(0, 16);
  } else {
    // For Android, we need to pull the file first
    const tempPath = path.join(__dirname, "temp_test.db");
    await execAsync(
      `adb shell "run-as com.turbosqliteexample cat '${filePath}'" > "${tempPath}"`
    );
    const buffer = fs.readFileSync(tempPath);
    fs.unlinkSync(tempPath);
    return buffer.slice(0, 16);
  }
}

/**
 * Checks if a database file is unencrypted (standard SQLite)
 */
function isUnencrypted(headerBuffer) {
  const sqliteHeader = "SQLite format 3\0";
  const headerString = headerBuffer.toString("utf8", 0, 16);
  return headerString === sqliteHeader;
}

/**
 * Finds the database path with retry logic
 */
async function findDatabasePathWithRetry(
  fileName,
  maxAttempts = 3,
  delayMs = 500
) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      if (device.getPlatform() === "ios") {
        return await findIOSDocumentsPath(fileName);
      } else {
        return await findAndroidDocumentsPath(fileName);
      }
    } catch (error) {
      if (attempt === maxAttempts - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

describe("SQLite Encryption E2E Tests", () => {
  let dbPath;
  const sqliteFileName = "test-sqlite.db";
  const sqlcipherFileName = "test-sqlcipher.db";

  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      permissions: { notifications: "YES" },
    });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
    await deleteDatabaseArtifacts(sqliteFileName);
    await deleteDatabaseArtifacts(sqlcipherFileName);
  });

  it("should create an unencrypted database when pressing test sqlite button", async () => {
    await waitFor(element(by.id("test-sqlite-button")))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.id("test-sqlite-button")).tap();
    await new Promise((resolve) => setTimeout(resolve, 1500));

    dbPath = await findDatabasePathWithRetry(sqliteFileName);
    const header = await readDatabaseHeader(dbPath);

    assertTrue(
      isUnencrypted(header),
      "Database should be unencrypted (SQLite format 3)"
    );
    console.log("✅ Database is unencrypted (SQLite format 3)");
  });

  it("should create an encrypted database when pressing test sqlcipher button", async () => {
    await waitFor(element(by.id("test-sqlcipher-button")))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.id("test-sqlcipher-button")).tap();
    await new Promise((resolve) => setTimeout(resolve, 1500));

    dbPath = await findDatabasePathWithRetry(sqlcipherFileName);
    const header = await readDatabaseHeader(dbPath);

    assertFalse(
      isUnencrypted(header),
      "Database should be encrypted (not SQLite format 3)"
    );
    console.log("✅ Database is encrypted (random binary data)");
  });

  it("should switch between encrypted and unencrypted databases", async () => {
    await waitFor(element(by.id("test-sqlcipher-button")))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.id("test-sqlcipher-button")).tap();
    await new Promise((resolve) => setTimeout(resolve, 1500));

    dbPath = await findDatabasePathWithRetry(sqlcipherFileName);
    let header = await readDatabaseHeader(dbPath);
    assertFalse(isUnencrypted(header), "Database should be encrypted");
    console.log("✅ Database is encrypted");

    await element(by.id("test-sqlite-button")).tap();
    await new Promise((resolve) => setTimeout(resolve, 1500));
    dbPath = await findDatabasePathWithRetry(sqliteFileName);
    header = await readDatabaseHeader(dbPath);
    assertTrue(isUnencrypted(header), "Database should now be unencrypted");
    console.log("✅ Database is now unencrypted");

    await element(by.id("test-sqlcipher-button")).tap();
    await new Promise((resolve) => setTimeout(resolve, 1500));
    dbPath = await findDatabasePathWithRetry(sqlcipherFileName);
    header = await readDatabaseHeader(dbPath);
    assertFalse(isUnencrypted(header), "Database should be encrypted again");
    console.log("✅ Database is encrypted again");
  });
});
