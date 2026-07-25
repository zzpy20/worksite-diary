import { useLocalSearchParams } from 'expo-router';

import { EntryForm } from '@/components/entry-form';

export default function NewEntryScreen() {
  const { seedSite, seedTasks, seedComments, seedNonce } = useLocalSearchParams<{
    seedSite?: string;
    seedTasks?: string;
    seedComments?: string;
    seedNonce?: string;
  }>();

  const seed = seedNonce ? { site: seedSite, tasks: seedTasks, comments: seedComments } : undefined;

  return <EntryForm key={seedNonce ?? 'blank'} mode="create" seed={seed} />;
}
