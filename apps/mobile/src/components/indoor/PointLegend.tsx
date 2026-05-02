import { ScrollView, StyleSheet, Text, View } from "react-native";
import { colors } from "../../theme/colors";

const ITEMS: { color: string; label: string }[] = [
  { color: "#16A34A", label: "Entrance" },
  { color: "#2563EB", label: "Elevator" },
  { color: "#D97706", label: "Stairs" },
  { color: "#7C3AED", label: "Restroom" },
  { color: "#0EA5E9", label: "Study" },
  { color: "#EA580C", label: "Help" },
  { color: "#DC2626", label: "Hazard" },
];

export function PointLegend() {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {ITEMS.map((i) => (
        <View key={i.label} style={styles.item}>
          <View style={[styles.dot, { backgroundColor: i.color }]} />
          <Text style={styles.label}>{i.label}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 10, paddingHorizontal: 12 },
  item: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  label: { fontSize: 12, color: colors.slate, fontWeight: "500" },
});
