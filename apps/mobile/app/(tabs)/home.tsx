import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { Link, useRouter } from "expo-router";
import ErrorBoundary from "../components/ErrorBoundary";
import {
  completeStudyTask,
  currentStreak,
  listNotes,
  listTasksForDay,
  recordXp,
  totalXpLifetime,
  totalXpToday,
} from "@/db/repositories";
import { useApp } from "@/store";
import { colors, spacing, typography, radius } from "@/theme";
import type { NoteRow, StudyTaskRow } from "@studynest/shared";
import { XP_RULES } from "@studynest/shared";
import { SyncPill } from "@/components/SyncPill";

const LEVEL_DIV = 120;

export default function Home() {
  return (
    <ErrorBoundary>
      <HomeContent />
    </ErrorBoundary>
  );
}

function HomeContent() {
  const router = useRouter();
  const xp = useApp((s) => s.xpToday);
  const streak = useApp((s) => s.streak);
  const setXp = useApp((s) => s.setXp);
  const [recent, setRecent] = useState<NoteRow[]>([]);
  const [quests, setQuests] = useState<StudyTaskRow[]>([]);
  const [lifetime, setLifetime] = useState(0);

  const refresh = useCallback(async () => {
    const today = new Date();
    const [x, s, n, q, life] = await Promise.all([
      totalXpToday(),
      currentStreak(),
      listNotes(null),
      listTasksForDay(today),
      totalXpLifetime(),
    ]);
    setXp(x, s);
    setRecent(n.slice(0, 3));
    setQuests(
      q
        .filter((t) => !t.completed_at)
        .sort((a, b) => (a.scheduled_for ?? "").localeCompare(b.scheduled_for ?? "")),
    );
    setLifetime(life);
  }, [setXp]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const level = Math.floor(lifetime / LEVEL_DIV) + 1;
  const intoLevel = lifetime % LEVEL_DIV;

  async function completeQuest(task: StudyTaskRow): Promise<void> {
    await completeStudyTask(task.id);
    await recordXp("studyTaskComplete", XP_RULES.studyTaskComplete);
    await refresh();
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg, flex: 1 }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
    >
      <View style={styles.header}>
        <View>
          <Text style={[typography.h2, { color: colors.muted }]}>Today</Text>
          <Text style={[typography.display, { color: colors.text }]}>StudyNest</Text>
        </View>
        <SyncPill />
      </View>

      <View style={styles.row}>
        <Stat label="Streak" value={`${streak}d`} />
        <Stat label="XP today" value={`${xp}`} />
      </View>

      <View style={styles.levelCard}>
        <Text style={{ color: colors.muted, fontSize: 12, textTransform: "uppercase" }}>Level</Text>
        <Text style={[typography.display, { color: colors.text, marginTop: 4 }]}>{level}</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${(intoLevel / LEVEL_DIV) * 100}%` }]} />
        </View>
        <Text style={{ color: colors.muted, fontSize: 12, marginTop: 8 }}>
          {intoLevel} / {LEVEL_DIV} XP to next level
        </Text>
      </View>

      <View>
        <Text style={[typography.h2, { color: colors.text, marginBottom: spacing.sm }]}>
          Daily quests
        </Text>
        {quests.length === 0 ? (
          <View style={styles.empty}>
            <Text style={{ color: colors.muted, lineHeight: 20 }}>
              No open quests for today. Open Plan and generate a gamified study schedule from your
              notes.
            </Text>
            <Pressable onPress={() => router.navigate("/(tabs)/plan")} style={styles.link}>
              <Text style={{ color: colors.accent, fontWeight: "600" }}>Go to Plan</Text>
            </Pressable>
          </View>
        ) : (
          quests.map((q) => (
            <View key={q.id} style={styles.quest}>
              <View style={{ flex: 1, paddingRight: spacing.md }}>
                <Text style={{ color: colors.text, fontWeight: "600" }}>{q.title}</Text>
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 4 }}>
                  +{XP_RULES.studyTaskComplete} XP · {q.duration_minutes}m
                </Text>
              </View>
              <Pressable style={styles.doneBtn} onPress={() => void completeQuest(q)}>
                <Text style={styles.doneBtnText}>Done</Text>
              </Pressable>
            </View>
          ))
        )}
      </View>

      <View>
        <Text style={[typography.h2, { color: colors.text, marginBottom: spacing.sm }]}>
          Recent notes
        </Text>
        {recent.length === 0 && (
          <View style={styles.empty}>
            <Text style={{ color: colors.muted }}>Start a note or capture something.</Text>
            <Link href="/capture" style={styles.link}>
              <Text style={{ color: colors.accent, fontWeight: "600" }}>Capture</Text>
            </Link>
          </View>
        )}
        {recent.map((n) => (
          <Link
            key={n.id}
            href={{ pathname: "/notes/[id]", params: { id: n.id } }}
            style={styles.card}
          >
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
  levelCard: {
    backgroundColor: colors.panelSoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  progressTrack: {
    height: 8,
    backgroundColor: colors.panel,
    borderRadius: 4,
    marginTop: spacing.md,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.accent,
    borderRadius: 4,
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
    gap: spacing.sm,
  },
  link: { marginTop: spacing.sm },
  quest: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  doneBtn: {
    backgroundColor: colors.accent,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
  },
  doneBtnText: { color: "white", fontWeight: "700", fontSize: 13 },
});
