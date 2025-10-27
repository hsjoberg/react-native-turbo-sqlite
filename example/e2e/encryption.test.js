const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");
const { promisify } = require("util");

const execAsync = promisify(exec);

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
 * Helper function to find the app's Documents directory on iOS simulator
 */
async function findIOSDocumentsPath() {
  // Get the booted device's UDID
  const { stdout: bootedDevice } = await execAsync(
    `xcrun simctl list devices booted | grep -o '[A-F0-9]\\{8\\}-[A-F0-9]\\{4\\}-[A-F0-9]\\{4\\}-[A-F0-9]\\{4\\}-[A-F0-9]\\{12\\}' | head -1`
  );
  const deviceId = bootedDevice.trim();

  if (!deviceId) {
    throw new Error("No booted simulator found");
  }

  // Find the database file in the booted device
  const { stdout } = await execAsync(
    `find ~/Library/Developer/CoreSimulator/Devices/${deviceId}/data/Containers/Data/Application -name "test.db" 2>/dev/null | head -1`
  );
  const dbPath = stdout.trim();

  if (!dbPath) {
    throw new Error("Database file not found in simulator");
  }

  return dbPath;
}

/**
 * Helper function to find the app's Documents directory on Android emulator
 */
async function findAndroidDocumentsPath() {
  const { stdout } = await execAsync(
    `adb shell "run-as com.turbosqliteexample find /data/data/com.turbosqliteexample/files -name 'test.db' 2>/dev/null | head -n 1"`
  );
  return stdout.trim();
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
async function findDatabasePathWithRetry(maxAttempts = 3, delayMs = 500) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      if (device.getPlatform() === "ios") {
        return await findIOSDocumentsPath();
      } else {
        return await findAndroidDocumentsPath();
      }
    } catch (error) {
      if (attempt === maxAttempts - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

describe("SQLite Encryption E2E Tests", () => {
  let dbPath;

  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      permissions: { notifications: "YES" },
    });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it("should create an unencrypted database when pressing test sqlite button", async () => {
    await waitFor(element(by.id("test-sqlite-button")))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.id("test-sqlite-button")).tap();
    await new Promise((resolve) => setTimeout(resolve, 1500));

    dbPath = await findDatabasePathWithRetry();
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

    dbPath = await findDatabasePathWithRetry();
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

    dbPath = await findDatabasePathWithRetry();
    let header = await readDatabaseHeader(dbPath);
    assertFalse(isUnencrypted(header), "Database should be encrypted");
    console.log("✅ Database is encrypted");

    await element(by.id("test-sqlite-button")).tap();
    await new Promise((resolve) => setTimeout(resolve, 1500));
    header = await readDatabaseHeader(dbPath);
    assertTrue(isUnencrypted(header), "Database should now be unencrypted");
    console.log("✅ Database is now unencrypted");

    await element(by.id("test-sqlcipher-button")).tap();
    await new Promise((resolve) => setTimeout(resolve, 1500));
    header = await readDatabaseHeader(dbPath);
    assertFalse(isUnencrypted(header), "Database should be encrypted again");
    console.log("✅ Database is encrypted again");
  });
});
