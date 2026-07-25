import { SFSymbol, SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Step = { icon: SFSymbol; title: string; description: string };

const STEPS: Step[] = [
  {
    icon: 'square.and.pencil',
    title: 'Log your day in seconds',
    description: 'Job site, hours, tasks, photos, and GPS location — all in one quick entry.',
  },
  {
    icon: 'magnifyingglass',
    title: 'Find anything fast',
    description: 'Search by site or task, jump straight to a date, or browse as a photo grid.',
  },
  {
    icon: 'wifi.slash',
    title: 'Works without signal',
    description: "No connection at the site? Entries save on your phone and sync automatically once you're back online.",
  },
  {
    icon: 'square.and.arrow.up',
    title: 'Export & share',
    description: 'Turn any entry into an A4 PDF and share it with a tap.',
  },
];

type Props = { onDone: () => void };

export function OnboardingOverlay({ onDone }: Props) {
  const theme = useTheme();
  const [index, setIndex] = useState(0);
  const step = STEPS[index];
  const isLast = index === STEPS.length - 1;

  return (
    <ThemedView style={styles.flex}>
      <SafeAreaView style={styles.flex}>
        <ThemedView style={styles.skipRow}>
          <Pressable onPress={onDone} hitSlop={8}>
            <ThemedText themeColor="textSecondary">Skip</ThemedText>
          </Pressable>
        </ThemedView>

        <ThemedView style={styles.content}>
          <ThemedView type="backgroundElement" style={styles.iconCircle}>
            <SymbolView name={step.icon} size={40} tintColor={theme.text} />
          </ThemedView>
          <ThemedText style={styles.title}>{step.title}</ThemedText>
          <ThemedText themeColor="textSecondary" style={styles.description}>
            {step.description}
          </ThemedText>
        </ThemedView>

        <ThemedView style={styles.footer}>
          <ThemedView style={styles.dots}>
            {STEPS.map((s, i) => (
              <ThemedView
                key={s.title}
                style={[styles.dot, { backgroundColor: i === index ? '#208AEF' : theme.backgroundElement }]}
              />
            ))}
          </ThemedView>
          <Pressable
            style={({ pressed }) => [styles.nextButton, pressed && styles.pressed]}
            onPress={() => (isLast ? onDone() : setIndex((i) => i + 1))}>
            <ThemedText type="smallBold" themeColor="background" style={styles.nextButtonText}>
              {isLast ? 'Get Started' : 'Next'}
            </ThemedText>
          </Pressable>
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  skipRow: { alignItems: 'flex-end', paddingHorizontal: Spacing.four, paddingTop: Spacing.two },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.five,
    gap: Spacing.three,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  title: { textAlign: 'center', fontSize: 26, lineHeight: 32, fontWeight: '700' },
  description: { textAlign: 'center', fontSize: 16, lineHeight: 22 },
  footer: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.five, gap: Spacing.four },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.two },
  dot: { width: 8, height: 8, borderRadius: 4 },
  nextButton: {
    backgroundColor: '#208AEF',
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  nextButtonText: { textAlign: 'center' },
  pressed: { opacity: 0.7 },
});
