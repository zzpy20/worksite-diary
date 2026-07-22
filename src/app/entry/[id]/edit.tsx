import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet } from 'react-native';

import { EntryForm } from '@/components/entry-form';
import { ThemedView } from '@/components/themed-view';
import { getEntry } from '@/lib/entries';
import type { Entry } from '@/types/entry';

export default function EditEntryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [entry, setEntry] = useState<Entry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEntry(id).then(setEntry).finally(() => setLoading(false));
  }, [id]);

  if (loading || !entry) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator />
      </ThemedView>
    );
  }

  return <EntryForm mode="edit" entryId={id} initialEntry={entry} />;
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
