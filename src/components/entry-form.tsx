import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import Checkbox from 'expo-checkbox';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import { SFSymbol, SymbolView } from 'expo-symbols';
import { PropsWithChildren, useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { PhotoViewerModal } from '@/components/photo-viewer-modal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { VideoPlayerModal } from '@/components/video-player-modal';
import { Spacing } from '@/constants/theme';
import {
  formatDateDisplay,
  formatDateISO,
  formatTimeDisplay,
  parseISODate,
  parseTimeString,
} from '@/lib/date-format';
import { useTheme } from '@/hooks/use-theme';
import { createEntry, listRecentSites, updateEntry } from '@/lib/entries';
import { addTaskLabel, removeTaskLabel } from '@/lib/task-labels';
import type { Entry } from '@/types/entry';

const TASK_PRESETS = ['Waterproofing', 'Epoxy', 'PVC Membrane'];
const DIVIDER_COLOR = 'rgba(128,128,128,0.18)';
// Height + bottom margin of the floating pill-style tab bar, on top of the home-indicator inset.
const FLOATING_TAB_BAR_CLEARANCE = 60;

function initialCheckedTasks(tasks: string | null | undefined) {
  const parts = (tasks ?? '').split(',').map((s) => s.trim());
  const result: Record<string, boolean> = {};
  for (const label of TASK_PRESETS) {
    result[label] = parts.includes(label);
  }
  return result;
}

function formatAddress(addr: Location.LocationGeocodedAddress): string {
  if (addr.formattedAddress) return addr.formattedAddress;
  const line1 = [addr.streetNumber, addr.street].filter(Boolean).join(' ');
  const line2 = [addr.city, addr.region].filter(Boolean).join(', ');
  return [line1, line2].filter(Boolean).join(', ');
}

function SectionLabel({ children }: { children: string }) {
  return (
    <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
      {children.toUpperCase()}
    </ThemedText>
  );
}

function Card({ children }: PropsWithChildren) {
  const theme = useTheme();
  return <ThemedView style={[styles.card, { backgroundColor: theme.backgroundElement }]}>{children}</ThemedView>;
}

function Divider() {
  return <View style={styles.divider} />;
}

function TapRow({
  label,
  value,
  placeholder,
  onPress,
  loading,
  icon,
}: {
  label: string;
  value: string | null;
  placeholder: string;
  onPress: () => void;
  loading?: boolean;
  icon?: SFSymbol;
}) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} disabled={loading} style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
      <View style={styles.rowLeft}>
        {icon && <SymbolView name={icon} size={16} tintColor={theme.textSecondary} style={styles.rowIcon} />}
        <ThemedText style={styles.rowLabel}>{label}</ThemedText>
      </View>
      <View style={styles.rowRight}>
        {loading ? (
          <ActivityIndicator size="small" />
        ) : (
          <ThemedText themeColor={value ? 'text' : 'textSecondary'} style={styles.rowValue} numberOfLines={1}>
            {value ?? placeholder}
          </ThemedText>
        )}
        <SymbolView name="chevron.right" size={13} tintColor={theme.textSecondary} />
      </View>
    </Pressable>
  );
}

type Props = {
  mode: 'create' | 'edit';
  entryId?: string;
  initialEntry?: Entry;
  /** Prefill for a duplicated entry (create mode only) — day-specific fields are left blank. */
  seed?: { site?: string; tasks?: string; comments?: string };
};

