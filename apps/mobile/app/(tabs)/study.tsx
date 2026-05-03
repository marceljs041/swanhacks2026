import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { currentStreak, totalXpToday } from "@/db/repositories";
import { useApp } from "@/store";
import { colors, radius, spacing, typography } from "@/theme";

export default function Study() {
  const setXp = useApp((s) => s.setXp);
  const xp = useApp((s) => s.xpToday);
  const streak = useApp((s) => s.streak);

  const refresh = useCallback(async () => {
    try {
      const [x, s] = await Promise.all([totalXpToday(), currentStreak()]);
      setXp(x, s);
    } catch (e) {
      console.warn("Failed to load XP/streak", e);
      setXp(0, 0);
    }
  }, [setXp]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <ScrollView style={{ backgroundColor: colors.bg, flex: 1 }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
      <View style={styles.row}>
        <View style={styles.stat}>
          <Text style={styles.label}>Streak</Text>
          <Text style={styles.value}>{streak}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.label}>XP today</Text>
          <Text style={styles.value}>{xp}</Text>
        </View>
      </View>
      <View style={[styles.stat, { padding: spacing.lg }]}>
        <Text style={[typography.h2, { color: colors.text }]}>Mobile is capture-first</Text>
        <Text style={{ color: colors.muted, marginTop: spacing.sm, lineHeight: 20 }}>
          Open StudyNest on your laptop to review flashcards, take quizzes, and
          generate study plans with the offline AI. Anything you capture here
          shows up there once you're online.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.md },
  stat: {
    flex: 1,
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  label: { color: colors.muted, fontSize: 12, textTransform: "uppercase" },
  value: { ...typography.display, color: colors.text, marginTop: 4 },
});
