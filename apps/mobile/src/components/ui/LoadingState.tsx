import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { colors } from "../../theme/colors";

export function LoadingState({ label }: { label?: string }) {
  return (
    <View style={styles.wrap}>
      <ActivityIndicator color={colors.cardinal} size="large" />
      {label ? <Text style={styles.text}>{label}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24, gap: 12 },
  text: { color: colors.slate, fontSize: 16 },
});
