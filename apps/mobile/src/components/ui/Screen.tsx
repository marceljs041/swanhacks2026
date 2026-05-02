import { ReactNode } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../../theme/colors";

export function Screen({
  children,
  style,
  contentStyle,
  edges,
}: {
  children: ReactNode;
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  edges?: ("top" | "right" | "bottom" | "left")[];
}) {
  return (
    <SafeAreaView style={[styles.safe, style]} edges={edges}>
      <View style={[styles.content, contentStyle]}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  content: { flex: 1 },
});
