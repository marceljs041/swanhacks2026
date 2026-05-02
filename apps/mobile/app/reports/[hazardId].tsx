import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import * as Haptics from "expo-haptics";
import {
  HAZARD_TYPE_LABEL_KEYS,
  SEVERITY_COLOR,
} from "@cyaccess/shared";
import { Screen } from "../../src/components/ui/Screen";
import { Button } from "../../src/components/ui/Button";
import { Card } from "../../src/components/ui/Card";
import { LoadingState } from "../../src/components/ui/LoadingState";
import { colors } from "../../src/theme/colors";
import { radii } from "../../src/theme/spacing";
import {
  useHazard,
  useResolveHazard,
  useVoteHazard,
} from "../../src/lib/queries/hazards";

export default function HazardDetailScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { hazardId } = useLocalSearchParams<{ hazardId: string }>();
  const hazardQuery = useHazard(hazardId ?? null);
  const voteMutation = useVoteHazard();
  const resolveMutation = useResolveHazard();

  if (hazardQuery.isLoading || !hazardQuery.data?.hazard) {
    return (
      <Screen>
        <LoadingState label={t("common.loading")} />
      </Screen>
    );
  }
  const hazard = hazardQuery.data.hazard;

  const onVote = async (vote: "still_there" | "resolved") => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await voteMutation.mutateAsync({ id: hazard.id, vote });
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.headerRow}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Text style={styles.back}>‹ {t("common.back")}</Text>
          </Pressable>
          <View
            style={[
              styles.severityPill,
              { backgroundColor: SEVERITY_COLOR[hazard.severity] + "22", borderColor: SEVERITY_COLOR[hazard.severity] },
            ]}
          >
            <Text style={[styles.severityText, { color: SEVERITY_COLOR[hazard.severity] }]}>
              {t(`reports.severity.${hazard.severity}`)}
            </Text>
          </View>
        </View>

        <Text style={styles.title}>{t(HAZARD_TYPE_LABEL_KEYS[hazard.type])}</Text>

        {hazard.imageUrl ? (
          <Image source={{ uri: hazard.imageUrl }} style={styles.image} resizeMode="cover" />
        ) : null}

        <Card>
          <Text style={styles.sectionLabel}>Description</Text>
          <Text style={styles.body}>{hazard.description ?? "No description provided."}</Text>
          <View style={styles.sep} />
          <Text style={styles.meta}>Status: {hazard.status}</Text>
          {hazard.buildingId ? <Text style={styles.meta}>Building: {hazard.buildingId}</Text> : null}
          {hazard.floorId ? <Text style={styles.meta}>Floor: {hazard.floorId}</Text> : null}
          <Text style={styles.meta}>Reported: {new Date(hazard.createdAt).toLocaleString()}</Text>
        </Card>

        <View style={styles.actions}>
          <Button
            title={t("reports.stillThere")}
            variant="secondary"
            onPress={() => onVote("still_there")}
          />
          <Button
            title={t("reports.markResolved")}
            onPress={() => onVote("resolved")}
            loading={voteMutation.isPending}
          />
        </View>

        <Button
          title="Force resolve"
          variant="ghost"
          onPress={() => resolveMutation.mutate(hazard.id)}
          style={{ marginTop: 8 }}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, gap: 12, paddingBottom: 48 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  back: { color: colors.info, fontSize: 16, fontWeight: "700" },
  severityPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  severityText: { fontSize: 12, fontWeight: "800", textTransform: "uppercase" },
  title: { fontSize: 24, fontWeight: "800", color: colors.cycloneDark },
  image: { width: "100%", aspectRatio: 4 / 3, borderRadius: radii.lg },
  sectionLabel: {
    fontSize: 11,
    color: colors.muted,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  body: { fontSize: 15, color: colors.slate, marginTop: 4, lineHeight: 21 },
  sep: { height: 1, backgroundColor: "rgba(0,0,0,0.06)", marginVertical: 12 },
  meta: { fontSize: 13, color: colors.muted, marginBottom: 2 },
  actions: { flexDirection: "row", gap: 10, marginTop: 12 },
});
