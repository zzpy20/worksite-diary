import { useEffect, useState } from 'react';
import { Modal, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ZoomableImage } from '@/components/zoomable-image';

type Props = {
  photos: string[];
  initialIndex: number | null;
  onClose: () => void;
};

export function PhotoViewerModal({ photos, initialIndex, onClose }: Props) {
  const [activeIndex, setActiveIndex] = useState(initialIndex ?? 0);

  useEffect(() => {
    if (initialIndex != null) setActiveIndex(initialIndex);
  }, [initialIndex]);

  return (
    <Modal visible={initialIndex != null} transparent animationType="fade" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.flex}>
        <SafeAreaView style={styles.safeArea}>
          {initialIndex != null && (
            <ZoomableImage
              key={activeIndex}
              uri={photos[activeIndex]}
              onClose={onClose}
              onSwipe={(direction) =>
                setActiveIndex((current) => {
                  const next = current + direction;
                  return next >= 0 && next < photos.length ? next : current;
                })
              }
            />
          )}
        </SafeAreaView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)' },
});
