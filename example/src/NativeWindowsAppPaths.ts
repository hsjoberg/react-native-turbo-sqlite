import { Platform, TurboModuleRegistry, type TurboModule } from "react-native";

export interface Spec extends TurboModule {
  getDatabaseDirectory(): string;
}

const NativeWindowsAppPaths =
  Platform.OS === "windows"
    ? TurboModuleRegistry.getEnforcing<Spec>("WindowsAppPaths")
    : null;

export default NativeWindowsAppPaths;
