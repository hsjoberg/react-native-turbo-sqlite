const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const projectRoot = path.resolve(__dirname, "..");
const packageJson = require(path.resolve(projectRoot, "package.json"));
const cppDir = path.resolve(projectRoot, "cpp");
const standardBuildDir = path.resolve(cppDir, "build");
const standardAndroidDir = path.resolve(cppDir, "android");
const windowsLibraryName =
  packageJson["react-native-windows"]?.["init-windows"]?.name ??
  "ReactNativeTurboSqlite";
const windowsJsiOutputDir = path.resolve(
  projectRoot,
  "cpp",
  "windows-jsi"
);
const codegenSrcDir = path.resolve(
  projectRoot,
  packageJson.codegenConfig?.jsSrcsDir ?? "src"
);
const windowsOnly = process.argv.includes("--windows-jsi-only");
const standardOnly = process.argv.includes("--standard-only");
const reactNativeCliBin = require.resolve(
  "@react-native-community/cli/build/bin.js"
);
const reactNativeWindowsCodegenBin = require.resolve(
  "@react-native-windows/codegen/bin.js"
);

function runNodeScript(scriptPath, args, cwd = projectRoot) {
  execFileSync(process.execPath, [scriptPath, ...args], {
    cwd,
    stdio: "inherit",
  });
}

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return walk(fullPath);
    }

    return [fullPath];
  });
}

function getWindowsSpecFiles() {
  return walk(codegenSrcDir)
    .filter((filePath) => /\.(ts|tsx)$/.test(filePath))
    .filter((filePath) => {
      const parsed = path.parse(filePath);

      return parsed.name.startsWith("Native") && !parsed.name.includes(".");
    })
    .map((filePath) => path.relative(projectRoot, filePath));
}

function runStandardCodegen() {
  fs.rmSync(standardBuildDir, { recursive: true, force: true });

  console.log("Running @react-native-community/cli codegen...");
  runNodeScript(reactNativeCliBin, [
    "codegen",
    "--platform",
    "android",
    "--path",
    ".",
    "--outputPath",
    "./cpp/",
  ]);

  const sourcePath = path.resolve(standardAndroidDir, "app", "build");

  fs.cpSync(sourcePath, standardBuildDir, { recursive: true, force: true });
  fs.rmSync(standardAndroidDir, { recursive: true, force: true });

  console.log("Standard codegen generated successfully");
}

function runWindowsJsiCodegen() {
  const specFiles = getWindowsSpecFiles();

  if (specFiles.length === 0) {
    throw new Error(`No Native*.ts/tsx files found in ${codegenSrcDir}`);
  }

  fs.rmSync(windowsJsiOutputDir, { recursive: true, force: true });

  console.log("Running react-native-windows-codegen for C++ JSI...");
  const args = [
    "--libraryName",
    windowsLibraryName,
    "--outputDirectory",
    path.relative(projectRoot, windowsJsiOutputDir),
    "--modulesCxx",
  ];

  if (specFiles.length === 1) {
    args.push("--file", specFiles[0]);
  } else {
    args.push("--files", ...specFiles);
  }

  runNodeScript(reactNativeWindowsCodegenBin, args);

  console.log("Windows JSI codegen generated successfully");
}

if (!windowsOnly) {
  runStandardCodegen();
}

if (!standardOnly) {
  runWindowsJsiCodegen();
}

console.log("Codegen finished successfully");
