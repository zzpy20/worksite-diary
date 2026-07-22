import { Image } from 'expo-image';
import { Dimensions, FlatList, Modal, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const screenWidth = Dimensions.get('window').width;

type Props = {
  photos: string[];
  initialIndex: number | null;
  onClose: () => void;
};

export function PhotoViewerModal({ photos, initialIndex, onClose }: Props) {
  return (
    <Modal visible={initialIndex != null} transparent animationType="fade" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <FlatList
          data={photos}
          keyExtractor={(url, index) => `${url}-${index}`}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex ?? 0}
          getItemLayout={(_, index) => ({ length: screenWidth, offset: screenWidth * index, index })}
          renderItem={({ item }) => (
            <Pressable style={styles.page} onPress={onClose}>
              <Image source={{ uri: item }} style={styles.image} contentFit="contain" />
            </Pressable>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)' },
  page: { width: screenWidth, height: '100%', alignItems: 'center', justifyContent: 'center' },
  image: { width: screenWidth, height: '100%' },
});
