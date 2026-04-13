import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Audio } from "expo-av";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import {
  CheckCircle2,
  CircleStop,
  FileAudio,
  Mic,
  Pause,
  Play,
  Sparkles,
  Upload,
  XCircle,
} from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Button } from "@/components/Button";
import { Card } from "@/components/Card";
import { Screen } from "@/components/Screen";
import { useTheme } from "@/contexts/ThemeContext";
import { api } from "@/lib/api";
import { radii, spacing, typography } from "@/lib/theme";
import type { AppStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<AppStackParamList, "AddVoice">;

type Step = 1 | 2 | 3;

interface PickedSample {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
}

export function AddVoiceScreen({ navigation }: Props) {
  const { palette, brand } = useTheme();

  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState("");
  const [voiceId, setVoiceId] = useState<string | null>(null);
  const [uploadUrl, setUploadUrl] = useState<string | null>(null);
  const [sample, setSample] = useState<PickedSample | null>(null);
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [previewSound, setPreviewSound] = useState<Audio.Sound | null>(null);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgradePrompt, setUpgradePrompt] = useState<string | null>(null);
  const [processingStatus, setProcessingStatus] =
    useState<"processing" | "ready" | "failed">("processing");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recording?.stopAndUnloadAsync().catch(() => {});
      previewSound?.unloadAsync().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- Step 1: name + create voice record ---------- */

  async function goToUpload() {
    if (!name.trim()) return;
    setError(null);
    setUpgradePrompt(null);
    setBusy(true);
    try {
      const res = await api.createVoice(name.trim());
      setVoiceId(res.voiceId);
      setUploadUrl(res.uploadUrl);
      setStep(2);
    } catch (e) {
      if (e instanceof Error) {
        // api.ts attaches upgrade fields onto the thrown error
        const anyE = e as Error & {
          upgradeRequired?: boolean;
          upgradePrompt?: string;
        };
        if (anyE.upgradeRequired && anyE.upgradePrompt) {
          setUpgradePrompt(anyE.upgradePrompt);
        } else {
          setError(e.message);
        }
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  /* ---------- Step 2: record or pick an audio sample ---------- */

  async function handleStartRecording() {
    try {
      const perm = await Audio.requestPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Microphone access needed",
          "Allow microphone access in Settings so we can record a voice sample."
        );
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const { recording: rec } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(rec);
      setRecordingDuration(0);
      timerRef.current = setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);
    } catch (e) {
      Alert.alert(
        "Couldn't start recording",
        e instanceof Error ? e.message : "Try again."
      );
    }
  }

  async function handleStopRecording() {
    if (!recording) return;
    try {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      if (uri) {
        setSample({
          uri,
          name: `${name || "voice"}-sample.m4a`,
          mimeType: "audio/m4a",
        });
      }
    } finally {
      setRecording(null);
    }
  }

  async function handlePickFile() {
    const res = await DocumentPicker.getDocumentAsync({
      type: ["audio/*"],
      copyToCacheDirectory: true,
    });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    setSample({
      uri: asset.uri,
      name: asset.name ?? "voice-sample",
      mimeType: asset.mimeType ?? "audio/mpeg",
      size: asset.size ?? undefined,
    });
  }

  const togglePreview = useCallback(async () => {
    if (!sample) return;
    if (previewPlaying && previewSound) {
      await previewSound.pauseAsync();
      setPreviewPlaying(false);
      return;
    }
    if (previewSound) {
      await previewSound.playAsync();
      setPreviewPlaying(true);
      return;
    }
    const { sound } = await Audio.Sound.createAsync(
      { uri: sample.uri },
      { shouldPlay: true }
    );
    setPreviewSound(sound);
    setPreviewPlaying(true);
    sound.setOnPlaybackStatusUpdate((status) => {
      if (!status.isLoaded) return;
      if (status.didJustFinish) {
        setPreviewPlaying(false);
        sound.setPositionAsync(0).catch(() => {});
      }
    });
  }, [previewPlaying, previewSound, sample]);

  /* ---------- Upload + kick off processing ---------- */

  async function handleUploadAndProcess() {
    if (!sample || !uploadUrl || !voiceId) return;
    setBusy(true);
    setError(null);
    try {
      // Read the local file as binary and PUT to the presigned S3 URL.
      // `expo-file-system` uploadAsync handles streaming without loading the
      // whole file into memory.
      const res = await FileSystem.uploadAsync(uploadUrl, sample.uri, {
        httpMethod: "PUT",
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: { "Content-Type": sample.mimeType || "audio/mpeg" },
      });
      if (res.status < 200 || res.status >= 300) {
        throw new Error(`Upload failed (status ${res.status})`);
      }

      setStep(3);
      const processed = await api.processVoice(voiceId);
      setProcessingStatus(processed.status);
      if (processed.status === "ready") {
        setTimeout(() => navigation.goBack(), 1500);
      }
    } catch (e) {
      setProcessingStatus("failed");
      setError(e instanceof Error ? e.message : "Upload failed.");
      setStep(3);
    } finally {
      setBusy(false);
    }
  }

  /* ---------- Render ---------- */

  return (
    <Screen scroll={false} padded>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        {/* Stepper */}
        <View style={styles.stepper}>
          {[1, 2, 3].map((s) => (
            <View
              key={s}
              style={[
                styles.stepperDot,
                {
                  backgroundColor: s <= step ? brand.green : palette.muted,
                },
              ]}
            />
          ))}
        </View>

        {step === 1 ? (
          <View style={{ gap: spacing.lg, marginTop: spacing.lg }}>
            <View style={{ alignItems: "center", gap: 6 }}>
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: radii.pill,
                  backgroundColor: brand.green + "1A",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Sparkles size={24} color={brand.green} />
              </View>
              <Text
                style={{
                  fontSize: typography.sizes.xxl,
                  fontWeight: typography.weights.bold,
                  color: palette.foreground,
                  textAlign: "center",
                }}
              >
                Who will be reading?
              </Text>
              <Text
                style={{
                  color: palette.mutedForeground,
                  textAlign: "center",
                }}
              >
                Give this voice a name your kids will recognize.
              </Text>
            </View>

            <TextInput
              value={name}
              onChangeText={setName}
              placeholder='e.g. "Grandma Sue"'
              placeholderTextColor={palette.mutedForeground}
              style={{
                borderWidth: 1,
                borderColor: palette.border,
                borderRadius: radii.md,
                paddingHorizontal: spacing.md,
                paddingVertical: 14,
                color: palette.foreground,
                fontSize: typography.sizes.md,
                backgroundColor: palette.card,
              }}
            />

            {upgradePrompt ? (
              <View
                style={{
                  backgroundColor: brand.gold + "15",
                  borderColor: brand.gold + "55",
                  borderWidth: 1,
                  borderRadius: radii.md,
                  padding: spacing.md,
                  gap: spacing.sm,
                }}
              >
                <Text
                  style={{ color: palette.foreground, fontWeight: "600" }}
                >
                  Voice profile limit reached
                </Text>
                <Text style={{ color: palette.mutedForeground }}>
                  {upgradePrompt}
                </Text>
                <Button
                  title="See plans"
                  variant="gold"
                  onPress={() => navigation.navigate("Pricing")}
                />
              </View>
            ) : null}

            {error ? (
              <Text style={{ color: palette.destructive }}>{error}</Text>
            ) : null}

            <Button
              title="Continue"
              onPress={goToUpload}
              loading={busy}
              disabled={!name.trim() || !!upgradePrompt}
            />
          </View>
        ) : null}

        {step === 2 ? (
          <View style={{ gap: spacing.lg, marginTop: spacing.lg }}>
            <View style={{ gap: 4 }}>
              <Text
                style={{
                  fontSize: typography.sizes.xxl,
                  fontWeight: typography.weights.bold,
                  color: palette.foreground,
                }}
              >
                Add a voice sample
              </Text>
              <Text style={{ color: palette.mutedForeground }}>
                Record 30–60 seconds of {name} speaking clearly, or upload an
                existing audio file. Clearer = better clone.
              </Text>
            </View>

            {/* Recorder card */}
            <Card>
              <View style={{ alignItems: "center", gap: spacing.md }}>
                <Pressable
                  onPress={recording ? handleStopRecording : handleStartRecording}
                  style={[
                    styles.recordBtn,
                    {
                      backgroundColor: recording ? brand.coral : brand.green,
                    },
                  ]}
                >
                  {recording ? (
                    <CircleStop size={36} color="#fff" />
                  ) : (
                    <Mic size={36} color="#fff" />
                  )}
                </Pressable>
                <Text
                  style={{
                    color: palette.foreground,
                    fontSize: typography.sizes.md,
                    fontWeight: typography.weights.semibold,
                  }}
                >
                  {recording
                    ? `Recording… ${formatDuration(recordingDuration)}`
                    : "Tap to record"}
                </Text>
                {!recording ? (
                  <Text
                    style={{
                      color: palette.mutedForeground,
                      textAlign: "center",
                      fontSize: 13,
                    }}
                  >
                    Try reading a favorite bedtime story.
                  </Text>
                ) : null}
              </View>
            </Card>

            {/* Or pick file */}
            <Pressable onPress={handlePickFile}>
              <Card>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.md,
                  }}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: radii.md,
                      backgroundColor: palette.muted,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <FileAudio size={18} color={palette.foreground} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: palette.foreground,
                        fontWeight: typography.weights.semibold,
                      }}
                    >
                      Choose an audio file
                    </Text>
                    <Text
                      style={{ color: palette.mutedForeground, fontSize: 13 }}
                    >
                      MP3, M4A, or WAV — up to 10MB.
                    </Text>
                  </View>
                  <Upload size={18} color={palette.mutedForeground} />
                </View>
              </Card>
            </Pressable>

            {/* Chosen sample preview */}
            {sample ? (
              <Card>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.md,
                  }}
                >
                  <Pressable
                    onPress={togglePreview}
                    style={[
                      styles.playBtn,
                      { backgroundColor: brand.green + "1A" },
                    ]}
                  >
                    {previewPlaying ? (
                      <Pause size={18} color={brand.green} />
                    ) : (
                      <Play size={18} color={brand.green} />
                    )}
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: palette.foreground,
                        fontWeight: typography.weights.semibold,
                      }}
                      numberOfLines={1}
                    >
                      {sample.name}
                    </Text>
                    <Text
                      style={{ color: palette.mutedForeground, fontSize: 13 }}
                    >
                      {sample.size
                        ? `${(sample.size / (1024 * 1024)).toFixed(1)} MB`
                        : "Ready to upload"}
                    </Text>
                  </View>
                </View>
              </Card>
            ) : null}

            {error ? (
              <Text style={{ color: palette.destructive }}>{error}</Text>
            ) : null}

            <Button
              title="Upload & process"
              onPress={handleUploadAndProcess}
              loading={busy}
              disabled={!sample || !!recording}
            />
          </View>
        ) : null}

        {step === 3 ? (
          <View style={{ gap: spacing.lg, marginTop: spacing.lg, alignItems: "center" }}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: radii.pill,
                backgroundColor:
                  processingStatus === "ready"
                    ? brand.green + "1A"
                    : processingStatus === "failed"
                      ? brand.coral + "1A"
                      : brand.gold + "1A",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {processingStatus === "ready" ? (
                <CheckCircle2 size={32} color={brand.green} />
              ) : processingStatus === "failed" ? (
                <XCircle size={32} color={brand.coral} />
              ) : (
                <ActivityIndicator color={brand.gold} />
              )}
            </View>
            <Text
              style={{
                fontSize: typography.sizes.xxl,
                fontWeight: typography.weights.bold,
                color: palette.foreground,
                textAlign: "center",
              }}
            >
              {processingStatus === "ready"
                ? "Voice is ready!"
                : processingStatus === "failed"
                  ? "Something went wrong"
                  : "Processing voice…"}
            </Text>
            <Text
              style={{ color: palette.mutedForeground, textAlign: "center" }}
            >
              {processingStatus === "ready"
                ? `${name}'s voice has been cloned successfully.`
                : processingStatus === "failed"
                  ? "Voice cloning failed. Please try again with a different sample."
                  : `We're cloning ${name}'s voice. This usually takes 1–2 minutes.`}
            </Text>

            {processingStatus === "failed" ? (
              <Button title="Try again" variant="outline" onPress={() => setStep(2)} />
            ) : processingStatus === "ready" ? (
              <Button title="Done" onPress={() => navigation.goBack()} />
            ) : null}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </Screen>
  );
}

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60)
    .toString()
    .padStart(1, "0");
  const s = (sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

const styles = StyleSheet.create({
  stepper: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginTop: spacing.sm,
  },
  stepperDot: {
    height: 6,
    width: 56,
    borderRadius: radii.pill,
  },
  recordBtn: {
    width: 84,
    height: 84,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  playBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    alignItems: "center",
    justifyContent: "center",
  },
});
