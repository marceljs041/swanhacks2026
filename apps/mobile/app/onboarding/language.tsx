import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as Localization from "expo-localization";
import { useTranslation } from "react-i18next";
import {
  LANGUAGES,
  isSupportedLanguage,
  type SupportedLanguage,
} from "@cyaccess/shared";
import { Button } from "../../src/components/ui/Button";
import { Screen } from "../../src/components/ui/Screen";
import { colors } from "../../src/theme/colors";
import { radii, tap } from "../../src/theme/spacing";
import { usePreferences } from "../../src/stores/preferences.store";

export default function LanguageScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { language, setLanguage } = usePreferences();
  const [selected, setSelected] = useState<SupportedLanguage>(language);

  const deviceLanguage = useMemo<SupportedLanguage | null>(() => {
    const locales = Localization.getLocales();
    const code = locales[0]?.languageCode ?? null;
    return code && isSupportedLanguage(code) ? code : null;
  }, []);

  const onContinue = () => {
    setLanguage(selected);
    router.push("/onboarding/accessibility");
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.logoWrap}>
          <View style={styles.logo}>
            <Text style={styles.logoText}>Cy</Text>
          </View>
        </View>

        <Text style={styles.title}>{t("onboarding.language.title")}</Text>
        <Text style={styles.subtitle}>{t("onboarding.language.subtitle")}</Text>

        <View style={styles.list}>
          {LANGUAGES.map((lang) => {
            const isSelected = selected === lang.code;
            return (
              <Pressable
                key={lang.code}
                onPress={() => setSelected(lang.code)}
                accessibilityRole="radio"
                accessibilityLabel={lang.englishLabel}
                accessibilityState={{ selected: isSelected }}
                style={[styles.option, isSelected && styles.optionSelected]}
              >
                <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                  {lang.label}
                </Text>
                <Text style={styles.optionSub}>{lang.englishLabel}</Text>
              </Pressable>
            );
          })}
        </View>

        {deviceLanguage ? (
          <Pressable
            onPress={() => {
              setSelected(deviceLanguage);
              setLanguage(deviceLanguage);
              router.push("/onboarding/accessibility");
            }}
            style={styles.deviceBtn}
            accessibilityRole="button"
          >
            <Text style={styles.deviceBtnText}>{t("common.useDeviceLanguage")}</Text>
          </Pressable>
        ) : null}

        <Button title={t("common.continue")} onPress={onContinue} fullWidth style={{ marginTop: 12 }} />
        <Text style={styles.footnote}>{t("onboarding.language.footnote")}</Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 24, paddingTop: 40, gap: 16 },
  logoWrap: { alignItems: "center", marginBottom: 12 },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.cardinal,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: { color: colors.gold, fontSize: 28, fontWeight: "800" },
  title: { fontSize: 28, fontWeight: "800", color: colors.cycloneDark, textAlign: "center" },
  subtitle: { fontSize: 15, color: colors.slate, textAlign: "center", marginBottom: 16 },
  list: { gap: 10 },
  option: {
    minHeight: tap.minSize,
    padding: 16,
    backgroundColor: colors.offWhite,
    borderRadius: radii.lg,
    borderWidth: 2,
    borderColor: "rgba(0,0,0,0.08)",
  },
  optionSelected: { borderColor: colors.cardinal, backgroundColor: "#FFF2F3" },
  optionLabel: { fontSize: 22, fontWeight: "700", color: colors.slate },
  optionLabelSelected: { color: colors.cardinal },
  optionSub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  deviceBtn: { alignItems: "center", paddingVertical: 12 },
  deviceBtnText: { color: colors.info, fontSize: 15, fontWeight: "600" },
  footnote: { fontSize: 12, color: colors.muted, textAlign: "center", marginTop: 4 },
});
