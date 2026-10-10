const path = require("path");
const pak = require("../package.json");
const ios = require("@react-native-community/cli-platform-ios");
const android = require("@react-native-community/cli-platform-android");
const reactNativeWindows =
  process.platform === "win32"
    ? require("react-native-windows/react-native.config")
    : null;

module.exports = {
  ...(process.env.REACT_NATIVE_PLATFORM === "macos"
    ? {
        reactNativePath: path.dirname(
          require.resolve("react-native-macos/package.json")
        ),
      }
    : {}),
  dependencies: {
    [pak.name]: {
      root: path.join(__dirname, ".."),
    },
  },
  commands: [
    ...ios.commands,
    ...android.commands,
    ...(reactNativeWindows?.commands ?? []),
  ],
  platforms: {
    ios: {
      projectConfig: ios.projectConfig,
      dependencyConfig: ios.dependencyConfig,
    },
    android: {
      projectConfig: android.projectConfig,
      dependencyConfig: android.dependencyConfig,
    },
    ...(reactNativeWindows
      ? { windows: reactNativeWindows.platforms.windows }
      : {}),
  },
};
