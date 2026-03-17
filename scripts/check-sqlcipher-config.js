#!/usr/bin/env node

/**
 * Checks if SQLCipher is enabled in the app's package.json configuration.
 * Searches up the directory tree for package.json with react-native-turbo-sqlite config.
 * Supports monorepo setups.
 *
 * Usage: node check-sqlcipher-config.js
 * Outputs: "1" if SQLCipher enabled, "0" if disabled
 */

const fs = require("fs");
const path = require("path");

function findConfig(dir) {
  if (dir === "/" || dir === ".") {
    return false;
  }

  const packageJsonPath = path.join(dir, "package.json");

  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
      const config = packageJson?.["react-native-turbo-sqlite"]?.sqlcipher;

      if (config !== undefined) {
        return config === true;
      }
    } catch (error) {
      // Invalid JSON or read error, continue searching
    }
  }

  return findConfig(path.dirname(dir));
}

// Start search from current working directory (where the build is happening)
// This works for both direct app builds and monorepo setups
const startDir = process.cwd();
const useSqlcipher = findConfig(startDir);

// Output 1 for true, 0 for false (easier for CMake to consume)
console.log(useSqlcipher ? "1" : "0");
process.exit(0);
