import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SUPPORTED_LOCALES } from "@studynest/i18n";
import { colors, radius, spacing, typography } from "@/theme";

const profiles = [
  "I like flashcards",
  "I like quizzes",
  "I need summaries",
  "I prefer audio",
  "I get distracted easily",
  "I want daily reminders",
];

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.xl, gap: spacing.lg }}>
      {step === 0 && (
        <View>
          <Text style={[typography.display, { color: colors.text }]}>StudyNest</Text>
          <Text style={[typography.h2, { color: colors.muted, marginTop: 4 }]}>
            Your offline-first AI study workspace.
          </Text>
          <Pressable style={styles.primary} onPress={() => setStep(1)}>
            <Text style={styles.primaryText}>Get started</Text>
          </Pressable>
        </View>
      )}
      {step === 1 && (
        <View>
          <Text style={[typography.h1, { color: colors.text }]}>Choose your language</Text>
          <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
            {SUPPORTED_LOCALES.map((l) => (
              <Pressable key={l} style={styles.option} onPress={() => setStep(2)}>
                <Text style={{ color: colors.text }}>{l.toUpperCase()}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}
      {step === 2 && (
        <View>
          <Text style={[typography.h1, { color: colors.text }]}>How do you study best?</Text>
          <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
            {profiles.map((p) => (
              <Pressable key={p} style={styles.option}>
                <Text style={{ color: colors.text }}>{p}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={styles.primary} onPress={() => setStep(3)}>
            <Text style={styles.primaryText}>Continue</Text>
          </Pressable>
        </View>
      )}
      {step === 3 && (
        <View>
          <Text style={[typography.h1, { color: colors.text }]}>
            Works in class, even without Wi-Fi
          </Text>
          <Text style={{ color: colors.muted, marginTop: spacing.sm, lineHeight: 22 }}>
            Your notes and study plans save on-device first. Summaries and gamified plans work
            offline; add a native Gemma module when you want full model quality on phone.
          </Text>
          <Pressable
            style={styles.primary}
            onPress={() => router.replace("/(tabs)/home")}
          >
            <Text style={styles.primaryText}>Open StudyNest</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  primary: {
    marginTop: spacing.xl,
    backgroundColor: colors.accent,
    padding: spacing.lg,
    borderRadius: radius.md,
    alignItems: "center",
  },
  primaryText: { color: "white", fontWeight: "600", fontSize: 16 },
  option: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
});
