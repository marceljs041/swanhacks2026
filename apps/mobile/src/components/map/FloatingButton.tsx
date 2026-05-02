import { Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import { colors } from "../../theme/colors";

export function FloatingButton({
  label,
  icon,
  onPress,
  variant = "primary",
  style,
  accessibilityLabel,
}: {
  label: string;
  icon?: string;
  onPress?: () => void;
  variant?: "primary" | "secondary";
  style?: ViewStyle;
  accessibilityLabel?: string;
}) {
  const palette =
    variant === "primary"
      ? { bg: colors.cardinal, text: "#FFFFFF" }
      : { bg: colors.gold, text: colors.cycloneDark };

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      style={({ pressed }) => [
        styles.fab,
        { backgroundColor: palette.bg },
        pressed && { transform: [{ scale: 0.97 }] },
        style,
      ]}
    >
      {icon ? <Text style={[styles.icon, { color: palette.text }]}>{icon}</Text> : null}
      <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 999,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 4,
  },
  icon: { fontSize: 18, fontWeight: "700" },
  label: { fontSize: 15, fontWeight: "700" },
});
