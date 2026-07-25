import { SymbolView } from 'expo-symbols';
import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { PhotoViewerModal } from '@/components/photo-viewer-modal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { formatSavedAt } from '@/lib/date-format';
import { deleteEntry, getEntry } from '@/lib/entries';
import { shareEntryAsPdf } from '@/lib/pdf';
import { useTheme } from '@/hooks/use-theme';
import type { Entry } from '@/types/entry';

export default function EntryDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [entry, setEntry] = useState<Entry | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [sharing, setSharing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      getEntry(id)
        .then(setEntry)
        .catch(() => {
          // Offline or transient error — keep showing whatever we already have, if anything.
        })
        .finally(() => setLoading(false));
    }, [id])
  );

  async function handleShare() {
    if (!entry) return;
    setSharing(true);
    try {
      await shareEntryAsPdf(entry);
    } catch (error) {
      Alert.alert('Could not share entry', error instanceof Error ? error.message : String(error));
    } finally {
      setSharing(false);
    }
  }

  function handleDuplicate() {
    if (!entry) return;
    router.push({
      pathname: '/new-entry',
      params: {
        seedSite: entry.site,
        seedTasks: entry.tasks ?? '',
        seedComments: entry.comments ?? '',
        seedNonce: String(Date.now()),
      },
    });
  }

  function handleDelete() {
    if (!entry) return;
    Alert.alert('Delete entry?', `This removes the entry for "${entry.site}" on ${entry.date}. This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await deleteEntry(entry.id);
            router.replace('/');
          } catch (error) {
            Alert.alert('Could not delete entry', error instanceof Error ? error.message : String(error));
            setDeleting(false);
          }
        },
      },
    ]);
  }

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  if (!entry) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText themeColor="textSecondary">Entry not found.</ThemedText>
      </ThemedView>
    );
  }

  return (
    <>
      <SafeAreaView style={styles.flex} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content}>
          <BackButton />

          <ThemedView style={styles.headerRow}>
            <ThemedView style={styles.headerText}>
              <ThemedText type="title">{entry.site}</ThemedText>
              <ThemedText themeColor="textSecondary">{entry.date}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {entry.pending ? 'Pending sync' : `Saved ${formatSavedAt(entry.created_at)}`}
              </ThemedText>
            </ThemedView>
            <ThemedView style={styles.actions}>
              <Pressable
                onPress={() => router.push(`/entry/${entry.id}/edit`)}
                style={({ pressed }) => [
                  styles.editButton,
                  { backgroundColor: theme.backgroundElement },
                  pressed && styles.pressed,
                ]}>
                <ThemedText type="small">Edit</ThemedText>
              </Pressable>
              <Pressable
                onPress={handleDuplicate}
                style={({ pressed }) => [
                  styles.shareButton,
                  { backgroundColor: theme.backgroundElement },
                  pressed && styles.pressed,
                ]}>
                <SymbolView name="doc.on.doc" size={18} tintColor={theme.text} />
              </Pressable>
              <Pressable
                onPress={handleShare}
                disabled={sharing}
                style={({ pressed }) => [
                  styles.shareButton,
                  { backgroundColor: theme.backgroundElement },
                  pressed && styles.pressed,
                ]}>
                {sharing ? (
                  <ActivityIndicator size="small" />
                ) : (
                  <SymbolView name="square.and.arrow.up" size={18} tintColor={theme.text} />
                )}
              </Pressable>
              <Pressable
                onPress={handleDelete}
                disabled={deleting}
                style={({ pressed }) => [styles.shareButton, styles.deleteButton, pressed && styles.pressed]}>
                {deleting ? (
                  <ActivityIndicator size="small" color="#E24C4C" />
                ) : (
                  <SymbolView name="trash" size={18} tintColor="#E24C4C" />
                )}
              </Pressable>
            </ThemedView>
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">Hours</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {entry.start_time ?? '—'} to {entry.finish_time ?? '—'}
            </ThemedText>
          </ThemedView>

          {entry.comments ? (
            <ThemedView style={styles.section}>
              <ThemedText type="smallBold">Comments</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {entry.comments}
              </ThemedText>
            </ThemedView>
          ) : null}

          {entry.tasks ? (
            <ThemedView style={styles.section}>
              <ThemedText type="smallBold">Tasks</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {entry.tasks}
              </ThemedText>
            </ThemedView>
          ) : null}

          {entry.latitude != null && entry.longitude != null && (
            <ThemedView style={styles.section}>
              <ThemedText type="smallBold">Location</ThemedText>
              <Pressable
                onPress={() => Linking.openURL(`https://maps.apple.com/?ll=${entry.latitude},${entry.longitude}`)}>
                <ThemedText type="linkPrimary">
                  {entry.address ?? `${entry.latitude.toFixed(5)}, ${entry.longitude.toFixed(5)}`}
                </ThemedText>
              </Pressable>
            </ThemedView>
          )}

          {entry.photo_urls.length > 0 && (
            <ThemedView style={styles.section}>
              <ThemedText type="smallBold">Photos</ThemedText>
              <ThemedView style={styles.photoGrid}>
                {entry.photo_urls.map((url, index) => (
                  <Pressable key={url} onPress={() => setViewerIndex(index)}>
                    <Image source={{ uri: url }} style={styles.photo} />
                  </Pressable>
                ))}
              </ThemedView>
            </ThemedView>
          )}
        </ScrollView>
      </SafeAreaView>

      <PhotoViewerModal
        photos={entry.photo_urls}
        initialIndex={viewerIndex}
        onClose={() => setViewerIndex(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.four, paddingTop: Spacing.two, gap: Spacing.two },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerText: { flex: 1, gap: 2 },
  actions: { flexDirection: 'row', gap: Spacing.two },
  editButton: {
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  shareButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {
    backgroundColor: 'rgba(226, 76, 76, 0.12)',
  },
  section: { marginTop: Spacing.three, gap: Spacing.one },
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  photo: { width: 100, height: 100, borderRadius: Spacing.two },
  pressed: { opacity: 0.7 },
});
