import { useState } from 'react';
import { Dimensions, FlatList, Modal, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ZoomableImage } from '@/components/zoomable-image';

const screenWidth = Dimensions.get('window').width;

type Props = {
  photos: string[];
  initialIndex: number | null;
  onClose: () => void;
};

export function PhotoViewerModal({ photos, initialIndex, onClose }: Props) {
  const [scrollEnabled, setScrollEnabled] = useState(true);

  return (
    <Modal visible={initialIndex != null} transparent animationType="fade" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.flex}>
        <SafeAreaView style={styles.safeArea}>
          <FlatList
            data={photos}
            keyExtractor={(url, index) => `${url}-${index}`}
            horizontal
            pagingEnabled
            scrollEnabled={scrollEnabled}
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={initialIndex ?? 0}
            getItemLayout={(_, index) => ({ length: screenWidth, offset: screenWidth * index, index })}
            renderItem={({ item }) => (
              <ZoomableImage uri={item} onClose={onClose} onZoomedChange={(zoomed) => setScrollEnabled(!zoomed)} />
            )}
          />
        </SafeAreaView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)' },
});
