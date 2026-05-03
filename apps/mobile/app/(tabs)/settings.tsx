import { useMemo } from "react";
import { View, Text, Switch, StyleSheet, ScrollView } from "react-native";
import { useApp } from "@/store";
import { colors, spacing, typography, radius } from "@/theme";
import { getGemmaStatus } from "@/lib/onDeviceAi";
import { APP_NAME } from "@studynest/shared";

export default function Settings() {
  const aiEnabled = useApp((s) => s.aiEnabled);
  const setAiEnabled = useApp((s) => s.setAiEnabled);
  const gemma = useMemo(() => getGemmaStatus(), []);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
    >
      <Text style={[typography.h2, { color: colors.text }]}>Settings</Text>

      <View style={styles.section}>
        <Text style={[typography.h2, { color: colors.text, fontSize: 18 }]}>On-device AI</Text>
        <Text style={{ color: colors.muted, marginTop: spacing.sm, lineHeight: 20 }}>
          {gemma.label}. When a native Gemma 4 E4B module is present ({gemma.runtime}), prompts are
          sent to the model; otherwise an embedded engine keeps everything offline.
        </Text>
        <View style={styles.settingRow}>
          <Text style={{ color: colors.text }}>Enable AI features</Text>
          <Switch
            value={aiEnabled}
            onValueChange={setAiEnabled}
            trackColor={{ false: colors.border, true: colors.accent }}
            thumbColor={aiEnabled ? "#fff" : "#f4f3f4"}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[typography.h2, { color: colors.text, fontSize: 18 }]}>About</Text>
        <Text style={{ color: colors.muted, marginTop: spacing.sm }}>{APP_NAME} mobile v0.1.0</Text>
        <Text style={{ color: colors.muted, marginTop: 4 }}>
          Notes and study plans stay on your device; sync is optional when the API is available.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.md,
  },
});
