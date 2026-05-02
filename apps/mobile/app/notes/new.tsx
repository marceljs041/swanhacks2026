import { Redirect } from "expo-router";

// New-note flow lives in /capture; this route just bounces over so deep
// links work consistently.
export default function New() {
  return <Redirect href="/(tabs)/capture" />;
}
