import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import type { IndoorPath } from "@cyaccess/shared";
import { Screen } from "../../src/components/ui/Screen";
import { Button } from "../../src/components/ui/Button";
import { LoadingState } from "../../src/components/ui/LoadingState";
import { colors } from "../../src/theme/colors";
import { radii, tap } from "../../src/theme/spacing";
import { useBuilding, useIndoorFloor } from "../../src/lib/queries/buildings";
import { useHazards } from "../../src/lib/queries/hazards";
import { useMapStore } from "../../src/stores/map.store";
import { usePreferences } from "../../src/stores/preferences.store";
import { IndoorRenderer } from "../../src/components/indoor/IndoorRenderer";
import { PointLegend } from "../../src/components/indoor/PointLegend";
import { speak } from "../../src/lib/speech";

export default function BuildingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { buildingId } = useLocalSearchParams<{ buildingId: string }>();
  const buildingQuery = useBuilding(buildingId ?? null);
  const language = usePreferences((s) => s.language);
  const prefs = usePreferences((s) => s.accessibility);

  const { selectedFloorId, selectFloor, selectedIndoorPointId, selectIndoorPoint } =
    useMapStore();

  const building = buildingQuery.data?.building;
  const indoor = buildingQuery.data?.indoor;
  const [floorId, setFloorId] = useState<string | null>(null);

  useEffect(() => {
    if (!building) return;
    const next = selectedFloorId && building.floors.includes(selectedFloorId)
      ? selectedFloorId
      : building.floors[0] ?? null;
    setFloorId(next);
    selectFloor(next ?? null);
  }, [building?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const floorQuery = useIndoorFloor(buildingId ?? null, floorId);
  const hazardsQuery = useHazards({ buildingId: buildingId ?? undefined, floorId: floorId ?? undefined });

  const selectedPoint = useMemo(() => {
    if (!selectedIndoorPointId || !floorQuery.data?.floor) return null;
    return floorQuery.data.floor.rooms.find((p) => p.id === selectedIndoorPointId) ?? null;
  }, [selectedIndoorPointId, floorQuery.data]);

  const selectedRoute: IndoorPath | null = useMemo(() => {
    if (!floorQuery.data?.floor || !selectedPoint) return null;
    const candidates = floorQuery.data.floor.paths.filter((p) =>
      p.points.some((pt) => Math.abs(pt.x - selectedPoint.x) < 2 && Math.abs(pt.y - selectedPoint.y) < 2),
    );
    if (candidates.length === 0) return null;
    // Prefer accessible routes if the user needs them.
    return (
      candidates.find((p) => p.accessible && (prefs.avoidStairs || prefs.preferAccessibleEntrances)) ??
      candidates[0] ??
      null
    );
  }, [floorQuery.data, selectedPoint, prefs]);

  if (buildingQuery.isLoading || !building) {
    return (
      <Screen>
        <LoadingState label={t("common.loading")} />
      </Screen>
    );
  }

  const readDirections = () => {
    if (!selectedPoint) return;
    const phrase = `Route to ${selectedPoint.label}. Use elevator when available. Watch for active hazards.`;
    speak(phrase, { language });
  };

  return (
    <Screen edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button">
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {building.name}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.body}>
        {floorQuery.isLoading || !floorQuery.data?.floor ? (
          <LoadingState label={t("loading.route")} />
        ) : (
          <>
            <View style={styles.renderRow}>
              <IndoorRenderer
                floor={floorQuery.data.floor}
                hazards={hazardsQuery.data?.hazards ?? []}
                selectedPointId={selectedIndoorPointId}
                onSelectPoint={selectIndoorPoint}
                route={selectedRoute}
              />

              {/* Floor selector on the right */}
              <ScrollView contentContainerStyle={styles.floorStack}>
                {building.floors.map((f) => {
                  const active = f === floorId;
                  return (
                    <Pressable
                      key={f}
                      onPress={() => {
                        setFloorId(f);
                        selectFloor(f);
                        selectIndoorPoint(null);
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      style={[styles.floorChip, active && styles.floorChipActive]}
                    >
                      <Text style={[styles.floorChipText, active && styles.floorChipTextActive]}>
                        {f}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>

            <PointLegend />

            {selectedPoint ? (
              <View style={styles.detailCard}>
                <Text style={styles.detailTitle}>{selectedPoint.label}</Text>
                <Text style={styles.detailMeta}>
                  {t(`building.point.${selectedPoint.type}`)}
                  {selectedPoint.accessible ? " · ♿ Accessible" : ""}
                </Text>
                <View style={styles.detailBtns}>
                  <Button title={t("building.routeHere")} onPress={() => {}} />
                  <Button
                    title={t("building.readDirections")}
                    variant="secondary"
                    onPress={readDirections}
                  />
                </View>
              </View>
            ) : null}
          </>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.06)",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.offWhite,
  },
  backText: { fontSize: 26, color: colors.cardinal, lineHeight: 28, fontWeight: "700" },
  title: { flex: 1, textAlign: "center", fontSize: 18, fontWeight: "700", color: colors.slate },
  body: { flex: 1, paddingTop: 16, gap: 12 },
  renderRow: { flexDirection: "row", paddingHorizontal: 12, gap: 8 },
  floorStack: { gap: 8, alignItems: "center" },
  floorChip: {
    minWidth: tap.minSize,
    height: tap.minSize,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.offWhite,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },
  floorChipActive: { backgroundColor: colors.cardinal, borderColor: colors.cardinal },
  floorChipText: { fontSize: 16, fontWeight: "700", color: colors.slate },
  floorChipTextActive: { color: "white" },
  detailCard: {
    marginHorizontal: 12,
    padding: 16,
    backgroundColor: colors.offWhite,
    borderRadius: radii.lg,
    gap: 8,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
    elevation: 3,
  },
  detailTitle: { fontSize: 18, fontWeight: "800", color: colors.cycloneDark },
  detailMeta: { fontSize: 13, color: colors.muted },
  detailBtns: { flexDirection: "row", gap: 10, marginTop: 8, flexWrap: "wrap" },
});
