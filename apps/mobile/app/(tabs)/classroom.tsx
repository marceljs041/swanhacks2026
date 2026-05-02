import { useState } from "react";
import {
  Alert,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Crypto from "expo-crypto";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Screen } from "../../src/components/ui/Screen";
import { Card } from "../../src/components/ui/Card";
import { Button } from "../../src/components/ui/Button";
import { EmptyState } from "../../src/components/ui/EmptyState";
import { colors } from "../../src/theme/colors";
import { radii } from "../../src/theme/spacing";
import { useBoardUpload, useExtractBoardText } from "../../src/lib/queries/ai";
import { uploadLocalImage } from "../../src/lib/image-upload";
import { useNotes } from "../../src/stores/notes.store";

export default function ClassroomScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const notes = useNotes((s) => s.notes);
  const addNote = useNotes((s) => s.add);
  const uploadMutation = useBoardUpload();
  const extractMutation = useExtractBoardText();
  const [busy, setBusy] = useState(false);

  const capture = async (source: "camera" | "library") => {
    const res =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({
            quality: 0.8,
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
          });
    if (res.canceled || !res.assets[0]) return;
    const uri = res.assets[0].uri;

    try {
      setBusy(true);
      const signed = await uploadMutation.mutateAsync();
      const publicUrl = await uploadLocalImage(uri, signed);
      const { result } = await extractMutation.mutateAsync(publicUrl);

      const id = Crypto.randomUUID();
      addNote({
        id,
        createdAt: new Date().toISOString(),
        imageUri: uri,
        text: result.text,
        language: result.language,
      });
      router.push(`/classroom/note/${id}`);
    } catch (err) {
      Alert.alert(t("common.error"), (err as Error).message ?? "");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>{t("classroom.title")}</Text>
      </View>

      <View style={styles.actions}>
        <Button
          title={t("classroom.takePhoto")}
          onPress={() => capture("camera")}
          loading={busy}
          fullWidth
        />
        <Button
          title={t("classroom.pickPhoto")}
          variant="secondary"
          onPress={() => capture("library")}
          fullWidth
          style={{ marginTop: 8 }}
        />
      </View>

      <Text style={styles.sectionLabel}>{t("classroom.saved")}</Text>

      <FlatList
        data={notes}
        keyExtractor={(n) => n.id}
        ListEmptyComponent={<EmptyState title={t("classroom.empty")} />}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable onPress={() => router.push(`/classroom/note/${item.id}`)}>
            <Card style={styles.noteCard}>
              {item.imageUri ? (
                <Image source={{ uri: item.imageUri }} style={styles.noteThumb} />
              ) : null}
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.noteText} numberOfLines={3}>
                  {item.text || "(No text extracted)"}
                </Text>
                <Text style={styles.noteDate}>
                  {new Date(item.createdAt).toLocaleString()}
                </Text>
              </View>
            </Card>
          </Pressable>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { padding: 20, paddingBottom: 4 },
  title: { fontSize: 26, fontWeight: "800", color: colors.cycloneDark },
  actions: { paddingHorizontal: 20, paddingBottom: 12 },
  sectionLabel: {
    paddingHorizontal: 20,
    fontSize: 12,
    color: colors.muted,
    textTransform: "uppercase",
    fontWeight: "800",
    marginTop: 8,
    marginBottom: 4,
  },
  list: { padding: 16, gap: 10 },
  noteCard: { flexDirection: "row", gap: 12 },
  noteThumb: { width: 64, height: 64, borderRadius: radii.md },
  noteText: { fontSize: 14, color: colors.slate, lineHeight: 18 },
  noteDate: { fontSize: 12, color: colors.muted, marginTop: 4 },
});
