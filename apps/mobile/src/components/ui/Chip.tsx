import { Pressable, StyleSheet, Text } from "react-native";
import { colors } from "../../theme/colors";
import { radii, tap } from "../../theme/spacing";

export function Chip({
  label,
  selected,
  onPress,
  accessibilityLabel,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected: !!selected }}
      style={({ pressed }) => [
        styles.base,
        selected ? styles.selected : styles.unselected,
        pressed && { opacity: 0.85 },
      ]}
    >
      <Text style={[styles.text, selected ? styles.textSelected : styles.textUnselected]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: tap.minSize - 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.xl,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  selected: { backgroundColor: colors.gold, borderColor: colors.warmGold },
  unselected: { backgroundColor: colors.offWhite, borderColor: "rgba(0,0,0,0.08)" },
  text: { fontSize: 14, fontWeight: "600" },
  textSelected: { color: colors.cycloneDark },
  textUnselected: { color: colors.slate },
});
