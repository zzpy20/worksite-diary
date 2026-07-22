import { SymbolView } from 'expo-symbols';
import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export function BackButton() {
  const theme = useTheme();

  return (
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      hitSlop={8}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
      <SymbolView name="chevron.left" size={18} tintColor={theme.text} weight="semibold" />
      <ThemedText type="default">Back</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingVertical: Spacing.two,
    paddingRight: Spacing.three,
    alignSelf: 'flex-start',
  },
  pressed: { opacity: 0.6 },
});
