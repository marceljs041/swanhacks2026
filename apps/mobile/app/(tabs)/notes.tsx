import { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Link, useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { listNotes, recordXp, upsertNote } from "@/db/repositories";
import type { NoteRow } from "@studynest/shared";
import { XP_RULES } from "@studynest/shared";
import { colors, radius, spacing, typography } from "@/theme";

export default function Notes() {
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const router = useRouter();

  const refresh = useCallback(async () => {
    setNotes(await listNotes(null));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  async function newNote(): Promise<void> {
    const note = await upsertNote({ title: "Untitled" });
    await recordXp("createNote", XP_RULES.createNote);
    router.push(`/notes/${note.id}`);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={notes}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[typography.h2, { color: colors.text }]}>No notes yet</Text>
            <Text style={{ color: colors.muted, marginTop: 4 }}>Tap + to capture your first.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Link href={`/notes/${item.id}`} asChild>
            <Pressable style={styles.card}>
              <Text style={[typography.h2, { color: colors.text }]}>{item.title || "Untitled"}</Text>
              {item.content_markdown ? (
                <Text style={{ color: colors.muted, marginTop: 4 }} numberOfLines={2}>
                  {item.content_markdown}
                </Text>
              ) : null}
              <Text style={{ color: colors.muted, fontSize: 11, marginTop: 8 }}>
                {new Date(item.updated_at).toLocaleString()}
              </Text>
            </Pressable>
          </Link>
        )}
      />
      <Pressable style={styles.fab} onPress={() => void newNote()}>
        <Text style={{ color: "white", fontSize: 28, lineHeight: 28 }}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  empty: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.xl,
    alignItems: "center",
  },
  fab: {
    position: "absolute",
    right: spacing.lg,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
});
