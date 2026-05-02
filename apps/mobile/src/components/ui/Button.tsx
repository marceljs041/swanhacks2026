import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { colors } from "../../theme/colors";
import { radii, tap } from "../../theme/spacing";

type Variant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  title,
  onPress,
  variant = "primary",
  loading,
  disabled,
  fullWidth,
  style,
  accessibilityLabel,
}: {
  title: string;
  onPress?: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  accessibilityLabel?: string;
}) {
  const isDisabled = disabled || loading;
  const palette = stylesFor(variant);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        palette.container,
        fullWidth && { alignSelf: "stretch" },
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      <View style={styles.inner}>
        {loading ? (
          <ActivityIndicator color={palette.text.color} />
        ) : (
          <Text style={[styles.text, palette.text]}>{title}</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: tap.minSize,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: radii.lg,
    justifyContent: "center",
    alignItems: "center",
  },
  inner: { flexDirection: "row", alignItems: "center", gap: 8 },
  text: { fontSize: 16, fontWeight: "600" },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  disabled: { opacity: 0.45 },
});

function stylesFor(variant: Variant) {
  switch (variant) {
    case "primary":
      return {
        container: { backgroundColor: colors.cardinal },
        text: { color: "#FFFFFF" },
      };
    case "secondary":
      return {
        container: { backgroundColor: colors.gold },
        text: { color: colors.cycloneDark },
      };
    case "ghost":
      return {
        container: { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.muted },
        text: { color: colors.slate },
      };
    case "danger":
      return {
        container: { backgroundColor: colors.danger },
        text: { color: "#FFFFFF" },
      };
  }
}
