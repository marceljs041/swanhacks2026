import { StyleSheet, Text, View } from "react-native";
import { useApp } from "@/store";
import { colors, radius, spacing } from "@/theme";

const COLOR_FOR: Record<string, string> = {
  offline: colors.muted,
  saving: colors.warning,
  synced: colors.success,
  syncing: colors.warning,
  conflict: colors.warning,
  error: colors.danger,
};

export function SyncPill() {
  const status = useApp((s) => s.syncStatus);
  const color = COLOR_FOR[status] ?? colors.muted;
  return (
    <View style={styles.pill}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={{ color, fontSize: 12 }}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.panelSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    gap: 6,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
