import { useEffect, useRef, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { Audio } from "expo-av";
import { getNote, listAttachments, upsertNote } from "@/db/repositories";
import type { AttachmentRow, NoteRow } from "@studynest/shared";
import { ai } from "@/lib/ai";
import { colors, radius, spacing, typography } from "@/theme";
import { useApp } from "@/store";

export default function NoteScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const noteId = String(id);
  const [note, setNote] = useState<NoteRow | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<AttachmentRow[]>([]);
  const [busy, setBusy] = useState(false);
  const setSyncStatus = useApp((s) => s.setSyncStatus);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void (async () => {
      const n = await getNote(noteId);
      setNote(n);
      setTitle(n?.title ?? "");
      setBody(n?.content_markdown ?? "");
      setAttachments(await listAttachments(noteId));
    })();
  }, [noteId]);

  function scheduleSave(t: string, b: string): void {
    setSyncStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const updated = await upsertNote({
        ...(note ?? {}),
        id: noteId,
        title: t || "Untitled",
        content_markdown: b,
      });
      setNote(updated);
      setSyncStatus("synced");
    }, 600);
  }

  async function summarize(): Promise<void> {
    if (!note) return;
    setBusy(true);
    try {
      const res = await ai.summarize({ note_id: noteId, title, content: body });
      const updated = await upsertNote({ ...note, summary: res.summary });
      setNote(updated);
    } finally {
      setBusy(false);
    }
  }

  async function playAudio(uri: string): Promise<void> {
    const { sound } = await Audio.Sound.createAsync({ uri });
    await sound.playAsync();
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Stack.Screen options={{ title: title || "Note" }} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        <TextInput
          value={title}
          onChangeText={(t) => {
            setTitle(t);
            scheduleSave(t, body);
          }}
          placeholder="Untitled"
          placeholderTextColor={colors.muted}
          style={styles.title}
        />
        <TextInput
          value={body}
          onChangeText={(b) => {
            setBody(b);
            scheduleSave(title, b);
          }}
          placeholder="Write or dictate here…"
          placeholderTextColor={colors.muted}
          multiline
          style={styles.body}
        />
        {attachments.length > 0 && (
          <View>
            <Text style={[typography.h2, { color: colors.text, marginVertical: spacing.sm }]}>
              Attachments
            </Text>
            {attachments.map((a) => (
              <View key={a.id} style={styles.attachmentCard}>
                {a.type === "image" && (
                  <Image source={{ uri: a.local_uri }} style={styles.thumb} resizeMode="cover" />
                )}
                {a.type === "audio" && (
                  <Pressable onPress={() => void playAudio(a.local_uri)}>
                    <Text style={{ color: colors.accent }}>▶ Play recording</Text>
                  </Pressable>
                )}
                {a.type === "file" && (
                  <Text style={{ color: colors.text }}>{a.file_name ?? "File"}</Text>
                )}
                <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>
                  {a.remote_url ? "Synced" : "Local only"}
                </Text>
              </View>
            ))}
          </View>
        )}
        {note?.summary && (
          <View style={styles.summary}>
            <Text style={{ color: colors.muted, fontSize: 12, textTransform: "uppercase" }}>
              Summary
            </Text>
            <Text style={{ color: colors.text, marginTop: 4 }}>{note.summary}</Text>
          </View>
        )}
        <Pressable style={styles.aiBtn} onPress={() => void summarize()} disabled={busy}>
          <Text style={styles.aiBtnText}>{busy ? "Thinking…" : "Summarize with AI"}</Text>
        </Pressable>
        <Text style={{ color: colors.muted, fontSize: 11 }}>
          Tip: open StudyNest on desktop to generate flashcards and quizzes offline.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.display,
    color: colors.text,
    paddingVertical: 0,
  },
  body: {
    color: colors.text,
    fontSize: 15,
    minHeight: 240,
    textAlignVertical: "top",
  },
  attachmentCard: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  thumb: { width: "100%", height: 200, borderRadius: radius.sm },
  summary: {
    backgroundColor: colors.panelSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  aiBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: "center",
  },
  aiBtnText: { color: "white", fontWeight: "600" },
});
