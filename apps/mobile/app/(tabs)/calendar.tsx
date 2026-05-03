import { useCallback, useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
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
const [hasError, setHasError] = useState(false);
  const [weekStart, weekEnd] = useMemo(() => {
    const start = startOfWeek(new Date());
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return [start, end] as const;
  }, []);

  const refresh = useCallback(async () => {
    try {
      setTasks(await listTasksForRange(weekStart.toISOString(), weekEnd.toISOString()));
      setHasError(false);
    } catch (error) {
      console.warn("Calendar refresh failed", error);
      setTasks([]);
      setHasError(true);
    }
  }, [weekStart, weekEnd]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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
    <ScrollView style={{ backgroundColor: colors.bg, flex: 1 }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}>
      <Text style={[typography.h2, { color: colors.text, marginBottom: spacing.sm }]}>
        This week
      </Text>
      {hasError && (
        <Text style={{ color: colors.textMuted, marginTop: spacing.sm, fontSize: 13 }}>
          Error loading tasks. Please try again.
        </Text>
      )}
      {days.map((d) => {
        const ds = d.toISOString().slice(0, 10);
        const dayTasks = tasks.filter((t) => t.scheduled_for?.slice(0, 10) === ds);
        return (
          <View key={ds} style={styles.day}>
            <Text style={styles.dayHeader}>
              {d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
            </Text>
            {dayTasks.length === 0 ? (
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>No tasks.</Text>
            ) : (
              dayTasks.map((t) => {
                const title = t.title || "Untitled task";
                const type = t.type || "study";
                const duration = t.duration_minutes ?? 0;
                return (
                  <View key={t.id} style={styles.task}>
                    <Text style={{ color: colors.text }}>{title}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                      {duration}m · {type}
                    </Text>
                  </View>
                );
              })
            )}
          </View>
        );
      })}
      <Text style={{ color: colors.textMuted, marginTop: spacing.lg, fontSize: 12 }}>
        Generate study plans on desktop. They sync to mobile automatically.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  day: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  dayHeader: { ...typography.h2, color: colors.text, marginBottom: spacing.sm },
  task: {
    borderLeftWidth: 2,
    borderLeftColor: colors.primary,
    paddingLeft: spacing.sm,
    marginVertical: 4,
  },
});
