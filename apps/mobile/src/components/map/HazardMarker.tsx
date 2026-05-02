import { Marker } from "react-native-maps";
import type { Hazard } from "@cyaccess/shared";
import { SEVERITY_COLOR } from "@cyaccess/shared";
import { View, StyleSheet } from "react-native";

export function HazardMarker({ hazard, onPress }: { hazard: Hazard; onPress?: () => void }) {
  if (hazard.latitude == null || hazard.longitude == null) return null;
  const color = hazard.status === "resolved" ? "#9CA3AF" : SEVERITY_COLOR[hazard.severity];
  return (
    <Marker
      coordinate={{ latitude: hazard.latitude, longitude: hazard.longitude }}
      onPress={onPress}
      tracksViewChanges={false}
      anchor={{ x: 0.5, y: 0.5 }}
    >
      <View style={[styles.outer, { backgroundColor: `${color}33` }]}>
        <View style={[styles.inner, { backgroundColor: color }]} />
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  outer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  inner: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: "white" },
});
