import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import {
  HAZARD_TYPES,
  HAZARD_TYPE_LABEL_KEYS,
  SEVERITY_COLOR,
  type Hazard,
  type HazardType,
} from "@cyaccess/shared";
import { useState } from "react";
import { Screen } from "../../src/components/ui/Screen";
import { EmptyState } from "../../src/components/ui/EmptyState";
import { LoadingState } from "../../src/components/ui/LoadingState";
import { Chip } from "../../src/components/ui/Chip";
import { Button } from "../../src/components/ui/Button";
import { colors } from "../../src/theme/colors";
import { radii } from "../../src/theme/spacing";
import { useHazards, useResolveHazard } from "../../src/lib/queries/hazards";

export default function ReportsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [typeFilter, setTypeFilter] = useState<HazardType | null>(null);
  const hazardsQuery = useHazards();
  const resolveMutation = useResolveHazard();

  const hazards = (hazardsQuery.data?.hazards ?? []).filter((h) =>
    typeFilter ? h.type === typeFilter : true,
  );

  const renderItem = ({ item }: { item: Hazard }) => (
    <Pressable
      onPress={() => router.push(`/reports/${item.id}`)}
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.8 }]}
    >
      <View
        style={[
          styles.severityBar,
          { backgroundColor: item.status === "resolved" ? colors.muted : SEVERITY_COLOR[item.severity] },
        ]}
      />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={styles.cardTitle}>{t(HAZARD_TYPE_LABEL_KEYS[item.type])}</Text>
        {item.description ? (
          <Text style={styles.cardBody} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}
        <View style={styles.cardMeta}>
          <Text style={styles.metaBadge}>{t(`reports.severity.${item.severity}`)}</Text>
          {item.buildingId ? <Text style={styles.metaText}>· {item.buildingId}</Text> : null}
          {item.floorId ? <Text style={styles.metaText}>· fl {item.floorId}</Text> : null}
        </View>
      </View>
      <Button
        title={t("reports.markResolved")}
        variant="ghost"
        onPress={() => resolveMutation.mutate(item.id)}
        style={{ alignSelf: "center" }}
      />
    </Pressable>
  );

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>{t("reports.title")}</Text>
      </View>

      <FlatList
        data={hazards}
        keyExtractor={(h) => h.id}
        renderItem={renderItem}
        ListHeaderComponent={
          <View style={styles.chipRow}>
            <Chip label="All" selected={typeFilter === null} onPress={() => setTypeFilter(null)} />
            {HAZARD_TYPES.slice(0, 6).map((tp) => (
              <Chip
                key={tp}
                label={t(HAZARD_TYPE_LABEL_KEYS[tp])}
                selected={typeFilter === tp}
                onPress={() => setTypeFilter(typeFilter === tp ? null : tp)}
              />
            ))}
          </View>
        }
        ListEmptyComponent={
          hazardsQuery.isLoading ? (
            <LoadingState label={t("loading.hazards")} />
          ) : (
            <EmptyState title={t("reports.empty")} />
          )
        }
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={hazardsQuery.isFetching}
            onRefresh={() => hazardsQuery.refetch()}
            tintColor={colors.cardinal}
          />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { padding: 20, paddingBottom: 0 },
  title: { fontSize: 28, fontWeight: "800", color: colors.cycloneDark },
  list: { padding: 16, gap: 10, flexGrow: 1 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  card: {
    flexDirection: "row",
    gap: 12,
    padding: 12,
    backgroundColor: colors.offWhite,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  severityBar: { width: 6, borderRadius: 3, alignSelf: "stretch" },
  cardTitle: { fontSize: 16, fontWeight: "700", color: colors.slate },
  cardBody: { fontSize: 13, color: colors.muted },
  cardMeta: { flexDirection: "row", gap: 4, alignItems: "center", marginTop: 2 },
  metaBadge: {
    fontSize: 11,
    fontWeight: "800",
    color: colors.cycloneDark,
    backgroundColor: colors.gold,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    textTransform: "uppercase",
  },
  metaText: { fontSize: 12, color: colors.muted },
});
