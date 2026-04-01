const { getDefaultConfig, mergeConfig } = require("@react-native/metro-config");
const fs = require("fs");
const path = require("node:path");
const escape = require("escape-string-regexp");
const pack = require("../package.json");

const root = path.resolve(__dirname, "..");
const metroWebHtmlPath = path.resolve(__dirname, "index.metro.html");
const modules = Object.keys({ ...pack.peerDependencies });
const rnwPath = fs.realpathSync(
  path.resolve(require.resolve("react-native-windows/package.json"), "..")
);
const escapePathForRegex = (filePath) =>
  filePath
    .split(/[/\\]+/)
    .map(escape)
    .join(String.raw`[/\\]`);
const baseConfig = getDefaultConfig(__dirname);
const resolverAssetExts = Array.from(
  new Set([...(baseConfig.resolver?.assetExts ?? []), "wasm"])
);
const resolverPlatforms = Array.from(
  new Set([...(baseConfig.resolver?.platforms ?? []), "web", "windows"])
);
const existingBlockList = Array.isArray(baseConfig.resolver?.blockList)
  ? baseConfig.resolver.blockList
  : baseConfig.resolver?.blockList
    ? [baseConfig.resolver.blockList]
    : [];
const defaultResolveRequest =
  baseConfig.resolver?.resolveRequest ??
  ((context, moduleName, platform) =>
    context.resolveRequest(context, moduleName, platform));

const config = {
  watchFolders: [root],

  resolver: {
    assetExts: resolverAssetExts,
    platforms: resolverPlatforms,
    blockList: [
      ...existingBlockList,
      ...modules.map(
        (m) =>
          new RegExp(
            `^${escapePathForRegex(path.join(root, "node_modules", m))}(?:[/\\\\].*)?$`
          )
      ),
      new RegExp(
        `^${escapePathForRegex(path.resolve(__dirname, "windows"))}(?:[/\\\\].*)?$`
      ),
      new RegExp(
        `^${escapePathForRegex(path.join(rnwPath, "build"))}(?:[/\\\\].*)?$`
      ),
      new RegExp(
        `^${escapePathForRegex(path.join(rnwPath, "target"))}(?:[/\\\\].*)?$`
      ),
      /.*\.ProjectImports\.zip/,
    ],

    extraNodeModules: {
      ...modules.reduce((acc, name) => {
        acc[name] = path.join(__dirname, "node_modules", name);
        return acc;
      }, {}),
      [pack.name]: root,
      "react-native-windows": rnwPath,
    },

    resolveRequest: (context, moduleName, platform) => {
      if (platform === "web" && moduleName === "react-native") {
        return defaultResolveRequest(context, "react-native-web", platform);
      }

      if (platform === "windows") {
        if (moduleName === "react-native") {
          return defaultResolveRequest(
            context,
            "react-native-windows",
            platform
          );
        }

        if (moduleName.startsWith("react-native/")) {
          const windowsModuleName = `react-native-windows/${moduleName.slice(
            "react-native/".length
          )}`;

          try {
            return defaultResolveRequest(context, windowsModuleName, platform);
          } catch (error) {
            // Fall through to stock React Native when RNW does not override a file.
          }
        }
      }

      return defaultResolveRequest(context, moduleName, platform);
    },
  },

  transformer: {
    getTransformOptions: async () => ({
      transform: { experimentalImportSupport: false, inlineRequires: true },
    }),
  },

  server: {
    enhanceMiddleware: (middleware) => {
      return (req, res, next) => {
        res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
        res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");

        const requestPath = req.url?.split("?")[0];
        if (requestPath === "/metro-web" || requestPath === "/metro-web/") {
          res.setHeader("Content-Type", "text/html; charset=UTF-8");
          res.end(fs.readFileSync(metroWebHtmlPath));
          return;
        }

        return middleware(req, res, next);
      };
    },
  },
};

module.exports = mergeConfig(baseConfig, config);
