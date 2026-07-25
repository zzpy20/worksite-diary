import { Image } from 'expo-image';
import { useState } from 'react';
import { Dimensions, StyleSheet } from 'react-native';
import { Directions, Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

const screenWidth = Dimensions.get('window').width;
const screenHeight = Dimensions.get('window').height;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;

const AnimatedImage = Animated.createAnimatedComponent(Image);

function clamp(value: number, min: number, max: number) {
  'worklet';
  return Math.min(Math.max(value, min), max);
}

type Props = {
  uri: string;
  onClose: () => void;
  onSwipe: (direction: 1 | -1) => void;
};

export function ZoomableImage({ uri, onClose, onSwipe }: Props) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const isZoomedSV = useSharedValue(false);
  const [isZoomed, setIsZoomed] = useState(false);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = clamp(savedScale.value * e.scale, 1, MAX_SCALE);
      const nowZoomed = scale.value > 1.01;
      if (nowZoomed !== isZoomedSV.value) {
        isZoomedSV.value = nowZoomed;
        runOnJS(setIsZoomed)(nowZoomed);
      }
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      const maxX = (screenWidth * (scale.value - 1)) / 2;
      const maxY = (screenHeight * (scale.value - 1)) / 2;
      if (scale.value <= 1) {
        scale.value = withTiming(1);
        savedScale.value = 1;
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        if (isZoomedSV.value) {
          isZoomedSV.value = false;
          runOnJS(setIsZoomed)(false);
        }
      } else {
        translateX.value = withTiming(clamp(translateX.value, -maxX, maxX));
        translateY.value = withTiming(clamp(translateY.value, -maxY, maxY));
        savedTranslateX.value = clamp(translateX.value, -maxX, maxX);
        savedTranslateY.value = clamp(translateY.value, -maxY, maxY);
      }
    });

  const panGesture = Gesture.Pan()
    .enabled(isZoomed)
    .minDistance(10)
    .onUpdate((e) => {
      if (scale.value <= 1) return;
      const maxX = (screenWidth * (scale.value - 1)) / 2;
      const maxY = (screenHeight * (scale.value - 1)) / 2;
      translateX.value = clamp(savedTranslateX.value + e.translationX, -maxX, maxX);
      translateY.value = clamp(savedTranslateY.value + e.translationY, -maxY, maxY);
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((e) => {
      if (scale.value > 1) {
        scale.value = withTiming(1);
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedScale.value = 1;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
        isZoomedSV.value = false;
        runOnJS(setIsZoomed)(false);
      } else {
        const originX = e.x - screenWidth / 2;
        const originY = e.y - screenHeight / 2;
        const maxX = (screenWidth * (DOUBLE_TAP_SCALE - 1)) / 2;
        const maxY = (screenHeight * (DOUBLE_TAP_SCALE - 1)) / 2;
        const targetX = clamp(-originX * (DOUBLE_TAP_SCALE - 1), -maxX, maxX);
        const targetY = clamp(-originY * (DOUBLE_TAP_SCALE - 1), -maxY, maxY);
        scale.value = withTiming(DOUBLE_TAP_SCALE);
        translateX.value = withTiming(targetX);
        translateY.value = withTiming(targetY);
        savedScale.value = DOUBLE_TAP_SCALE;
        savedTranslateX.value = targetX;
        savedTranslateY.value = targetY;
        isZoomedSV.value = true;
        runOnJS(setIsZoomed)(true);
      }
    });

  const singleTapGesture = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd(() => {
      if (scale.value <= 1) {
        runOnJS(onClose)();
      }
    })
    .requireExternalGestureToFail(doubleTapGesture);

  const tapGesture = Gesture.Exclusive(doubleTapGesture, singleTapGesture);

  // No slide/momentum animation — a swipe just jumps straight to the next/previous photo.
  const swipeNextGesture = Gesture.Fling()
    .direction(Directions.LEFT)
    .enabled(!isZoomed)
    .onEnd(() => runOnJS(onSwipe)(1));

  const swipePrevGesture = Gesture.Fling()
    .direction(Directions.RIGHT)
    .enabled(!isZoomed)
    .onEnd(() => runOnJS(onSwipe)(-1));

  const composedGesture = Gesture.Simultaneous(
    pinchGesture,
    panGesture,
    tapGesture,
    Gesture.Race(swipeNextGesture, swipePrevGesture),
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { translateY: translateY.value }, { scale: scale.value }],
  }));

  return (
    <GestureDetector gesture={composedGesture}>
      <Animated.View style={styles.page}>
        <AnimatedImage
          source={{ uri }}
          style={[styles.image, animatedStyle]}
          contentFit="contain"
          cachePolicy="memory-disk"
        />
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  page: { width: screenWidth, height: '100%', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  image: { width: screenWidth, height: '100%' },
});
