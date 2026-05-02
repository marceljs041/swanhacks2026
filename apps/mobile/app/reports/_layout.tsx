import { Stack } from "expo-router";

export default function ReportsStack() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        presentation: "modal",
        contentStyle: { backgroundColor: "#FFF8EA" },
      }}
    />
  );
}
