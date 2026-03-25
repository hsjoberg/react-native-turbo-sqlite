import { AppRegistry } from "react-native";
import App from "./src/App";
import { name as appName } from "./app.json";

AppRegistry.registerComponent(appName, () => App);

const rootTag = document.getElementById("root");

if (!rootTag) {
  throw new Error("Missing root element");
}

AppRegistry.runApplication(appName, {
  rootTag,
});
