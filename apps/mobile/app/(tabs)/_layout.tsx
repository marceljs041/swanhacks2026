import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import { Text } from "react-native";
import { colors } from "../../src/theme/colors";

function tabIcon(label: string) {
  return ({ color, size }: { color: string; size: number }) => (
    <Text style={{ fontSize: size - 4, color, fontWeight: "700" }}>{label}</Text>
  );
}

export default function TabsLayout() {
  const { t } = useTranslation();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.cardinal,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.offWhite,
          borderTopColor: "rgba(0,0,0,0.08)",
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
      }}
    >
      <Tabs.Screen name="map" options={{ title: t("tabs.map"), tabBarIcon: tabIcon("🗺") }} />
      <Tabs.Screen name="reports" options={{ title: t("tabs.reports"), tabBarIcon: tabIcon("⚠") }} />
      <Tabs.Screen name="ask" options={{ title: t("tabs.ask"), tabBarIcon: tabIcon("💬") }} />
      <Tabs.Screen name="classroom" options={{ title: t("tabs.classroom"), tabBarIcon: tabIcon("📘") }} />
      <Tabs.Screen name="settings" options={{ title: t("tabs.settings"), tabBarIcon: tabIcon("⚙") }} />
    </Tabs>
  );
}
