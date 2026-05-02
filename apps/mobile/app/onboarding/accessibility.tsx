import { ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import type { AccessibilityPreferences } from "@cyaccess/shared";
import { Button } from "../../src/components/ui/Button";
import { Screen } from "../../src/components/ui/Screen";
import { Card } from "../../src/components/ui/Card";
import { colors } from "../../src/theme/colors";
import { usePreferences } from "../../src/stores/preferences.store";

type Row = { key: keyof AccessibilityPreferences; i18nKey: string };

const ROWS: Row[] = [
  { key: "avoidStairs", i18nKey: "onboarding.accessibility.avoidStairs" },
  { key: "preferElevators", i18nKey: "onboarding.accessibility.preferElevators" },
  { key: "preferAccessibleEntrances", i18nKey: "onboarding.accessibility.preferAccessibleEntrances" },
  { key: "voiceGuidance", i18nKey: "onboarding.accessibility.voiceGuidance" },
  { key: "largeText", i18nKey: "onboarding.accessibility.largeText" },
  { key: "highContrast", i18nKey: "onboarding.accessibility.highContrast" },
  { key: "reduceMotion", i18nKey: "onboarding.accessibility.reduceMotion" },
];

export default function AccessibilityScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { accessibility, setAccessibility, completeOnboarding } = usePreferences();

  const onDone = () => {
    completeOnboarding();
    router.replace("/(tabs)/map");
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{t("onboarding.accessibility.title")}</Text>
        <Text style={styles.subtitle}>{t("onboarding.accessibility.subtitle")}</Text>

        <Card elevated style={{ gap: 4 }}>
          {ROWS.map((row, idx) => (
            <View key={row.key}>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>{t(row.i18nKey)}</Text>
                <Switch
                  value={accessibility[row.key]}
                  onValueChange={(v) => setAccessibility({ [row.key]: v } as Partial<AccessibilityPreferences>)}
                  trackColor={{ true: colors.cardinal, false: "#d1d5db" }}
                  thumbColor={colors.cream}
                  accessibilityLabel={t(row.i18nKey)}
                />
              </View>
              {idx < ROWS.length - 1 ? <View style={styles.sep} /> : null}
            </View>
          ))}
        </Card>

        <Button title={t("common.done")} onPress={onDone} fullWidth style={{ marginTop: 24 }} />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 24, paddingTop: 40, gap: 16 },
  title: { fontSize: 28, fontWeight: "800", color: colors.cycloneDark },
  subtitle: { fontSize: 15, color: colors.slate, marginBottom: 16 },
  row: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  rowLabel: { fontSize: 16, color: colors.slate, fontWeight: "500", flex: 1, marginRight: 8 },
  sep: { height: 1, backgroundColor: "rgba(0,0,0,0.06)" },
});
