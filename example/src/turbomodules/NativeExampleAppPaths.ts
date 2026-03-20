import { TurboModuleRegistry, type TurboModule } from "react-native";

export interface Spec extends TurboModule {
  getDatabaseDirectory(): string;
}

export default TurboModuleRegistry.getEnforcing<Spec>("ExampleAppPaths");
