import { useState } from 'react';
import { View, Text, Switch, StyleSheet, ScrollView } from 'react-native';
import { Link } from 'expo-router';
import { useApp } from '@/store';
import { colors, spacing, typography } from '@/theme';

export default function Settings() {
  const { aiEnabled, setAiEnabled } = useApp();
  const [offlineMode, setOfflineMode] = useState(false);
  const [autoSync, setAutoSync] = useState(true);

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
      <Text style={[typography.h2, { color: colors.text }]}>Settings</Text>
      
      <View style={styles.section}>
        <Text style={[typography.h3, { color: colors.text }]}>AI Settings</Text>
        <View style={styles.settingRow}>
          <Text style={{ color: colors.text }}>Enable AI Features</Text>
          <Switch 
            value={aiEnabled} 
            onValueChange={setAiEnabled}
            trackColor={{ false: colors.border, true: colors.accent }}
            thumbColor={aiEnabled ? '#fff' : '#f4f3f4'}
          />
        </View>
        <View style={styles.settingRow}>
          <Text style={{ color: colors.text }}>Offline Mode</Text>
          <Switch 
            value={offlineMode} 
            onValueChange={setOfflineMode}
            trackColor={{ false: colors.border, true: colors.accent }}
            thumbColor={offlineMode ? '#fff' : '#f4f3f4'}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[typography.h3, { color: colors.text }]}>Sync</Text>
        <View style={styles.settingRow}>
          <Text style={{ color: colors.text }}>Auto Sync</Text>
          <Switch 
            value={autoSync} 
            onValueChange={setAutoSync}
            trackColor={{ false: colors.border, true: colors.accent }}
            thumbColor={autoSync ? '#fff' : '#f4f3f4'}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[typography.h3, { color: colors.text }]}>About</Text>
        <Text style={{ color: colors.muted }}>StudyNest v0.1.0</Text>
        <Text style={{ color: colors.muted }}>AI-powered note taking</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: colors.panel,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
});