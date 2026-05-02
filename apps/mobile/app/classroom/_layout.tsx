import { Stack } from "expo-router";

export default function ClassroomStack() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "#FFF8EA" },
      }}
    />
  );
}
