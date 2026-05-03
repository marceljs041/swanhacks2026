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
    try {
      const notesData = await listNotes(null);
      setNotes(notesData);
    } catch (e) {
      console.warn("Failed to load notes", e);
      setNotes([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  async function newNote(): Promise<void> {
    try {
      const note = await upsertNote({ title: "Untitled" });
      await recordXp("createNote", XP_RULES.createNote);
      router.push({ pathname: "/notes/[id]", params: { id: note.id } });
    } catch (e) {
      console.error("newNote", e);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={styles.toolbar}>
        <Link href="/capture" asChild>
          <Pressable style={styles.toolBtn}>
            <Text style={styles.toolBtnText}>Capture</Text>
          </Pressable>
        </Link>
      </View>
      <FlatList
        data={notes}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl + spacing.xxl }}
        ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[typography.h2, { color: colors.text }]}>No notes yet</Text>
            <Text style={{ color: colors.muted, marginTop: 4 }}>Tap + to capture your first.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={styles.card}
            onPress={() => router.push({ pathname: "/notes/[id]", params: { id: item.id } })}
          >
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
        )}
      />
      <Pressable style={styles.fab} onPress={() => void newNote()}>
        <Text style={{ color: "white", fontSize: 28, lineHeight: 28 }}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  toolBtn: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.panel,
  },
  toolBtnText: { color: colors.accent, fontWeight: "600", fontSize: 14 },
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
