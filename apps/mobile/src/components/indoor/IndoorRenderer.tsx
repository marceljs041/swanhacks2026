import { Circle, G, Polyline, Rect, Svg, Text as SvgText } from "react-native-svg";
import type { Hazard, IndoorFloor, IndoorPath, IndoorPoint } from "@cyaccess/shared";
import { SEVERITY_COLOR } from "@cyaccess/shared";
import { Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { colors } from "../../theme/colors";

const POINT_COLORS: Record<IndoorPoint["type"], string> = {
  entrance: "#16A34A",
  elevator: "#2563EB",
  stairs: "#D97706",
  restroom: "#7C3AED",
  room: "#1F2937",
  study: "#0EA5E9",
  help_desk: "#EA580C",
  hazard: "#DC2626",
};

const POINT_GLYPH: Record<IndoorPoint["type"], string> = {
  entrance: "E",
  elevator: "⇅",
  stairs: "≡",
  restroom: "R",
  room: "#",
  study: "S",
  help_desk: "?",
  hazard: "!",
};

export function IndoorRenderer({
  floor,
  hazards,
  selectedPointId,
  onSelectPoint,
  route,
}: {
  floor: IndoorFloor;
  hazards: Hazard[];
  selectedPointId: string | null;
  onSelectPoint: (id: string | null) => void;
  route?: IndoorPath | null;
}) {
  const dims = useWindowDimensions();
  const size = Math.min(dims.width - 24, dims.height - 260);

  return (
    <View style={{ width: size, height: size, alignSelf: "center" }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        {/* Floor outline */}
        <Rect x={1} y={1} width={98} height={98} rx={4} ry={4} fill={colors.offWhite} stroke={colors.muted} strokeWidth={0.5} />

        {/* Paths */}
        {floor.paths.map((p) => (
          <Polyline
            key={p.id}
            points={p.points.map((pt) => `${pt.x},${pt.y}`).join(" ")}
            fill="none"
            stroke={p.accessible ? "#22C55E" : "#9CA3AF"}
            strokeWidth={0.8}
            strokeOpacity={0.5}
            strokeDasharray={p.accessible ? undefined : "2,1.5"}
          />
        ))}

        {/* Highlighted route */}
        {route ? (
          <Polyline
            points={route.points.map((pt) => `${pt.x},${pt.y}`).join(" ")}
            fill="none"
            stroke={colors.cardinal}
            strokeWidth={1.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}

        {/* Points */}
        {floor.rooms.map((pt) => {
          const isSelected = selectedPointId === pt.id;
          return (
            <G key={pt.id}>
              <Circle
                cx={pt.x}
                cy={pt.y}
                r={isSelected ? 3.2 : 2.4}
                fill={POINT_COLORS[pt.type]}
                stroke="white"
                strokeWidth={0.6}
                onPress={() => onSelectPoint(pt.id)}
              />
              <SvgText
                x={pt.x}
                y={pt.y + 0.8}
                fill="white"
                fontSize={2}
                fontWeight="bold"
                textAnchor="middle"
              >
                {POINT_GLYPH[pt.type]}
              </SvgText>
              {isSelected ? (
                <SvgText
                  x={pt.x}
                  y={pt.y - 4}
                  fill={colors.slate}
                  fontSize={2.2}
                  fontWeight="600"
                  textAnchor="middle"
                >
                  {pt.label}
                </SvgText>
              ) : null}
            </G>
          );
        })}

        {/* Hazards */}
        {hazards
          .filter((h) => h.indoorX != null && h.indoorY != null)
          .map((h) => (
            <G key={h.id}>
              <Circle
                cx={h.indoorX!}
                cy={h.indoorY!}
                r={3.6}
                fill={SEVERITY_COLOR[h.severity]}
                fillOpacity={0.3}
              />
              <Circle
                cx={h.indoorX!}
                cy={h.indoorY!}
                r={2}
                fill={SEVERITY_COLOR[h.severity]}
                stroke="white"
                strokeWidth={0.5}
              />
            </G>
          ))}
      </Svg>

      {/* Tap-off overlay to close selection */}
      {selectedPointId ? (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => onSelectPoint(null)}
          pointerEvents="box-only"
        />
      ) : null}
    </View>
  );
}
