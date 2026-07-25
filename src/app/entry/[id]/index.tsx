import { SymbolView } from 'expo-symbols';
import { Image } from 'expo-image';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { PropsWithChildren, useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { PhotoViewerModal } from '@/components/photo-viewer-modal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { VideoPlayerModal } from '@/components/video-player-modal';
import { Fonts, Spacing } from '@/constants/theme';
import { formatDateDisplay, formatSavedAt, parseISODate } from '@/lib/date-format';
import { deleteEntry, getEntry } from '@/lib/entries';
import { shareEntryAsPdf } from '@/lib/pdf';
import { useTheme } from '@/hooks/use-theme';
import type { Entry } from '@/types/entry';

function Card({ label, children }: PropsWithChildren<{ label: string }>) {
  const theme = useTheme();
  return (
    <ThemedView type="backgroundElement" style={[styles.card, { shadowColor: theme.text }]}>
      <ThemedText type="smallBold" themeColor="textSecondary" style={styles.cardLabel}>
        {label.toUpperCase()}
      </ThemedText>
      {children}
    </ThemedView>
  );
}

export default function EntryDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [entry, setEntry] = useState<Entry | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [videoViewerUri, setVideoViewerUri] = useState<string | null>(null);
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

  const [heroPhoto, ...restPhotos] = entry.photo_urls;

  return (
    <>
      <SafeAreaView style={styles.flex} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content}>
          <BackButton />

          <ThemedView style={styles.actionsRow}>
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
                styles.iconButton,
                { backgroundColor: theme.backgroundElement },
                pressed && styles.pressed,
              ]}>
              <SymbolView name="doc.on.doc" size={18} tintColor={theme.text} />
            </Pressable>
            <Pressable
              onPress={handleShare}
              disabled={sharing}
              style={({ pressed }) => [
                styles.iconButton,
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
              style={({ pressed }) => [styles.iconButton, styles.deleteButton, pressed && styles.pressed]}>
              {deleting ? (
                <ActivityIndicator size="small" color="#E24C4C" />
              ) : (
                <SymbolView name="trash" size={18} tintColor="#E24C4C" />
              )}
            </Pressable>
          </ThemedView>

          <ThemedView style={styles.headerText}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.dateStamp}>
              {formatDateDisplay(parseISODate(entry.date))}
            </ThemedText>
            <ThemedText style={styles.title}>{entry.site}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {entry.pending ? 'Pending sync' : `Saved ${formatSavedAt(entry.created_at)}`}
            </ThemedText>
          </ThemedView>

          {heroPhoto && (
            <ThemedView style={styles.heroWrap}>
              <Pressable onPress={() => setViewerIndex(0)}>
                <Image source={{ uri: heroPhoto }} style={[styles.hero, { shadowColor: theme.text }]} />
              </Pressable>
              {restPhotos.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbStrip}>
                  {restPhotos.map((url, index) => (
                    <Pressable key={url} onPress={() => setViewerIndex(index + 1)}>
                      <Image source={{ uri: url }} style={styles.thumb} />
                    </Pressable>
                  ))}
                </ScrollView>
              )}
            </ThemedView>
          )}

          {entry.video_urls.length > 0 && (
            <Card label="Videos">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbStrip}>
                {entry.video_urls.map((url) => (
                  <Pressable
                    key={url}
                    onPress={() => setVideoViewerUri(url)}
                    style={[styles.videoTile, { backgroundColor: theme.backgroundSelected }]}>
                    <SymbolView name="play.fill" size={20} tintColor={theme.text} />
                  </Pressable>
                ))}
              </ScrollView>
            </Card>
          )}

          <Card label="Hours">
            <ThemedText>
              {entry.start_time ?? '—'} to {entry.finish_time ?? '—'}
            </ThemedText>
          </Card>

          {entry.comments ? (
            <Card label="Comments">
              <ThemedText style={styles.bodyText}>{entry.comments}</ThemedText>
            </Card>
          ) : null}

          {entry.tasks ? (
            <Card label="Tasks">
              <ThemedText>{entry.tasks}</ThemedText>
            </Card>
          ) : null}

          {entry.latitude != null && entry.longitude != null && (
            <Card label="Location">
              <Pressable
                onPress={() => Linking.openURL(`https://maps.apple.com/?ll=${entry.latitude},${entry.longitude}`)}>
                <ThemedText type="linkPrimary">
                  {entry.address ?? `${entry.latitude.toFixed(5)}, ${entry.longitude.toFixed(5)}`}
                </ThemedText>
              </Pressable>
            </Card>
          )}
        </ScrollView>
      </SafeAreaView>

      <PhotoViewerModal
        photos={entry.photo_urls}
        initialIndex={viewerIndex}
        onClose={() => setViewerIndex(null)}
      />
      <VideoPlayerModal uri={videoViewerUri} onClose={() => setVideoViewerUri(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: Spacing.four, paddingTop: Spacing.two, paddingBottom: Spacing.six, gap: Spacing.three },
  actionsRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.two },
  headerText: { gap: 4, marginBottom: Spacing.one },
  dateStamp: { textTransform: 'uppercase', letterSpacing: 0.6 },
  title: { fontFamily: Fonts.serif, fontSize: 34, lineHeight: 40, fontWeight: '600' },
  editButton: {
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {
    backgroundColor: 'rgba(226, 76, 76, 0.12)',
  },
  heroWrap: { gap: Spacing.two },
  hero: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: Spacing.four,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 3,
  },
  thumbStrip: { flexDirection: 'row' },
  thumb: { width: 64, height: 64, borderRadius: Spacing.two, marginRight: Spacing.two },
  videoTile: {
    width: 64,
    height: 64,
    borderRadius: Spacing.two,
    marginRight: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.one,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  cardLabel: { letterSpacing: 0.5, marginBottom: 2 },
  bodyText: { lineHeight: 24 },
  pressed: { opacity: 0.7 },
});
