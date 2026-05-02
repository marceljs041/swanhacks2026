import { useMemo, useRef } from "react";
import { Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import MapView, { PROVIDER_GOOGLE, Polygon, UrlTile } from "react-native-maps";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { ISU_CENTER, type Building } from "@cyaccess/shared";
import { colors } from "../../src/theme/colors";
import { useBuildings } from "../../src/lib/queries/buildings";
import { useHazards } from "../../src/lib/queries/hazards";
import { useMapStore } from "../../src/stores/map.store";
import { Chip } from "../../src/components/ui/Chip";
import { HazardMarker } from "../../src/components/map/HazardMarker";
import { BuildingSheet, type BuildingSheetHandle } from "../../src/components/map/BuildingSheet";
import { FloatingButton } from "../../src/components/map/FloatingButton";

const MAP_FILTERS = [
  { key: "hazards", label: "map.filter.hazards" },
  { key: "elevators", label: "map.filter.elevators" },
  { key: "entrances", label: "map.filter.entrances" },
  { key: "restrooms", label: "map.filter.restrooms" },
  { key: "routes", label: "map.filter.routes" },
] as const;

export default function MapScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const buildingsQuery = useBuildings();
  const hazardsQuery = useHazards();
  const { selectedBuildingId, selectBuilding, activeFilters, toggleFilter } = useMapStore();
  const sheetRef = useRef<BuildingSheetHandle>(null);

  const selectedBuilding =
    buildingsQuery.data?.buildings.find((b) => b.id === selectedBuildingId) ?? null;

  const hazardsHere = useMemo(() => {
    if (!selectedBuilding) return [];
    return (hazardsQuery.data?.hazards ?? []).filter(
      (h) => h.buildingId === selectedBuilding.id,
    );
  }, [hazardsQuery.data, selectedBuilding]);

  const visibleHazards = activeFilters.has("hazards")
    ? hazardsQuery.data?.hazards ?? []
    : [];

  const onBuildingTap = (b: Building) => {
    selectBuilding(b.id);
    sheetRef.current?.expand();
  };

  return (
    <View style={styles.root}>
      <MapView
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
        style={StyleSheet.absoluteFillObject}
        initialRegion={{
          latitude: ISU_CENTER.latitude,
          longitude: ISU_CENTER.longitude,
          latitudeDelta: 0.008,
          longitudeDelta: 0.008,
        }}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
      >
        {Platform.OS === "ios" ? null : (
          <UrlTile urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} />
        )}

        {(buildingsQuery.data?.buildings ?? []).map((b) => (
          <Polygon
            key={b.id}
            coordinates={b.polygon}
            onPress={() => onBuildingTap(b)}
            tappable
            fillColor={
              selectedBuildingId === b.id
                ? "rgba(200,16,46,0.35)"
                : b.hasIndoorMap
                ? "rgba(241,190,72,0.35)"
                : "rgba(107,114,128,0.25)"
            }
            strokeColor={colors.cardinal}
            strokeWidth={2}
          />
        ))}

        {visibleHazards.map((h) => (
          <HazardMarker
            key={h.id}
            hazard={h}
            onPress={() => router.push(`/reports/${h.id}`)}
          />
        ))}
      </MapView>

      {/* Top search + filter chips */}
      <View style={styles.header} pointerEvents="box-none">
        <View style={styles.searchWrap}>
          <TextInput
            placeholder={t("map.search.placeholder")}
            placeholderTextColor={colors.muted}
            style={styles.search}
          />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {MAP_FILTERS.map((f) => (
            <Chip
              key={f.key}
              label={t(f.label)}
              selected={activeFilters.has(f.key)}
              onPress={() => toggleFilter(f.key)}
            />
          ))}
        </ScrollView>
      </View>

      {/* Floating actions */}
      <View style={styles.fabStack} pointerEvents="box-none">
        <FloatingButton
          label={t("map.askCy")}
          icon="💬"
          variant="secondary"
          onPress={() => router.push("/(tabs)/ask")}
          style={{ marginBottom: 10 }}
        />
        <FloatingButton
          label={t("map.reportHazard")}
          icon="⚠"
          onPress={() => router.push("/reports/new")}
        />
      </View>

      <BuildingSheet
        ref={sheetRef}
        building={selectedBuilding}
        hazardsHere={hazardsHere}
        onClose={() => selectBuilding(null)}
      />

      {buildingsQuery.isLoading ? (
        <View style={styles.loadingBanner}>
          <Text style={styles.loadingText}>{t("common.loading")}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.cream },
  header: {
    position: "absolute",
    top: 50,
    left: 12,
    right: 12,
    gap: 10,
  },
  searchWrap: {
    backgroundColor: colors.offWhite,
    borderRadius: 999,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  search: { height: 44, fontSize: 16, color: colors.slate },
  chipRow: { gap: 8, paddingRight: 20 },
  fabStack: {
    position: "absolute",
    right: 16,
    bottom: 24,
    alignItems: "flex-end",
  },
  loadingBanner: {
    position: "absolute",
    top: 10,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  loadingText: { color: "white", fontSize: 12 },
});
