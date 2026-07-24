import { Image } from 'expo-image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Dimensions, FlatList, Modal, Pressable, StyleSheet, type ViewToken } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ZoomableImage } from '@/components/zoomable-image';

const screenWidth = Dimensions.get('window').width;

type Props = {
  photos: string[];
  initialIndex: number | null;
  onClose: () => void;
};

// Only the active page gets the pinch/pan/tap gesture recognizers and the animated
// transform — that's what makes swiping smooth with several photos in a gallery.
function StaticPhotoPage({ uri, onClose }: { uri: string; onClose: () => void }) {
  return (
    <Pressable style={styles.page} onPress={onClose}>
      <Image source={{ uri }} style={styles.image} contentFit="contain" cachePolicy="memory-disk" />
    </Pressable>
  );
}

export function PhotoViewerModal({ photos, initialIndex, onClose }: Props) {
  const [scrollEnabled, setScrollEnabled] = useState(true);
  const [activeIndex, setActiveIndex] = useState(initialIndex ?? 0);

  useEffect(() => {
    if (initialIndex != null) setActiveIndex(initialIndex);
  }, [initialIndex]);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index != null) {
      setActiveIndex(viewableItems[0].index);
    }
  }).current;

  const renderItem = useCallback(
    ({ item, index }: { item: string; index: number }) =>
      index === activeIndex ? (
        <ZoomableImage uri={item} onClose={onClose} onZoomedChange={(zoomed) => setScrollEnabled(!zoomed)} />
      ) : (
        <StaticPhotoPage uri={item} onClose={onClose} />
      ),
    [activeIndex, onClose],
  );

  return (
    <Modal visible={initialIndex != null} transparent animationType="fade" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.flex}>
        <SafeAreaView style={styles.safeArea}>
          <FlatList
            data={photos}
            extraData={activeIndex}
            keyExtractor={(url, index) => `${url}-${index}`}
            horizontal
            pagingEnabled
            scrollEnabled={scrollEnabled}
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={initialIndex ?? 0}
            getItemLayout={(_, index) => ({ length: screenWidth, offset: screenWidth * index, index })}
            initialNumToRender={1}
            maxToRenderPerBatch={2}
            windowSize={3}
            viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
            onViewableItemsChanged={onViewableItemsChanged}
            renderItem={renderItem}
          />
        </SafeAreaView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)' },
  page: { width: screenWidth, height: '100%', alignItems: 'center', justifyContent: 'center' },
  image: { width: screenWidth, height: '100%' },
});
