import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { hoursBetween, parseISODate, startOfMonth, startOfWeek } from '@/lib/date-format';
import { listEntries } from '@/lib/entries';
import { useTheme } from '@/hooks/use-theme';
import type { Entry } from '@/types/entry';

type Period = 'week' | 'month';

export default function SummaryScreen() {
  const theme = useTheme();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('week');

  useEffect(() => {
    listEntries()
      .then(setEntries)
      .finally(() => setLoading(false));
  }, []);

  const { totalHours, bySite } = useMemo(() => {
    const now = new Date();
    const threshold = period === 'week' ? startOfWeek(now) : startOfMonth(now);
    const inRange = entries.filter((entry) => parseISODate(entry.date).getTime() >= threshold.getTime());

    let total = 0;
    const siteTotals = new Map<string, number>();
    for (const entry of inRange) {
      const hours = hoursBetween(entry.start_time, entry.finish_time);
      total += hours;
      const site = entry.site || 'Untitled site';
      siteTotals.set(site, (siteTotals.get(site) ?? 0) + hours);
    }

    return { totalHours: total, bySite: [...siteTotals.entries()].sort((a, b) => b[1] - a[1]) };
  }, [entries, period]);

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.flex} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content}>
          <BackButton />
          <ThemedText type="title" style={styles.header}>
            Hours Summary
          </ThemedText>

          <ThemedView style={styles.toggleRow}>
            {(['week', 'month'] as const).map((p) => (
              <Pressable
                key={p}
                onPress={() => setPeriod(p)}
                style={[styles.toggleButton, { backgroundColor: period === p ? '#208AEF' : theme.backgroundElement }]}>
                <ThemedText type="smallBold" themeColor={period === p ? 'background' : 'text'}>
                  {p === 'week' ? 'This Week' : 'This Month'}
                </ThemedText>
              </Pressable>
            ))}
          </ThemedView>

          <ThemedView type="backgroundElement" style={styles.totalCard}>
            <ThemedText type="small" themeColor="textSecondary">
              Total hours
            </ThemedText>
            <ThemedText type="subtitle">{totalHours.toFixed(1)}</ThemedText>
          </ThemedView>

          {bySite.length > 0 ? (
            <>
              <ThemedText type="smallBold" style={styles.sectionLabel}>
                By site
              </ThemedText>
              <ThemedView type="backgroundElement" style={styles.siteCard}>
                {bySite.map(([site, hours], index) => (
                  <ThemedView
                    key={site}
                    type="backgroundElement"
                    style={[styles.siteRow, index > 0 && styles.siteRowBorder]}>
                    <ThemedText style={styles.siteName} numberOfLines={1}>
                      {site}
                    </ThemedText>
                    <ThemedText themeColor="textSecondary">{hours.toFixed(1)}h</ThemedText>
                  </ThemedView>
                ))}
              </ThemedView>
            </>
          ) : (
            <ThemedText themeColor="textSecondary" style={styles.empty}>
              No entries with logged hours in this period.
            </ThemedText>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.four, paddingTop: Spacing.two, gap: Spacing.two },
  header: { marginBottom: Spacing.two },
  toggleRow: { flexDirection: 'row', gap: Spacing.two, marginBottom: Spacing.two },
  toggleButton: { flex: 1, borderRadius: Spacing.three, paddingVertical: Spacing.two, alignItems: 'center' },
  totalCard: { borderRadius: Spacing.three, padding: Spacing.four, gap: Spacing.one },
  sectionLabel: { marginTop: Spacing.three, marginLeft: Spacing.one },
  siteCard: { borderRadius: Spacing.three, overflow: 'hidden' },
  siteRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  siteRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(128,128,128,0.18)' },
  siteName: { flex: 1 },
  empty: { paddingTop: Spacing.four, textAlign: 'center' },
});
