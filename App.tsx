import { ExpoRoot } from "expo-router";

export default function App() {
  const context = (
    require as NodeRequire & {
      context: (path: string) => unknown;
    }
  ).context("./app");

  return <ExpoRoot context={context as never} />;
}
