const { getDefaultConfig, mergeConfig } = require("@react-native/metro-config");
const fs = require("fs");
const path = require("node:path");
const escape = require("escape-string-regexp");
const pack = require("../package.json");

const root = path.resolve(__dirname, "..");
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
const resolverPlatforms = Array.from(
  new Set([...(baseConfig.resolver?.platforms ?? []), "windows"])
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

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = {
  watchFolders: [root],

  // We need to make sure that only one version is loaded for peerDependencies.
  // So we block them at the root, and alias them to the versions in example's
  // node_modules. We also force Windows bundles through react-native-windows
  // so RNW's JS overrides are used for core modules.
  resolver: {
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
};

module.exports = mergeConfig(baseConfig, config);
