import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { Audio } from "expo-av";
import { useRouter } from "expo-router";
import { recordXp, upsertNote } from "@/db/repositories";
import { saveAttachment } from "@/lib/attachments";
import { XP_RULES } from "@studynest/shared";
import { colors, radius, spacing, typography } from "@/theme";

export default function CaptureScreen() {
  const router = useRouter();
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recState, setRecState] = useState<"idle" | "recording" | "processing">("idle");

  async function newNote(title = "Untitled"): Promise<string> {
    const note = await upsertNote({ title });
    await recordXp("createNote", XP_RULES.createNote);
    return note.id;
  }

  async function pickImage(useCamera: boolean): Promise<void> {
    const perm = useCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Allow camera or photo library access to attach media.");
      return;
    }
    const res = useCamera
      ? await ImagePicker.launchCameraAsync({ quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ quality: 0.7 });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    const noteId = await newNote("Photo note");
    await saveAttachment({
      noteId,
      type: "image",
      sourceUri: asset.uri,
      mimeType: asset.mimeType ?? "image/jpeg",
      fileName: asset.fileName ?? null,
    });
    router.replace({ pathname: "/notes/[id]", params: { id: noteId } });
  }

  async function pickFile(): Promise<void> {
    const res = await DocumentPicker.getDocumentAsync({ multiple: false });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    const noteId = await newNote(asset.name ?? "Imported file");
    await saveAttachment({
      noteId,
      type: "file",
      sourceUri: asset.uri,
      mimeType: asset.mimeType ?? null,
      fileName: asset.name ?? null,
    });
    router.replace({ pathname: "/notes/[id]", params: { id: noteId } });
  }

  async function startRecording(): Promise<void> {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Permission needed", "Microphone access is required to record.");
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await rec.startAsync();
      setRecording(rec);
      setRecState("recording");
    } catch (e) {
      Alert.alert("Recording failed", (e as Error).message);
    }
  }

  async function stopRecording(): Promise<void> {
    if (!recording) return;
    setRecState("processing");
    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      if (!uri) throw new Error("no recording uri");
      const noteId = await newNote("Audio note");
      await saveAttachment({
        noteId,
        type: "audio",
        sourceUri: uri,
        mimeType: "audio/m4a",
        fileName: `audio_${Date.now()}.m4a`,
      });
      router.replace({ pathname: "/notes/[id]", params: { id: noteId } });
    } catch (e) {
      Alert.alert("Save failed", (e as Error).message);
    } finally {
      setRecording(null);
      setRecState("idle");
    }
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
    >
        <Text style={[typography.h2, { color: colors.text }]}>Add to your notebook</Text>
        <Text style={{ color: colors.muted, lineHeight: 20 }}>
          Everything is stored on-device first. Sync runs in the background when the API is
          reachable.
        </Text>

        <Pressable
          style={styles.button}
          onPress={() =>
            void newNote("New note").then((id) =>
              router.replace({ pathname: "/notes/[id]", params: { id } }),
            )
          }
        >
          <Text style={styles.buttonText}>Blank note</Text>
        </Pressable>

        <Pressable style={styles.button} onPress={() => void pickImage(true)}>
          <Text style={styles.buttonText}>Take photo</Text>
        </Pressable>

        <Pressable style={styles.button} onPress={() => void pickImage(false)}>
          <Text style={styles.buttonText}>Choose image</Text>
        </Pressable>

        <Pressable
          style={[styles.button, recState === "recording" && styles.buttonHot]}
          onPress={() => void (recState === "recording" ? stopRecording() : startRecording())}
          disabled={recState === "processing"}
        >
          <Text style={styles.buttonText}>
            {recState === "recording"
              ? "Stop recording"
              : recState === "processing"
                ? "Saving…"
                : "Record audio"}
          </Text>
        </Pressable>

        <Pressable style={styles.button} onPress={() => void pickFile()}>
          <Text style={styles.buttonText}>Import file</Text>
        </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
  },
  buttonHot: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  buttonText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
  },
});
