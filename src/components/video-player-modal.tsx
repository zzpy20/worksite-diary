import { SymbolView } from 'expo-symbols';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect } from 'react';
import { Modal, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
  uri: string | null;
  onClose: () => void;
};

export function VideoPlayerModal({ uri, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const player = useVideoPlayer(uri ?? null);

  useEffect(() => {
    if (uri) player.play();
  }, [uri, player]);

  return (
    <Modal visible={uri != null} transparent animationType="fade" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <Pressable
          style={[styles.closeButton, { top: insets.top + 12 }]}
          onPress={onClose}
          hitSlop={12}>
          <SymbolView name="xmark" size={20} tintColor="#ffffff" />
        </Pressable>
        <VideoView player={player} style={styles.video} nativeControls contentFit="contain" />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)' },
  closeButton: { position: 'absolute', right: 16, zIndex: 1, padding: 8 },
  video: { flex: 1 },
});
