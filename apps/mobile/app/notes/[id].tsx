import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
import { useLocalSearchParams } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import { Audio } from "expo-av";
import { getNote, listAttachments, recordXp, upsertNote } from "@/db/repositories";
import type { AttachmentRow, NoteRow } from "@studynest/shared";
import { XP_RULES } from "@studynest/shared";
import { summarizeNote } from "@/lib/onDeviceAi";
import { colors, radius, spacing, typography } from "@/theme";
import { useApp } from "@/store";

export default function NoteScreen() {
  const { id } = useLocalSearchParams<{ id: string | string[] }>();
  const noteId = Array.isArray(id) ? (id[0] ?? "") : (id ?? "");
  const navigation = useNavigation();
  const [note, setNote] = useState<NoteRow | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<AttachmentRow[]>([]);
  const [busy, setBusy] = useState(false);
  const setSyncStatus = useApp((s) => s.setSyncStatus);
  const aiEnabled = useApp((s) => s.aiEnabled);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useLayoutEffect(() => {
    navigation.setOptions({ title: title || "Note" });
  }, [navigation, title]);

  useEffect(() => {
    if (!noteId) return;
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
    if (!note || !aiEnabled) return;
    setBusy(true);
    try {
      const res = await summarizeNote({ title, content: body });
      const updated = await upsertNote({ ...note, summary: res.summary });
      setNote(updated);
      await recordXp("aiSummarize", XP_RULES.aiSummarize);
    } finally {
      setBusy(false);
    }
  }

  async function playAudio(uri: string): Promise<void> {
    const { sound } = await Audio.Sound.createAsync({ uri });
    await sound.playAsync();
  }

  if (!noteId) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: spacing.lg }}>
        <Text style={{ color: colors.muted }}>Missing note.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
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
        <Pressable
          style={[styles.aiBtn, !aiEnabled && { opacity: 0.5 }]}
          onPress={() => void summarize()}
          disabled={busy || !aiEnabled}
        >
          <Text style={styles.aiBtnText}>
            {busy ? "Working…" : aiEnabled ? "Summarize (on-device)" : "AI disabled in Settings"}
          </Text>
        </Pressable>
        <Text style={{ color: colors.muted, fontSize: 11 }}>
          Summaries run on your phone. Connect a native Gemma module for richer outputs.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 28,
    fontWeight: "700",
    lineHeight: 34,
    letterSpacing: -0.02,
    color: colors.text,
    paddingVertical: 0,
  },
  body: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
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
