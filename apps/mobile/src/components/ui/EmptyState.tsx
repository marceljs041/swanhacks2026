import { StyleSheet, Text, View } from "react-native";
import { colors } from "../../theme/colors";

export function EmptyState({
  title,
  body,
}: {
  title: string;
  body?: string;
}) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 24, alignItems: "center", gap: 8 },
  title: { fontSize: 18, fontWeight: "700", color: colors.slate, textAlign: "center" },
  body: { fontSize: 14, color: colors.muted, textAlign: "center" },
});
