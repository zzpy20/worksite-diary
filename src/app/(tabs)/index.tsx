import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { formatSavedAt } from '@/lib/date-format';
import { listEntries } from '@/lib/entries';
import type { Entry } from '@/types/entry';

export default function HomeScreen() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await listEntries();
      setEntries(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

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
        <ThemedText type="title" style={styles.header}>
          Diary
        </ThemedText>

        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: BottomTabInset + Spacing.four }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
            />
          }
          ListEmptyComponent={
            <ThemedView style={styles.empty}>
              <ThemedText themeColor="textSecondary">
                No entries yet. Tap &quot;New Entry&quot; to log your first day.
              </ThemedText>
            </ThemedView>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => router.push(`/entry/${item.id}`)}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
              <ThemedView type="backgroundElement" style={styles.card}>
                {item.photo_urls[0] ? (
                  <Image source={{ uri: item.photo_urls[0] }} style={styles.thumb} />
                ) : (
                  <ThemedView type="backgroundSelected" style={styles.thumb} />
                )}
                <ThemedView style={styles.cardText} type="backgroundElement">
                  <ThemedText type="smallBold">{item.site || 'Untitled site'}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {item.date} · Saved {formatSavedAt(item.created_at)}
                  </ThemedText>
                  {item.tasks ? (
                    <ThemedText type="small" numberOfLines={1} themeColor="textSecondary">
                      {item.tasks}
                    </ThemedText>
                  ) : null}
                </ThemedView>
              </ThemedView>
            </Pressable>
          )}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three, paddingBottom: Spacing.two },
  listContent: { paddingHorizontal: Spacing.three, gap: Spacing.two },
  empty: { paddingHorizontal: Spacing.four, paddingTop: Spacing.six, alignItems: 'center' },
  row: { marginBottom: Spacing.two },
  pressed: { opacity: 0.7 },
  card: {
    flexDirection: 'row',
    borderRadius: Spacing.three,
    padding: Spacing.two,
    gap: Spacing.three,
    alignItems: 'center',
  },
  thumb: { width: 56, height: 56, borderRadius: Spacing.two },
  cardText: { flex: 1, gap: 2 },
});
