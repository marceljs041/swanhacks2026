import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useCallback } from "react";
import { Link } from "expo-router";
import { currentStreak, listNotes, totalXpToday } from "@/db/repositories";
import { useApp } from "@/store";
import { colors, spacing, typography, radius } from "@/theme";
import type { NoteRow } from "@studynest/shared";
import { SyncPill } from "@/components/SyncPill";

export default function Home() {
  const xp = useApp((s) => s.xpToday);
  const streak = useApp((s) => s.streak);
  const setXp = useApp((s) => s.setXp);
  const [recent, setRecent] = useState<NoteRow[]>([]);

  const refresh = useCallback(async () => {
    const [x, s, n] = await Promise.all([totalXpToday(), currentStreak(), listNotes(null)]);
    setXp(x, s);
    setRecent(n.slice(0, 3));
  }, [setXp]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  return (
    <ScrollView style={{ backgroundColor: colors.bg, flex: 1 }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
      <View style={styles.header}>
        <View>
          <Text style={[typography.h2, { color: colors.muted }]}>Welcome back</Text>
          <Text style={[typography.display, { color: colors.text }]}>StudyNest</Text>
        </View>
        <SyncPill />
      </View>
      <View style={styles.row}>
        <Stat label="Streak" value={`${streak}`} />
        <Stat label="XP today" value={`${xp}`} />
      </View>
      <View>
        <Text style={[typography.h2, { color: colors.text, marginBottom: spacing.sm }]}>
          Continue
        </Text>
        {recent.length === 0 && (
          <View style={styles.empty}>
            <Text style={{ color: colors.muted }}>No notes yet. Tap Capture to add one.</Text>
          </View>
        )}
        {recent.map((n) => (
          <Link key={n.id} href={`/notes/${n.id}`} style={styles.card}>
            <Text style={[typography.h2, { color: colors.text }]}>{n.title || "Untitled"}</Text>
          </Link>
        ))}
      </View>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={[styles.stat]}>
      <Text style={{ color: colors.muted, fontSize: 12, textTransform: "uppercase" }}>{label}</Text>
      <Text style={[typography.display, { color: colors.text, marginTop: 4 }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  row: { flexDirection: "row", gap: spacing.md },
  stat: {
    flex: 1,
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  empty: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.lg,
  },
});
