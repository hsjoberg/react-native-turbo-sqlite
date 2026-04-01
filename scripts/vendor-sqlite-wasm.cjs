const fs = require("fs");
const path = require("path");

// Copies sqlite-wasm dist assets into src/vendor/sqlite-wasm and applies the
// small compatibility patches required by this package's browser and Metro
// worker bootstraps.

const rootDir = path.resolve(__dirname, "..");
const defaultSourceDir = path.resolve(
  rootDir,
  "node_modules",
  "@sqlite.org",
  "sqlite-wasm",
  "dist"
);
const sourceDir = path.resolve(process.argv[2] || defaultSourceDir);
const targetDir = path.resolve(rootDir, "src", "vendor", "sqlite-wasm");

function assertExists(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required file: ${filePath}`);
  }
}

function readUtf8(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function writeUtf8(filePath, content) {
  fs.writeFileSync(filePath, content, "utf8");
}

function copyFile(fromPath, toPath) {
  assertExists(fromPath);
  fs.copyFileSync(fromPath, toPath);
}

function replaceExact(content, find, replace, fileLabel) {
  if (!content.includes(find)) {
    throw new Error(`Patch target not found in ${fileLabel}:\n${find}`);
  }

  return content.replace(find, replace);
}

function removeExact(content, find, fileLabel) {
  if (!content.includes(find)) {
    throw new Error(`Patch target not found in ${fileLabel}:\n${find}`);
  }

  return content.replace(find, "");
}

function writeBase64Module(filePath, exportName, sourcePath) {
  const base64 = fs.readFileSync(sourcePath).toString("base64");
  writeUtf8(
    filePath,
    `const ${exportName} = "${base64}";\n\nexport default ${exportName};\n`
  );
}

function patchIndexMjs() {
  const filePath = path.join(targetDir, "index.mjs");
  let content = readUtf8(filePath);

  content = replaceExact(
    content,
    'return new Worker(new URL("sqlite3-worker1.mjs", import.meta.url), { type: "module" });',
    'return new Worker(new URL("./sqlite3-worker1.mjs", (globalThis?.document?.currentScript?.src || globalThis?.location?.href || "")));',
    "index.mjs"
  );
  content = replaceExact(
    content,
    "var _scriptName = import.meta.url;",
    'var _scriptName = (globalThis?.document?.currentScript?.src || globalThis?.location?.href || "");',
    "index.mjs"
  );
  content = replaceExact(
    content,
    "var wasmBinary;",
    'var wasmBinary = Module["wasmBinary"];',
    "index.mjs"
  );
  content = replaceExact(
    content,
    "if (file == wasmBinaryFile && wasmBinary) return new Uint8Array(wasmBinary);",
    "if (wasmBinary) return new Uint8Array(wasmBinary);",
    "index.mjs"
  );
  content = replaceExact(
    content,
    'return new URL("sqlite3.wasm", import.meta.url).href;',
    'return "./sqlite3.wasm";',
    "index.mjs"
  );
  content = replaceExact(
    content,
    'const W = new Worker(new URL("sqlite3-opfs-async-proxy.js", import.meta.url));',
    'const proxyUri = (globalThis?.location?.href || globalThis?.document?.currentScript?.src || "").replace(/[^/?#]+(?:[?#].*)?$/, "") + "sqlite3-opfs-async-proxy.js";\n\t\t\t\t\tconst W = new Worker(proxyUri);',
    "index.mjs"
  );
  content = replaceExact(
    content,
    'installOpfsVfs.defaultProxyUri = "sqlite3-opfs-async-proxy.js";',
    'installOpfsVfs.defaultProxyUri = "./sqlite3-opfs-async-proxy.js";',
    "index.mjs"
  );

  writeUtf8(filePath, content);
}

function patchWorkerRuntimeMjs() {
  const filePath = path.join(targetDir, "sqlite3-worker1.mjs");
  let content = readUtf8(filePath);

  content = replaceExact(
    content,
    "return new URL(path, import.meta.url).href;",
    'return (this.sqlite3Dir || prefix || "") + path;',
    "sqlite3-worker1.mjs"
  );
  content = replaceExact(
    content,
    "var _scriptName = import.meta.url;",
    'var _scriptName = (globalThis?.document?.currentScript?.src || globalThis?.location?.href || "");',
    "sqlite3-worker1.mjs"
  );
  content = replaceExact(
    content,
    "var wasmBinary;",
    'var wasmBinary = Module["wasmBinary"];',
    "sqlite3-worker1.mjs"
  );
  content = replaceExact(
    content,
    "if (file == wasmBinaryFile && wasmBinary) return new Uint8Array(wasmBinary);",
    "if (wasmBinary) return new Uint8Array(wasmBinary);",
    "sqlite3-worker1.mjs"
  );
  content = replaceExact(
    content,
    'return new URL("sqlite3.wasm", import.meta.url).href;',
    'return new URL("sqlite3.wasm", (globalThis?.document?.currentScript?.src || globalThis?.location?.href || "")).href;',
    "sqlite3-worker1.mjs"
  );
  content = replaceExact(
    content,
    "const W = new Worker(new URL(options.proxyUri, import.meta.url));",
    'const proxyUri = /^[a-zA-Z][a-zA-Z\\d+.-]*:/.test(options.proxyUri) ? options.proxyUri : (globalThis?.location?.href || globalThis?.document?.currentScript?.src || "").replace(/[^/?#]+(?:[?#].*)?$/, "") + options.proxyUri.replace(/^\\.\\//, "");\n\t\t\t\t\tconst W = new Worker(proxyUri);',
    "sqlite3-worker1.mjs"
  );
  content = replaceExact(
    content,
    'installOpfsVfs.defaultProxyUri = "sqlite3-opfs-async-proxy.js";',
    'installOpfsVfs.defaultProxyUri = globalThis.__RNTurboSqliteWorkerModule?.proxyUri || "./sqlite3-opfs-async-proxy.js";',
    "sqlite3-worker1.mjs"
  );
  content = replaceExact(
    content,
    "if (sqlite3?.scriptInfo?.sqlite3Dir) installOpfsVfs.defaultProxyUri = sqlite3.scriptInfo.sqlite3Dir + proxyJs;",
    "if (sqlite3?.scriptInfo?.sqlite3Dir && !/^[a-zA-Z][a-zA-Z\\d+.-]*:/.test(proxyJs)) installOpfsVfs.defaultProxyUri = sqlite3.scriptInfo.sqlite3Dir + proxyJs;",
    "sqlite3-worker1.mjs"
  );
  content = replaceExact(
    content,
    "sqlite3InitModule().then((sqlite3) => sqlite3.initWorker1API());",
    "sqlite3InitModule(globalThis.__RNTurboSqliteWorkerModule || {}).then((sqlite3) => sqlite3.initWorker1API());",
    "sqlite3-worker1.mjs"
  );
  content = removeExact(content, "\nexport {};\n", "sqlite3-worker1.mjs");

  writeUtf8(filePath, content);
}

function main() {
  assertExists(sourceDir);
  fs.mkdirSync(targetDir, { recursive: true });

  copyFile(
    path.join(sourceDir, "index.mjs"),
    path.join(targetDir, "index.mjs")
  );
  copyFile(
    path.join(sourceDir, "sqlite3-worker1.mjs"),
    path.join(targetDir, "sqlite3-worker1.mjs")
  );
  copyFile(
    path.join(sourceDir, "sqlite3-opfs-async-proxy.js"),
    path.join(targetDir, "sqlite3-opfs-async-proxy.js")
  );
  copyFile(
    path.join(sourceDir, "sqlite3.wasm"),
    path.join(targetDir, "sqlite3.wasm")
  );

  patchIndexMjs();
  patchWorkerRuntimeMjs();

  writeBase64Module(
    path.join(targetDir, "sqlite3-worker1-base64.ts"),
    "sqlite3Worker1Base64",
    path.join(targetDir, "sqlite3-worker1.mjs")
  );
  writeBase64Module(
    path.join(targetDir, "sqlite3-opfs-async-proxy-base64.ts"),
    "sqlite3OpfsAsyncProxyBase64",
    path.join(targetDir, "sqlite3-opfs-async-proxy.js")
  );
  writeBase64Module(
    path.join(targetDir, "sqlite3-wasm-base64.ts"),
    "sqlite3WasmBase64",
    path.join(targetDir, "sqlite3.wasm")
  );

  process.stdout.write(`Vendored sqlite-wasm from ${sourceDir}\n`);
}

main();
