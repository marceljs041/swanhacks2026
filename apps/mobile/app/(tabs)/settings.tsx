import {
  Alert,
  I18nManager,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import {
  LANGUAGES,
  type AccessibilityPreferences,
  type SupportedLanguage,
  getLanguageDescriptor,
} from "@cyaccess/shared";
import { Screen } from "../../src/components/ui/Screen";
import { Card } from "../../src/components/ui/Card";
import { Button } from "../../src/components/ui/Button";
import { usePreferences } from "../../src/stores/preferences.store";
import { colors } from "../../src/theme/colors";
import { clearDeviceId } from "../../src/lib/device";
import { useNotes } from "../../src/stores/notes.store";

const A11Y_ROWS: { key: keyof AccessibilityPreferences; i18nKey: string }[] = [
  { key: "avoidStairs", i18nKey: "onboarding.accessibility.avoidStairs" },
  { key: "preferElevators", i18nKey: "onboarding.accessibility.preferElevators" },
  { key: "preferAccessibleEntrances", i18nKey: "onboarding.accessibility.preferAccessibleEntrances" },
  { key: "voiceGuidance", i18nKey: "onboarding.accessibility.voiceGuidance" },
  { key: "largeText", i18nKey: "onboarding.accessibility.largeText" },
  { key: "highContrast", i18nKey: "onboarding.accessibility.highContrast" },
  { key: "reduceMotion", i18nKey: "onboarding.accessibility.reduceMotion" },
];

export default function SettingsScreen() {
  const { t } = useTranslation();
  const {
    language,
    accessibility,
    voiceRate,
    setLanguage,
    setAccessibility,
    setVoiceRate,
    reset,
  } = usePreferences();
  const clearNotes = useNotes((s) => s.clear);

  const onLanguageChange = (code: SupportedLanguage) => {
    const descriptor = getLanguageDescriptor(code);
    if (I18nManager.isRTL !== descriptor.isRTL) {
      Alert.alert(
        t("settings.language"),
        descriptor.isRTL
          ? "Arabic uses right-to-left layout. The app will need to restart."
          : "Layout will switch to left-to-right. The app will need to restart.",
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("common.confirm"),
            onPress: () => {
              I18nManager.allowRTL(descriptor.isRTL);
              I18nManager.forceRTL(descriptor.isRTL);
              setLanguage(code);
            },
          },
        ],
      );
      return;
    }
    setLanguage(code);
  };

  const onClearData = () => {
    Alert.alert(t("settings.clearData"), t("settings.privacy.body"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.confirm"),
        style: "destructive",
        onPress: async () => {
          reset();
          clearNotes();
          await clearDeviceId();
        },
      },
    ]);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{t("settings.title")}</Text>

        <Text style={styles.sectionLabel}>{t("settings.language")}</Text>
        <Card style={{ gap: 0 }}>
          {LANGUAGES.map((lang, idx) => (
            <View key={lang.code}>
              <Pressable
                onPress={() => onLanguageChange(lang.code)}
                accessibilityRole="radio"
                accessibilityState={{ selected: language === lang.code }}
                style={styles.langRow}
              >
                <Text style={styles.langLabel}>{lang.label}</Text>
                {language === lang.code ? <Text style={styles.check}>✓</Text> : null}
              </Pressable>
              {idx < LANGUAGES.length - 1 ? <View style={styles.sep} /> : null}
            </View>
          ))}
        </Card>

        <Text style={styles.sectionLabel}>{t("settings.accessibility")}</Text>
        <Card style={{ gap: 0 }}>
          {A11Y_ROWS.map((row, idx) => (
            <View key={row.key}>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>{t(row.i18nKey)}</Text>
                <Switch
                  value={accessibility[row.key]}
                  onValueChange={(v) =>
                    setAccessibility({ [row.key]: v } as Partial<AccessibilityPreferences>)
                  }
                  trackColor={{ true: colors.cardinal, false: "#d1d5db" }}
                  thumbColor={colors.cream}
                />
              </View>
              {idx < A11Y_ROWS.length - 1 ? <View style={styles.sep} /> : null}
            </View>
          ))}
        </Card>

        <Text style={styles.sectionLabel}>{t("settings.voice")}</Text>
        <Card>
          <Text style={styles.rowLabel}>{t("settings.voiceRate")}</Text>
          <View style={styles.stepperRow}>
            <Button
              title="−"
              variant="ghost"
              onPress={() => setVoiceRate(Math.max(0.5, voiceRate - 0.1))}
            />
            <Text style={styles.rate}>{voiceRate.toFixed(2)}x</Text>
            <Button
              title="+"
              variant="ghost"
              onPress={() => setVoiceRate(Math.min(1.5, voiceRate + 0.1))}
            />
          </View>
        </Card>

        <Text style={styles.sectionLabel}>{t("settings.privacy.title")}</Text>
        <Card>
          <Text style={styles.privacy}>{t("settings.privacy.body")}</Text>
        </Card>

        <Button
          title={t("settings.clearData")}
          variant="danger"
          onPress={onClearData}
          fullWidth
          style={{ marginTop: 12 }}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 48, gap: 12 },
  title: { fontSize: 28, fontWeight: "800", color: colors.cycloneDark, marginBottom: 8 },
  sectionLabel: {
    fontSize: 12,
    color: colors.muted,
    textTransform: "uppercase",
    fontWeight: "700",
    marginTop: 12,
  },
  langRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  langLabel: { fontSize: 16, color: colors.slate, fontWeight: "500" },
  check: { fontSize: 18, color: colors.cardinal, fontWeight: "800" },
  row: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
  },
  rowLabel: { fontSize: 15, color: colors.slate, fontWeight: "500", flex: 1, marginRight: 8 },
  sep: { height: 1, backgroundColor: "rgba(0,0,0,0.06)" },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    gap: 12,
  },
  rate: { fontSize: 18, fontWeight: "700", color: colors.slate },
  privacy: { fontSize: 14, color: colors.slate, lineHeight: 20 },
});
