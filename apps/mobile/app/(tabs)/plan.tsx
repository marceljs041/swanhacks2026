import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import {
  latestStudyPlan,
  listNotes,
  listTasksForRange,
  recordXp,
  upsertStudyPlan,
  upsertStudyTask,
} from "@/db/repositories";
import { gamifiedStudyPlan, getGemmaStatus } from "@/lib/onDeviceAi";
import type { NoteRow, StudyTaskRow } from "@studynest/shared";
import { XP_RULES } from "@studynest/shared";
import { colors, radius, spacing, typography } from "@/theme";

function startOfWeek(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  out.setDate(d.getDate() - d.getDay());
  return out;
}

export default function PlanScreen() {
  const [goal, setGoal] = useState("");
  const [examDate, setExamDate] = useState("");
  const [daysStr, setDaysStr] = useState("7");
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [weekTasks, setWeekTasks] = useState<StudyTaskRow[]>([]);
  const [planTitle, setPlanTitle] = useState<string | null>(null);
  const gemma = useMemo(() => getGemmaStatus(), []);

  const [weekStart, weekEnd] = useMemo(() => {
    const start = startOfWeek(new Date());
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return [start, end] as const;
  }, []);

  const refresh = useCallback(async () => {
    const [n, wk, plan] = await Promise.all([
      listNotes(null),
      listTasksForRange(weekStart.toISOString(), weekEnd.toISOString()),
      latestStudyPlan(),
    ]);
    setNotes(n);
    setWeekTasks(wk);
    setPlanTitle(plan?.title ?? null);
  }, [weekStart, weekEnd]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  async function generate(): Promise<void> {
    const days = Math.max(1, parseInt(daysStr, 10) || 7);
    setBusy(true);
    try {
      const plan = await upsertStudyPlan({
        title: `${(goal || "Study plan").slice(0, 48)} · ${new Date().toLocaleDateString()}`,
        exam_date: examDate.trim() ? examDate.trim() : null,
      });
      const res = await gamifiedStudyPlan({
        goal: goal.trim() || "Stay consistent and master the material",
        exam_date: examDate.trim() || null,
        notes: notes.map((x) => ({
          id: x.id,
          title: x.title,
          summary: x.summary,
        })),
        days_available: days,
      });
      for (const t of res.tasks) {
        await upsertStudyTask({
          plan_id: plan.id,
          note_id: t.note_id ?? null,
          title: t.title,
          type: t.type,
          scheduled_for: t.scheduled_for,
          duration_minutes: t.duration_minutes,
        });
      }
      await recordXp("generateStudyPlan", XP_RULES.generateStudyPlan);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        return d;
      }),
    [weekStart],
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl * 2 }}
    >
      <View>
        <Text style={[typography.h2, { color: colors.text }]}>Gamified study plan</Text>
        <Text style={{ color: colors.muted, marginTop: 6, lineHeight: 20 }}>
          Runs entirely on-device via {gemma.label}. Add notes first, set a goal, then generate
          quests for the week.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Goal</Text>
        <TextInput
          value={goal}
          onChangeText={setGoal}
          placeholder="e.g. Pass calculus midterm"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
        <Text style={[styles.label, { marginTop: spacing.md }]}>Exam date (optional, YYYY-MM-DD)</Text>
        <TextInput
          value={examDate}
          onChangeText={setExamDate}
          placeholder="2026-05-15"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
        <Text style={[styles.label, { marginTop: spacing.md }]}>Horizon (days)</Text>
        <TextInput
          value={daysStr}
          onChangeText={setDaysStr}
          keyboardType="number-pad"
          placeholder="7"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
        <Pressable
          style={[styles.primary, busy && { opacity: 0.6 }]}
          onPress={() => void generate()}
          disabled={busy || notes.length === 0}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryText}>
              {notes.length === 0 ? "Add notes first" : "Generate plan (offline)"}
            </Text>
          )}
        </Pressable>
        {planTitle ? (
          <Text style={{ color: colors.muted, fontSize: 12, marginTop: spacing.sm }}>
            Latest plan: {planTitle}
          </Text>
        ) : null}
      </View>

      <View>
        <Text style={[typography.h2, { color: colors.text, marginBottom: spacing.sm }]}>
          This week
        </Text>
        {days.map((d) => {
          const ds = d.toISOString().slice(0, 10);
          const dayTasks = weekTasks.filter((t) => t.scheduled_for?.slice(0, 10) === ds);
          return (
            <View key={ds} style={styles.day}>
              <Text style={styles.dayHeader}>
                {d.toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
              </Text>
              {dayTasks.length === 0 ? (
                <Text style={{ color: colors.muted, fontSize: 13 }}>No quests yet.</Text>
              ) : (
                dayTasks.map((t) => {
                  const done = !!t.completed_at;
                  return (
                    <View key={t.id} style={[styles.task, done && { opacity: 0.45 }]}>
                      <Text style={{ color: colors.text }}>{t.title}</Text>
                      <Text style={{ color: colors.muted, fontSize: 12 }}>
                        {t.duration_minutes}m · {t.type}
                        {done ? " · done" : ""}
                      </Text>
                    </View>
                  );
                })
              )}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  label: { color: colors.muted, fontSize: 12, textTransform: "uppercase", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.text,
    backgroundColor: colors.bg,
  },
  primary: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
    marginTop: spacing.lg,
  },
  primaryText: { color: "white", fontWeight: "700" },
  day: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  dayHeader: { ...typography.h2, color: colors.text, marginBottom: spacing.sm },
  task: {
    borderLeftWidth: 2,
    borderLeftColor: colors.accent,
    paddingLeft: spacing.sm,
    marginVertical: 4,
  },
});
