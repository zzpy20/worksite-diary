import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Platform, Pressable, RefreshControl, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { formatSavedAt, parseISODate } from '@/lib/date-format';
import { listEntries } from '@/lib/entries';
import { useTheme } from '@/hooks/use-theme';
import type { Entry } from '@/types/entry';

const GRID_COLUMNS = 2;
const GRID_PLACEHOLDER_ID = '__placeholder__';

type ListItem = Entry | { id: typeof GRID_PLACEHOLDER_ID };

function isPlaceholder(item: ListItem): item is { id: typeof GRID_PLACEHOLDER_ID } {
  return item.id === GRID_PLACEHOLDER_ID;
}

function formatDateShort(iso: string): string {
  return parseISODate(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export default function HomeScreen() {
  const theme = useTheme();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [jumpDate, setJumpDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const listRef = useRef<FlatList<ListItem>>(null);

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

  const query = searchQuery.trim().toLowerCase();
  const filteredEntries = query
    ? entries.filter((entry) => entry.site.toLowerCase().includes(query) || (entry.tasks ?? '').toLowerCase().includes(query))
    : entries;

  function jumpToDate(target: Date) {
    if (filteredEntries.length === 0) return;
    const targetTime = target.getTime();
    let closestIndex = 0;
    let closestDiff = Infinity;
    filteredEntries.forEach((entry, index) => {
      const diff = Math.abs(parseISODate(entry.date).getTime() - targetTime);
      if (diff < closestDiff) {
        closestDiff = diff;
        closestIndex = index;
      }
    });
    listRef.current?.scrollToIndex({ index: closestIndex, animated: true, viewPosition: 0.3 });
  }

  function handleDatePicked(selected?: Date) {
    if (!selected) return;
    setJumpDate(selected);
    jumpToDate(selected);
  }

  function openAndroidDatePicker() {
    DateTimePickerAndroid.open({
      value: jumpDate,
      mode: 'date',
      onChange: (_event, selected) => handleDatePicked(selected),
    });
  }

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  const displayData: ListItem[] =
    viewMode === 'grid' && filteredEntries.length % GRID_COLUMNS !== 0
      ? [...filteredEntries, { id: GRID_PLACEHOLDER_ID }]
      : filteredEntries;

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.flex} edges={['top']}>
        <ThemedView style={styles.headerRow}>
          <ThemedText type="title">Diary</ThemedText>
          {entries.length > 0 && (
            <ThemedView style={styles.headerActions}>
              <Pressable
                onPress={() => setViewMode((mode) => (mode === 'list' ? 'grid' : 'list'))}
                hitSlop={8}
                style={({ pressed }) => pressed && styles.pressed}>
                <SymbolView
                  name={viewMode === 'list' ? 'square.grid.2x2' : 'list.bullet'}
                  size={22}
                  tintColor={theme.text}
                />
              </Pressable>
              {Platform.OS === 'android' ? (
                <Pressable onPress={openAndroidDatePicker} hitSlop={8} style={({ pressed }) => pressed && styles.pressed}>
                  <SymbolView name="calendar" size={22} tintColor={theme.text} />
                </Pressable>
              ) : (
                <DateTimePicker
                  value={jumpDate}
                  mode="date"
                  display="compact"
                  onChange={(_event, selected) => handleDatePicked(selected)}
                />
              )}
            </ThemedView>
          )}
        </ThemedView>

        {entries.length > 0 && (
          <ThemedView type="backgroundElement" style={styles.searchRow}>
            <SymbolView name="magnifyingglass" size={16} tintColor={theme.textSecondary} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by site or task"
              placeholderTextColor={theme.textSecondary}
              style={[styles.searchInput, { color: theme.text }]}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                <SymbolView name="xmark.circle.fill" size={16} tintColor={theme.textSecondary} />
              </Pressable>
            )}
          </ThemedView>
        )}

        <FlatList
          ref={listRef}
          key={viewMode}
          data={displayData}
          keyExtractor={(item) => item.id}
          numColumns={viewMode === 'grid' ? GRID_COLUMNS : 1}
          columnWrapperStyle={viewMode === 'grid' ? styles.gridRow : undefined}
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
          onScrollToIndexFailed={(info) => {
            const rowIndex = viewMode === 'grid' ? Math.floor(info.index / GRID_COLUMNS) : info.index;
            listRef.current?.scrollToOffset({ offset: info.averageItemLength * rowIndex, animated: false });
            setTimeout(() => listRef.current?.scrollToIndex({ index: info.index, animated: true }), 100);
          }}
          ListEmptyComponent={
            <ThemedView style={styles.empty}>
              <ThemedText themeColor="textSecondary">
                {query ? 'No entries match your search.' : 'No entries yet. Tap "New Entry" to log your first day.'}
              </ThemedText>
            </ThemedView>
          }
          renderItem={({ item }) =>
            isPlaceholder(item) ? (
              <ThemedView style={styles.gridItem} />
            ) : viewMode === 'grid' ? (
              <Pressable
                onPress={() => router.push(`/entry/${item.id}`)}
                style={({ pressed }) => [styles.gridItem, pressed && styles.pressed]}>
                <ThemedView type="backgroundElement" style={styles.gridCard}>
                  <ThemedView style={styles.gridThumbWrap}>
                    {item.photo_urls[0] ? (
                      <Image source={{ uri: item.photo_urls[0] }} style={styles.gridThumb} />
                    ) : (
                      <ThemedView type="backgroundSelected" style={styles.gridThumb} />
                    )}
                    {item.pending && <ThemedView style={styles.pendingDot} />}
                  </ThemedView>
                  <ThemedView style={styles.gridText} type="backgroundElement">
                    <ThemedText type="small" themeColor="textSecondary">
                      {formatDateShort(item.date)}
                    </ThemedText>
                    <ThemedText type="smallBold" numberOfLines={1}>
                      {item.site || 'Untitled site'}
                    </ThemedText>
                  </ThemedView>
                </ThemedView>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => router.push(`/entry/${item.id}`)}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
                <ThemedView type="backgroundElement" style={styles.card}>
                  <ThemedView style={styles.thumbWrap}>
                    {item.photo_urls[0] ? (
                      <Image source={{ uri: item.photo_urls[0] }} style={styles.thumb} />
                    ) : (
                      <ThemedView type="backgroundSelected" style={styles.thumb} />
                    )}
                    {item.pending && <ThemedView style={styles.pendingDot} />}
                  </ThemedView>
                  <ThemedView style={styles.cardText} type="backgroundElement">
                    <ThemedText type="smallBold">{item.site || 'Untitled site'}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {item.pending ? 'Pending sync' : `${item.date} · Saved ${formatSavedAt(item.created_at)}`}
                    </ThemedText>
                    {item.tasks ? (
                      <ThemedText type="small" numberOfLines={1} themeColor="textSecondary">
                        {item.tasks}
                      </ThemedText>
                    ) : null}
                  </ThemedView>
                </ThemedView>
              </Pressable>
            )
          }
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginHorizontal: Spacing.four,
    marginBottom: Spacing.three,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    height: 44,
  },
  searchInput: { flex: 1, fontSize: 16, height: 44 },
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
  thumbWrap: { width: 56, height: 56 },
  cardText: { flex: 1, gap: 2 },
  gridRow: { gap: Spacing.two },
  gridItem: { flex: 1, marginBottom: Spacing.two },
  gridCard: { borderRadius: Spacing.three, overflow: 'hidden' },
  gridThumbWrap: {},
  gridThumb: { width: '100%', aspectRatio: 1 },
  gridText: { padding: Spacing.two, gap: 2 },
  pendingDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#F5A623',
    borderWidth: 1.5,
    borderColor: '#ffffff',
  },
});
