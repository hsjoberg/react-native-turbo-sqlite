const path = require("path");
const pak = require("../package.json");
const ios = require("@react-native-community/cli-platform-ios");
const android = require("@react-native-community/cli-platform-android");
const reactNativeWindows = require("react-native-windows/react-native.config");

module.exports = {
  dependencies: {
    [pak.name]: {
      root: path.join(__dirname, ".."),
    },
  },
  commands: [
    ...ios.commands,
    ...android.commands,
    ...reactNativeWindows.commands,
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
    windows: reactNativeWindows.platforms.windows,
  },
};
