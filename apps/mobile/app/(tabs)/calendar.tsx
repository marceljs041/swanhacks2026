import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { listTasksForRange } from "@/db/repositories";
import type { StudyTaskRow } from "@studynest/shared";
import { colors, radius, spacing, typography } from "@/theme";

function startOfWeek(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  out.setDate(d.getDate() - d.getDay());
  return out;
}

export default function Calendar() {
  const [tasks, setTasks] = useState<StudyTaskRow[]>([]);
  const weekStart = startOfWeek(new Date());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  const refresh = useCallback(async () => {
    setTasks(await listTasksForRange(weekStart.toISOString(), weekEnd.toISOString()));
  }, [weekStart, weekEnd]);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}>
      <Text style={[typography.h2, { color: colors.text, marginBottom: spacing.sm }]}>
        This week
      </Text>
      {days.map((d) => {
        const ds = d.toISOString().slice(0, 10);
        const dayTasks = tasks.filter((t) => t.scheduled_for.slice(0, 10) === ds);
        return (
          <View key={ds} style={styles.day}>
            <Text style={styles.dayHeader}>
              {d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
            </Text>
            {dayTasks.length === 0 ? (
              <Text style={{ color: colors.muted, fontSize: 13 }}>No tasks.</Text>
            ) : (
              dayTasks.map((t) => (
                <View key={t.id} style={styles.task}>
                  <Text style={{ color: colors.text }}>{t.title}</Text>
                  <Text style={{ color: colors.muted, fontSize: 12 }}>
                    {t.duration_minutes}m · {t.type}
                  </Text>
                </View>
              ))
            )}
          </View>
        );
      })}
      <Text style={{ color: colors.muted, marginTop: spacing.lg, fontSize: 12 }}>
        Generate study plans on desktop. They sync to mobile automatically.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