export function EntryForm({ mode, entryId, initialEntry, seed }: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const [date, setDate] = useState(() => (initialEntry ? parseISODate(initialEntry.date) : new Date()));
  const [site, setSite] = useState(initialEntry?.site ?? seed?.site ?? '');
  const [startTime, setStartTime] = useState<Date | null>(() =>
    initialEntry?.start_time ? parseTimeString(initialEntry.start_time) : null
  );
  const [finishTime, setFinishTime] = useState<Date | null>(() =>
    initialEntry?.finish_time ? parseTimeString(initialEntry.finish_time) : null
  );
  const [comments, setComments] = useState(initialEntry?.comments ?? seed?.comments ?? '');
  const [tasks, setTasks] = useState(initialEntry?.tasks ?? seed?.tasks ?? '');
  const [checkedTasks, setCheckedTasks] = useState<Record<string, boolean>>(() =>
    initialCheckedTasks(initialEntry?.tasks ?? seed?.tasks)
  );
  const [siteSuggestions, setSiteSuggestions] = useState<string[]>([]);
  const [siteFocused, setSiteFocused] = useState(false);
  const siteBlurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [latitude, setLatitude] = useState<number | null>(initialEntry?.latitude ?? null);
  const [longitude, setLongitude] = useState<number | null>(initialEntry?.longitude ?? null);
  const [address, setAddress] = useState<string | null>(initialEntry?.address ?? null);
  const [locating, setLocating] = useState(false);
  const [photoUris, setPhotoUris] = useState<string[]>(() => [...(initialEntry?.photo_urls ?? [])]);
  const [pickingPhoto, setPickingPhoto] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [videoUris, setVideoUris] = useState<string[]>(() => [...(initialEntry?.video_urls ?? [])]);
  const [pickingVideo, setPickingVideo] = useState(false);
  const [videoViewerUri, setVideoViewerUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Block every way off this screen while a save is in flight — the Cancel/Save
  // buttons being disabled doesn't stop the iOS swipe-back gesture or Android's
  // hardware back button, both of which can pop the screen mid-upload otherwise.
  const navigation = useNavigation();
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !saving });
  }, [navigation, saving]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => saving);
    return () => sub.remove();
  }, [saving]);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showFinishPicker, setShowFinishPicker] = useState(false);

  // Snapshot of the form's starting values, used to detect unsaved changes on Cancel.
  const baselineRef = useRef({
    dateISO: formatDateISO(date),
    site,
    startTime: startTime ? formatTimeDisplay(startTime) : '',
    finishTime: finishTime ? formatTimeDisplay(finishTime) : '',
    comments,
    tasks,
    latitude,
    longitude,
    photoUris: [...photoUris],
    videoUris: [...videoUris],
  });

  function isDirty() {
    const b = baselineRef.current;
    return (
      formatDateISO(date) !== b.dateISO ||
      site.trim() !== b.site.trim() ||
      (startTime ? formatTimeDisplay(startTime) : '') !== b.startTime ||
      (finishTime ? formatTimeDisplay(finishTime) : '') !== b.finishTime ||
      comments.trim() !== b.comments.trim() ||
      tasks.trim() !== b.tasks.trim() ||
      latitude !== b.latitude ||
      longitude !== b.longitude ||
      photoUris.length !== b.photoUris.length ||
      photoUris.some((uri, i) => uri !== b.photoUris[i]) ||
      videoUris.length !== b.videoUris.length ||
      videoUris.some((uri, i) => uri !== b.videoUris[i])
    );
  }

  useFocusEffect(
    useCallback(() => {
      listRecentSites().then(setSiteSuggestions).catch(() => {});
    }, [])
  );

  function handleSiteFocus() {
    if (siteBlurTimeout.current) clearTimeout(siteBlurTimeout.current);
    setSiteFocused(true);
  }

  function handleSiteBlur() {
    // Delay so a tap on a suggestion chip registers before the list disappears.
    siteBlurTimeout.current = setTimeout(() => setSiteFocused(false), 150);
  }

  function selectSiteSuggestion(value: string) {
    if (siteBlurTimeout.current) clearTimeout(siteBlurTimeout.current);
    setSite(value);
    setSiteFocused(false);
  }

  const siteQuery = site.trim().toLowerCase();
  const filteredSiteSuggestions = siteQuery
    ? siteSuggestions.filter((s) => s.toLowerCase() !== siteQuery && s.toLowerCase().startsWith(siteQuery)).slice(0, 5)
    : [];
  const showSiteSuggestions = siteFocused && filteredSiteSuggestions.length > 0;
  const hasLocalPhotos = photoUris.some((uri) => !uri.startsWith('http'));
  const hasLocalVideos = videoUris.some((uri) => !uri.startsWith('http'));

  function openDatePicker() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: date,
        mode: 'date',
        onChange: (_event, selected) => selected && setDate(selected),
      });
    } else {
      setShowStartPicker(false);
      setShowFinishPicker(false);
      setShowDatePicker((v) => !v);
    }
  }

  function openStartPicker() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: startTime ?? new Date(),
        mode: 'time',
        is24Hour: false,
        onChange: (_event, selected) => selected && setStartTime(selected),
      });
    } else {
      setShowDatePicker(false);
      setShowFinishPicker(false);
      setShowStartPicker((v) => !v);
    }
  }

  function openFinishPicker() {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: finishTime ?? new Date(),
        mode: 'time',
        is24Hour: false,
        onChange: (_event, selected) => selected && setFinishTime(selected),
      });
    } else {
      setShowDatePicker(false);
      setShowStartPicker(false);
      setShowFinishPicker((v) => !v);
    }
  }

  function toggleTaskPreset(label: string) {
    const next = !checkedTasks[label];
    setCheckedTasks((prev) => ({ ...prev, [label]: next }));
    setTasks((prev) => (next ? addTaskLabel(prev, label) : removeTaskLabel(prev, label)));
  }

  async function handleLogLocation() {
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Allow location access to log the site GPS coordinates.');
        return;
      }
      const position = await Location.getCurrentPositionAsync();
      setLatitude(position.coords.latitude);
      setLongitude(position.coords.longitude);
      setAddress(null);
      try {
        const [result] = await Location.reverseGeocodeAsync({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        if (result) setAddress(formatAddress(result));
      } catch {
        // Reverse geocoding is best-effort; coordinates are already captured either way.
      }
    } catch (error) {
      Alert.alert('Could not get location', error instanceof Error ? error.message : String(error));
    } finally {
      setLocating(false);
    }
  }

  async function pickPhoto() {
    setPickingPhoto(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Allow photo library access to attach site photos.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.6,
        allowsMultipleSelection: true,
      });
      if (!result.canceled) {
        setPhotoUris((prev) => [...prev, ...result.assets.map((a) => a.uri)]);
      }
    } finally {
      setPickingPhoto(false);
    }
  }

  async function takePhoto() {
    setPickingPhoto(true);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Allow camera access to take site photos.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ quality: 0.6 });
      if (!result.canceled) {
        setPhotoUris((prev) => [...prev, ...result.assets.map((a) => a.uri)]);
      }
    } finally {
      setPickingPhoto(false);
    }
  }

  function removePhoto(index: number) {
    setPhotoUris((prev) => prev.filter((_, i) => i !== index));
  }

  async function pickVideo() {
    setPickingVideo(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Allow photo library access to attach site videos.');
        return;
      }
      // Single-selection: iOS's picker can treat a tap on a video thumbnail as "preview"
      // rather than "select" in multi-select mode, so Add can confirm zero items even
      // after tapping a video. Single-select taps directly pick and dismiss instead.
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'] });
      if (!result.canceled) {
        setVideoUris((prev) => [...prev, ...result.assets.map((a) => a.uri)]);
      }
    } finally {
      setPickingVideo(false);
    }
  }

  async function recordVideo() {
    setPickingVideo(true);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Allow camera access to record site videos.');
        return;
      }
      // Duration + quality both kept conservative so a recording reliably stays under
      // the 45MB upload limit (see MAX_UPLOAD_BYTES in lib/entries.ts) — better than
      // capping duration alone and having a recording fail the size check afterward.
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['videos'],
        videoMaxDuration: 45,
        videoQuality: ImagePicker.UIImagePickerControllerQualityType.Medium,
      });
      if (!result.canceled) {
        setVideoUris((prev) => [...prev, ...result.assets.map((a) => a.uri)]);
      }
    } finally {
      setPickingVideo(false);
    }
  }

  function removeVideo(index: number) {
    setVideoUris((prev) => prev.filter((_, i) => i !== index));
  }

  function resetForm() {
    setDate(new Date());
    setSite('');
    setStartTime(null);
    setFinishTime(null);
    setComments('');
    setTasks('');
    setCheckedTasks(initialCheckedTasks(undefined));
    setLatitude(null);
    setLongitude(null);
    setAddress(null);
    setPhotoUris([]);
    setVideoUris([]);
    baselineRef.current = {
      dateISO: formatDateISO(new Date()),
      site: '',
      startTime: '',
      finishTime: '',
      comments: '',
      tasks: '',
      latitude: null,
      longitude: null,
      photoUris: [],
      videoUris: [],
    };
  }

  function leave() {
    if (mode === 'edit') {
      router.back();
    } else {
      resetForm();
      router.navigate('/');
    }
  }

  function handleCancel() {
    if (!isDirty()) {
      leave();
      return;
    }
    Alert.alert('Discard changes?', 'Your unsaved changes will be lost.', [
      { text: 'Keep Editing', style: 'cancel' },
      { text: 'Discard', style: 'destructive', onPress: leave },
    ]);
  }

  async function handleSave() {
    if (pickingPhoto || pickingVideo) return;
    if (!site.trim()) {
      Alert.alert('Missing site', 'Enter the job site name.');
      return;
    }
    setSaving(true);
    try {
      const input = {
        date: formatDateISO(date),
        site: site.trim(),
        start_time: startTime ? formatTimeDisplay(startTime) : '',
        finish_time: finishTime ? formatTimeDisplay(finishTime) : '',
        comments: comments.trim(),
        tasks: tasks.trim(),
        latitude,
        longitude,
        address,
        photoUris,
        videoUris,
      };

      let saved: Entry;
      if (mode === 'edit' && entryId) {
        if (!initialEntry) throw new Error('Missing original entry');
        saved = await updateEntry(entryId, input, initialEntry);
        router.replace(`/entry/${entryId}`);
      } else {
        saved = await createEntry(input);
        resetForm();
        router.navigate('/');
      }

      // Reflects the actual outcome, not just a pre-save connectivity guess — a save
      // can still end up queued even when the connection looked fine going in.
      if (saved.pending) {
        Alert.alert('Saved offline', "This entry will sync automatically once you're back online.");
      }
    } catch (error) {
      Alert.alert('Could not save entry', error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={styles.flex} edges={['top']}>
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Spacing.five }]}>
          {mode === 'create' && (
            <ThemedText type="title" style={styles.header}>
              New Entry
            </ThemedText>
          )}

          <SectionLabel>Details</SectionLabel>
          <Card>
            <TapRow label="Date" value={formatDateDisplay(date)} placeholder="Select date" onPress={openDatePicker} />
            <Divider />
            <View style={styles.row}>
              <ThemedText style={styles.rowLabel}>Job site</ThemedText>
              <TextInput
                style={[styles.rowInput, { color: theme.text }]}
                value={site}
                onChangeText={setSite}
                onFocus={handleSiteFocus}
                onBlur={handleSiteBlur}
                placeholder="e.g. Boggo Road"
                placeholderTextColor={theme.textSecondary}
                textAlign="right"
              />
            </View>
          </Card>
          {showDatePicker && (
            <DateTimePicker value={date} mode="date" display="spinner" onChange={(_e, d) => d && setDate(d)} />
          )}
          {showSiteSuggestions && (
            <ThemedView type="backgroundElement" style={styles.suggestionList}>
              {filteredSiteSuggestions.map((suggestion, index) => (
                <Pressable
                  key={suggestion}
                  // onPressIn (touch-down), not onPress (touch-up) — the field's blur
                  // event races the same touch, and a full tap gesture can lose that
                  // race and never fire if the list gets hidden mid-gesture.
                  onPressIn={() => selectSiteSuggestion(suggestion)}
                  style={({ pressed }) => [
                    styles.suggestionItem,
                    index > 0 && styles.suggestionItemDivider,
                    pressed && styles.pressed,
                  ]}>
                  <ThemedText>{suggestion}</ThemedText>
                </Pressable>
              ))}
            </ThemedView>
          )}

          <SectionLabel>Hours</SectionLabel>
          <Card>
            <TapRow
              label="Start"
              value={startTime ? formatTimeDisplay(startTime) : null}
              placeholder="Select time"
              onPress={openStartPicker}
            />
            <Divider />
            <TapRow
              label="Finish"
              value={finishTime ? formatTimeDisplay(finishTime) : null}
              placeholder="Select time"
              onPress={openFinishPicker}
            />
          </Card>
          {showStartPicker && (
            <DateTimePicker
              value={startTime ?? new Date()}
              mode="time"
              is24Hour={false}
              display="spinner"
              style={styles.fullWidthPicker}
              onChange={(_e, d) => d && setStartTime(d)}
            />
          )}
          {showFinishPicker && (
            <DateTimePicker
              value={finishTime ?? new Date()}
              mode="time"
              is24Hour={false}
              display="spinner"
              style={styles.fullWidthPicker}
              onChange={(_e, d) => d && setFinishTime(d)}
            />
          )}

          <SectionLabel>Comments</SectionLabel>
          <Card>
            <TextInput
              style={[styles.textarea, { color: theme.text }]}
              value={comments}
              onChangeText={setComments}
              placeholder="Any notes about the day"
              placeholderTextColor={theme.textSecondary}
              multiline
            />
          </Card>

          <SectionLabel>Tasks</SectionLabel>
          <Card>
            <View style={styles.presetRow}>
              {TASK_PRESETS.map((label) => (
                <Pressable key={label} style={styles.presetItem} onPress={() => toggleTaskPreset(label)}>
                  <Checkbox
                    value={!!checkedTasks[label]}
                    onValueChange={() => toggleTaskPreset(label)}
                    color={checkedTasks[label] ? '#208AEF' : undefined}
                  />
                  <ThemedText type="small">{label}</ThemedText>
                </Pressable>
              ))}
            </View>
            <Divider />
            <TextInput
              style={[styles.textarea, { color: theme.text }]}
              value={tasks}
              onChangeText={setTasks}
              placeholder="Waterproofing, screeding, mixing adhesive"
              placeholderTextColor={theme.textSecondary}
              multiline
            />
          </Card>

          <SectionLabel>Location</SectionLabel>
          <Card>
            <TapRow
              label="Site location"
              value={latitude != null ? (address ?? `${latitude.toFixed(5)}, ${longitude!.toFixed(5)}`) : null}
              placeholder="Log current location"
              onPress={handleLogLocation}
              loading={locating}
              icon="location.fill"
            />
          </Card>

          <SectionLabel>Photos</SectionLabel>
          <Card>
            <View style={styles.photoRow}>
              {photoUris.map((uri, index) => (
                <View key={uri} style={styles.photoThumbWrap}>
                  <Pressable onPress={() => setViewerIndex(index)}>
                    <Image source={{ uri }} style={styles.photoThumb} />
                  </Pressable>
                  <Pressable
                    onPress={() => removePhoto(index)}
                    hitSlop={8}
                    style={({ pressed }) => [styles.removeBadge, pressed && styles.pressed]}>
                    <ThemedText type="smallBold" style={styles.removeBadgeText}>
                      ×
                    </ThemedText>
                  </Pressable>
                </View>
              ))}
              <Pressable
                onPress={takePhoto}
                style={({ pressed }) => [styles.addPhoto, pressed && styles.pressed]}>
                <SymbolView name="camera.fill" size={18} tintColor={theme.text} />
              </Pressable>
              <Pressable
                onPress={pickPhoto}
                style={({ pressed }) => [styles.addPhoto, pressed && styles.pressed]}>
                <ThemedText type="link">+ Add</ThemedText>
              </Pressable>
            </View>
          </Card>

          <SectionLabel>Videos</SectionLabel>
          <Card>
            <View style={styles.photoRow}>
              {videoUris.map((uri, index) => (
                <View key={uri} style={styles.photoThumbWrap}>
                  <Pressable
                    onPress={() => setVideoViewerUri(uri)}
                    style={[styles.videoThumb, { backgroundColor: theme.backgroundSelected }]}>
                    <SymbolView name="play.fill" size={18} tintColor={theme.text} />
                  </Pressable>
                  <Pressable
                    onPress={() => removeVideo(index)}
                    hitSlop={8}
                    style={({ pressed }) => [styles.removeBadge, pressed && styles.pressed]}>
                    <ThemedText type="smallBold" style={styles.removeBadgeText}>
                      ×
                    </ThemedText>
                  </Pressable>
                </View>
              ))}
              <Pressable
                onPress={recordVideo}
                style={({ pressed }) => [styles.addPhoto, pressed && styles.pressed]}>
                <SymbolView name="video.fill" size={18} tintColor={theme.text} />
              </Pressable>
              <Pressable
                onPress={pickVideo}
                style={({ pressed }) => [styles.addPhoto, pressed && styles.pressed]}>
                <ThemedText type="link">+ Add</ThemedText>
              </Pressable>
            </View>
          </Card>
        </ScrollView>

        <ThemedView
          style={[
            styles.footer,
            { paddingBottom: keyboardVisible ? Spacing.two : insets.bottom + FLOATING_TAB_BAR_CLEARANCE },
          ]}>
          <Pressable
            style={({ pressed }) => [
              styles.cancelButton,
              { backgroundColor: theme.backgroundElement },
              pressed && styles.pressed,
            ]}
            disabled={saving || pickingPhoto || pickingVideo}
            onPress={handleCancel}>
            <ThemedText type="smallBold">Cancel</ThemedText>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}
            disabled={saving || pickingPhoto || pickingVideo}
            onPress={handleSave}>
            {saving || pickingPhoto || pickingVideo ? (
              <ThemedView style={styles.savingRow}>
                <ActivityIndicator size="small" color="#ffffff" />
                <ThemedText type="smallBold" themeColor="background">
                  {pickingPhoto
                    ? 'Adding photos…'
                    : pickingVideo
                      ? 'Adding videos…'
                      : hasLocalPhotos || hasLocalVideos
                        ? 'Uploading…'
                        : 'Saving…'}
                </ThemedText>
              </ThemedView>
            ) : (
              <ThemedText type="smallBold" themeColor="background" style={styles.saveButtonText}>
                {mode === 'edit' ? 'Save Changes' : 'Save Entry'}
              </ThemedText>
            )}
          </Pressable>
        </ThemedView>
      </SafeAreaView>

      <PhotoViewerModal photos={photoUris} initialIndex={viewerIndex} onClose={() => setViewerIndex(null)} />
      <VideoPlayerModal uri={videoViewerUri} onClose={() => setVideoViewerUri(null)} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.five },
  header: { marginBottom: Spacing.three },
  sectionLabel: { marginTop: Spacing.four, marginBottom: Spacing.two, marginLeft: Spacing.one },
  card: { borderRadius: Spacing.three, overflow: 'hidden' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: DIVIDER_COLOR, marginLeft: Spacing.three },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  rowPressed: { opacity: 0.6 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  rowIcon: { marginRight: 2 },
  rowLabel: { fontSize: 16 },
  rowRight: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, flexShrink: 1 },
  rowValue: { flexShrink: 1, textAlign: 'right' },
  rowInput: { flex: 1, fontSize: 16, marginLeft: Spacing.three },
  textarea: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  fullWidthPicker: { width: '100%', marginTop: Spacing.two },
  suggestionList: {
    marginTop: Spacing.two,
    borderRadius: Spacing.three,
    overflow: 'hidden',
  },
  suggestionItem: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  suggestionItemDivider: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: DIVIDER_COLOR,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  presetItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  photoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    padding: Spacing.three,
  },
  photoThumbWrap: { width: 64, height: 64 },
  photoThumb: { width: 64, height: 64, borderRadius: Spacing.two },
  videoThumb: {
    width: 64,
    height: 64,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#E24C4C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBadgeText: { color: '#FFFFFF', lineHeight: 16, marginTop: -1 },
  addPhoto: {
    width: 64,
    height: 64,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DIVIDER_COLOR,
  },
  footer: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: DIVIDER_COLOR,
  },
  cancelButton: {
    flex: 1,
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    flex: 2,
    backgroundColor: '#208AEF',
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: { textAlign: 'center' },
  savingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, backgroundColor: 'transparent' },
  pressed: { opacity: 0.7 },
});
