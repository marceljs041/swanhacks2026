import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Screen } from "../../../src/components/ui/Screen";
import { Button } from "../../../src/components/ui/Button";
import { EmptyState } from "../../../src/components/ui/EmptyState";
import { Card } from "../../../src/components/ui/Card";
import { colors } from "../../../src/theme/colors";
import { useNotes } from "../../../src/stores/notes.store";
import { usePreferences } from "../../../src/stores/preferences.store";
import { speak, stopSpeech } from "../../../src/lib/speech";
import { useTranslate } from "../../../src/lib/queries/ai";

export default function NoteScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { noteId } = useLocalSearchParams<{ noteId: string }>();
  const note = useNotes((s) => s.notes.find((n) => n.id === noteId));
  const update = useNotes((s) => s.update);
  const remove = useNotes((s) => s.remove);
  const language = usePreferences((s) => s.language);
  const voiceRate = usePreferences((s) => s.voiceRate);
  const translateMutation = useTranslate();

  if (!note) {
    return (
      <Screen>
        <EmptyState title="Note not found" />
      </Screen>
    );
  }

  const doTranslate = async () => {
    const res = await translateMutation.mutateAsync({
      text: note.text,
      targetLanguage: language,
    });
    update(note.id, { translatedText: res.translated, translationLanguage: language });
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.back}>‹ {t("common.back")}</Text>
          </Pressable>
          <Pressable onPress={() => { remove(note.id); router.back(); }} hitSlop={12}>
            <Text style={styles.delete}>Delete</Text>
          </Pressable>
        </View>

        {note.imageUri ? (
          <Image source={{ uri: note.imageUri }} style={styles.image} resizeMode="cover" />
        ) : null}

        <Card>
          <Text style={styles.sectionLabel}>Extracted text</Text>
          <Text style={styles.text}>{note.text || "(No text extracted)"}</Text>
        </Card>

        {note.translatedText ? (
          <Card style={{ backgroundColor: "#FFF2F3", borderColor: colors.cardinal }}>
            <Text style={styles.sectionLabel}>Translation · {note.translationLanguage}</Text>
            <Text style={styles.text}>{note.translatedText}</Text>
          </Card>
        ) : null}

        <View style={styles.actions}>
          <Button
            title={t("classroom.readAloud")}
            onPress={() =>
              speak(note.translatedText || note.text, { language, rate: voiceRate })
            }
          />
          <Button title={t("ask.tts.stop")} variant="ghost" onPress={stopSpeech} />
          <Button
            title={t("classroom.translate")}
            variant="secondary"
            onPress={doTranslate}
            loading={translateMutation.isPending}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, gap: 12, paddingBottom: 40 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  back: { fontSize: 16, color: colors.info, fontWeight: "700" },
  delete: { fontSize: 14, color: colors.danger, fontWeight: "700" },
  image: { width: "100%", aspectRatio: 4 / 3, borderRadius: 16 },
  sectionLabel: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  text: { fontSize: 15, color: colors.slate, marginTop: 6, lineHeight: 22 },
  actions: { flexDirection: "row", gap: 10, flexWrap: "wrap", marginTop: 8 },
});
