import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import BottomSheet, { BottomSheetView } from "@gorhom/bottom-sheet";
import { useTranslation } from "react-i18next";
import type { Building, Hazard } from "@cyaccess/shared";
import { useRouter } from "expo-router";
import { Button } from "../ui/Button";
import { Chip } from "../ui/Chip";
import { colors } from "../../theme/colors";

export type BuildingSheetHandle = {
  expand: () => void;
  collapse: () => void;
};

type Props = {
  building: Building | null;
  hazardsHere: Hazard[];
  onClose: () => void;
};

export const BuildingSheet = forwardRef<BuildingSheetHandle, Props>(
  ({ building, hazardsHere, onClose }, ref) => {
    const { t } = useTranslation();
    const sheetRef = useRef<BottomSheet>(null);
    const router = useRouter();
    const snapPoints = useMemo(() => ["30%", "60%"], []);

    useImperativeHandle(ref, () => ({
      expand: () => sheetRef.current?.expand(),
      collapse: () => sheetRef.current?.close(),
    }));

    return (
      <BottomSheet
        ref={sheetRef}
        index={building ? 0 : -1}
        snapPoints={snapPoints}
        enablePanDownToClose
        onClose={onClose}
        backgroundStyle={{ backgroundColor: colors.offWhite }}
        handleIndicatorStyle={{ backgroundColor: colors.muted }}
      >
        <BottomSheetView style={styles.content}>
          {building ? (
            <>
              <Text style={styles.name}>{building.name}</Text>
              <View style={styles.chipRow}>
                {building.badges.map((badge) => (
                  <Chip key={badge} label={badge} selected />
                ))}
              </View>
              <Text style={styles.hazards}>
                {t("map.building.activeHazards", { count: hazardsHere.length })}
              </Text>
              <View style={styles.actions}>
                {building.hasIndoorMap ? (
                  <Button
                    title={t("map.building.openIndoor")}
                    onPress={() => router.push(`/building/${building.id}`)}
                    fullWidth
                  />
                ) : (
                  <Text style={styles.noIndoor}>{t("map.building.noIndoor")}</Text>
                )}
              </View>
            </>
          ) : null}
        </BottomSheetView>
      </BottomSheet>
    );
  },
);
BuildingSheet.displayName = "BuildingSheet";

const styles = StyleSheet.create({
  content: { padding: 20, gap: 12 },
  name: { fontSize: 22, fontWeight: "800", color: colors.cycloneDark },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  hazards: { fontSize: 14, color: colors.slate, marginTop: 4 },
  actions: { marginTop: 12 },
  noIndoor: { fontSize: 14, color: colors.muted, textAlign: "center", paddingVertical: 12 },
});
