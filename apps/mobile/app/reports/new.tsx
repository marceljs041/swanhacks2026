import { useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  HAZARD_SEVERITIES,
  HAZARD_TYPES,
  HAZARD_TYPE_LABEL_KEYS,
  type AiHazardSuggestion,
  type HazardSeverity,
  type HazardType,
} from "@cyaccess/shared";
import { Screen } from "../../src/components/ui/Screen";
import { Button } from "../../src/components/ui/Button";
import { Card } from "../../src/components/ui/Card";
import { Chip } from "../../src/components/ui/Chip";
import { colors } from "../../src/theme/colors";
import { radii } from "../../src/theme/spacing";
import {
  useClassifyHazard,
  useCreateHazard,
  useHazardUpload,
} from "../../src/lib/queries/hazards";
import { uploadLocalImage } from "../../src/lib/image-upload";
import { useMapStore } from "../../src/stores/map.store";

export default function NewReportScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { selectedBuildingId, selectedFloorId } = useMapStore();

  const [localImage, setLocalImage] = useState<string | null>(null);
  const [publicImageUrl, setPublicImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [suggestion, setSuggestion] = useState<AiHazardSuggestion | null>(null);
  const [type, setType] = useState<HazardType>("other");
  const [severity, setSeverity] = useState<HazardSeverity>("medium");
  const [description, setDescription] = useState("");

  const uploadMutation = useHazardUpload();
  const classifyMutation = useClassifyHazard();
  const createMutation = useCreateHazard();

  const pickImage = async (source: "camera" | "library") => {
    const res =
      source === "camera"
        ? await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: false })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.7, mediaTypes: ImagePicker.MediaTypeOptions.Images });

    if (res.canceled || !res.assets[0]) return;
    const uri = res.assets[0].uri;
    setLocalImage(uri);

    try {
      setUploading(true);
      const signed = await uploadMutation.mutateAsync();
      const publicUrl = await uploadLocalImage(uri, signed);
      setPublicImageUrl(publicUrl);

      // Fire classification asynchronously.
      try {
        const result = await classifyMutation.mutateAsync({
          imageUrl: publicUrl,
          buildingId: selectedBuildingId,
          floorId: selectedFloorId,
        });
        setSuggestion(result.suggestion);
        setType(result.suggestion.type);
        setSeverity(result.suggestion.severity);
        if (!description) setDescription(result.suggestion.suggestedDescription);
      } catch {
        // AI unavailable — user will fill in manually.
      }
    } catch (err) {
      Alert.alert("Upload failed", (err as Error).message ?? "Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const submit = async () => {
    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await createMutation.mutateAsync({
        type,
        severity,
        description: description || null,
        imageUrl: publicImageUrl,
        aiConfidence: suggestion?.confidence ?? null,
        buildingId: selectedBuildingId,
        floorId: selectedFloorId,
      });
      router.back();
    } catch (err) {
      Alert.alert(t("common.error"), (err as Error).message ?? "");
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.headerRow}>
          <Text style={styles.title}>{t("reports.new.title")}</Text>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.close}>✕</Text>
          </Pressable>
        </View>

        {/* Photo */}
        <Card>
          {localImage ? (
            <View style={styles.photoWrap}>
              <Image source={{ uri: localImage }} style={styles.photo} resizeMode="cover" />
              <Pressable
                onPress={() => {
                  setLocalImage(null);
                  setPublicImageUrl(null);
                  setSuggestion(null);
                }}
                style={styles.clearPhoto}
              >
                <Text style={{ color: "white", fontWeight: "700" }}>Remove</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.photoButtons}>
              <Button title={t("reports.new.takePhoto")} onPress={() => pickImage("camera")} />
              <Button
                title={t("reports.new.pickPhoto")}
                variant="secondary"
                onPress={() => pickImage("library")}
              />
            </View>
          )}
          {uploading ? <Text style={styles.hint}>Uploading…</Text> : null}
        </Card>

        {/* AI suggestion */}
        {suggestion ? (
          <Card style={{ backgroundColor: "#FFF2F3", borderColor: colors.cardinal }}>
            <Text style={styles.aiTitle}>
              {t("reports.new.aiSuggestion", {
                type: t(HAZARD_TYPE_LABEL_KEYS[suggestion.type]).toLowerCase(),
              })}
            </Text>
            <Text style={styles.aiMeta}>
              {t("reports.new.confidence", { percent: Math.round(suggestion.confidence * 100) })}
            </Text>
          </Card>
        ) : null}

        {/* Type */}
        <Text style={styles.label}>{t("reports.new.typeLabel")}</Text>
        <View style={styles.chipWrap}>
          {HAZARD_TYPES.map((tp) => (
            <Chip
              key={tp}
              label={t(HAZARD_TYPE_LABEL_KEYS[tp])}
              selected={type === tp}
              onPress={() => setType(tp)}
            />
          ))}
        </View>

        {/* Severity */}
        <Text style={styles.label}>{t("reports.new.severityLabel")}</Text>
        <View style={styles.chipWrap}>
          {HAZARD_SEVERITIES.map((sv) => (
            <Chip
              key={sv}
              label={t(`reports.severity.${sv}`)}
              selected={severity === sv}
              onPress={() => setSeverity(sv)}
            />
          ))}
        </View>

        {/* Description */}
        <Text style={styles.label}>{t("reports.new.descriptionLabel")}</Text>
        <TextInput
          multiline
          value={description}
          onChangeText={setDescription}
          placeholder="Describe what you see…"
          placeholderTextColor={colors.muted}
          style={styles.textarea}
        />

        <Button
          title={t("reports.new.submit")}
          onPress={submit}
          loading={createMutation.isPending}
          fullWidth
          style={{ marginTop: 8 }}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, gap: 12, paddingBottom: 48 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 24, fontWeight: "800", color: colors.cycloneDark },
  close: { fontSize: 22, color: colors.slate, fontWeight: "700" },
  photoButtons: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  photoWrap: { position: "relative" },
  photo: { width: "100%", aspectRatio: 4 / 3, borderRadius: radii.md },
  clearPhoto: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  hint: { fontSize: 12, color: colors.muted, marginTop: 8 },
  aiTitle: { fontSize: 14, fontWeight: "700", color: colors.cardinal },
  aiMeta: { fontSize: 12, color: colors.slate, marginTop: 2 },
  label: {
    fontSize: 12,
    color: colors.muted,
    textTransform: "uppercase",
    fontWeight: "700",
    marginTop: 8,
  },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  textarea: {
    minHeight: 90,
    backgroundColor: colors.offWhite,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    borderRadius: radii.md,
    padding: 12,
    fontSize: 15,
    color: colors.slate,
    textAlignVertical: "top",
  },
});
