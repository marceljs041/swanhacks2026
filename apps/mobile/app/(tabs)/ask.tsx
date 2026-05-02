import { useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { Screen } from "../../src/components/ui/Screen";
import { Chip } from "../../src/components/ui/Chip";
import { colors } from "../../src/theme/colors";
import { radii, tap } from "../../src/theme/spacing";
import { useAskCy } from "../../src/lib/queries/ai";
import { usePreferences } from "../../src/stores/preferences.store";
import { speak, stopSpeech } from "../../src/lib/speech";
import { routeCommand } from "../../src/features/companion/commandRouter";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  action?: { label: string; onPress: () => void };
};

const PROMPT_KEYS = [
  "ask.prompt.nearestElevator",
  "ask.prompt.nearestRestroom",
  "ask.prompt.routeParks",
  "ask.prompt.reportHazard",
] as const;

export default function AskScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const language = usePreferences((s) => s.language);
  const voiceGuidance = usePreferences((s) => s.accessibility.voiceGuidance);
  const voiceRate = usePreferences((s) => s.voiceRate);
  const askMutation = useAskCy();

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const append = (m: ChatMessage) => {
    setMessages((s) => {
      const next = [...s, m];
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
      return next;
    });
  };

  const handleSend = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    Haptics.selectionAsync();
    setInput("");
    append({ id: `u-${Date.now()}`, role: "user", content: trimmed });

    const intent = routeCommand(trimmed);
    if (intent.kind === "report") {
      append({
        id: `a-${Date.now()}`,
        role: "assistant",
        content: "Opening the hazard report form.",
        action: { label: "Open report", onPress: () => router.push("/reports/new") },
      });
      return;
    }
    if (intent.kind === "find") {
      const targetLabel =
        intent.target === "elevator"
          ? "nearest elevator"
          : intent.target === "restroom"
            ? "accessible restroom"
            : intent.target === "entrance"
              ? "accessible entrance"
              : "stairs";
      append({
        id: `a-${Date.now()}`,
        role: "assistant",
        content: `I'll show you the ${targetLabel} on the map.`,
        action: { label: "Show on map", onPress: () => router.push("/(tabs)/map") },
      });
      return;
    }
    if (intent.kind === "route") {
      append({
        id: `a-${Date.now()}`,
        role: "assistant",
        content: intent.to
          ? `Opening a route toward ${intent.to}. I'll prefer accessible paths.`
          : "Which building would you like to go to? Try \"route to Parks Library\".",
        action: intent.to
          ? { label: "Open map", onPress: () => router.push("/(tabs)/map") }
          : undefined,
      });
      return;
    }

    // Fall back to LLM for free-form.
    try {
      const resp = await askMutation.mutateAsync({
        language,
        messages: [
          ...messages.map((m) => ({ role: m.role, content: m.content })),
          { role: "user", content: trimmed },
        ],
      });
      append({ id: `a-${Date.now()}`, role: "assistant", content: resp.reply });
      if (voiceGuidance) speak(resp.reply, { language, rate: voiceRate });
    } catch (err) {
      append({
        id: `err-${Date.now()}`,
        role: "assistant",
        content: "I couldn't reach my brain just now. Try again in a moment.",
      });
    }
  };

  const renderItem = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === "user";
    return (
      <View
        style={[
          styles.bubbleWrap,
          isUser ? styles.bubbleRight : styles.bubbleLeft,
        ]}
      >
        <View
          style={[styles.bubble, isUser ? styles.userBubble : styles.cyBubble]}
        >
          <Text style={[styles.bubbleText, isUser && { color: "white" }]}>{item.content}</Text>
        </View>
        {item.action ? (
          <Pressable onPress={item.action.onPress} style={styles.actionCard}>
            <Text style={styles.actionText}>{item.action.label} →</Text>
          </Pressable>
        ) : null}
        {!isUser ? (
          <View style={styles.ttsRow}>
            <Pressable
              onPress={() => speak(item.content, { language, rate: voiceRate })}
              style={styles.ttsBtn}
            >
              <Text style={styles.ttsText}>🔊 {t("ask.tts.start")}</Text>
            </Pressable>
            <Pressable onPress={stopSpeech} style={styles.ttsBtn}>
              <Text style={styles.ttsText}>■ {t("ask.tts.stop")}</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          <Text style={styles.title}>{t("ask.title")}</Text>
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderItem}
          ListHeaderComponent={
            <View style={styles.promptRow}>
              {PROMPT_KEYS.map((key) => (
                <Chip key={key} label={t(key)} onPress={() => handleSend(t(key))} />
              ))}
            </View>
          }
          contentContainerStyle={styles.list}
        />

        <View style={styles.inputBar}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={t("ask.placeholder")}
            placeholderTextColor={colors.muted}
            style={styles.input}
            returnKeyType="send"
            onSubmitEditing={() => handleSend(input)}
          />
          <Pressable
            onLongPress={() => {
              // Placeholder for push-to-talk / STT integration.
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }}
            style={styles.mic}
            accessibilityLabel={t("ask.mic")}
            accessibilityRole="button"
          >
            <Text style={{ fontSize: 18 }}>🎙</Text>
          </Pressable>
          <Pressable
            onPress={() => handleSend(input)}
            style={[styles.send, askMutation.isPending && { opacity: 0.5 }]}
            accessibilityRole="button"
            disabled={askMutation.isPending}
          >
            <Text style={styles.sendText}>↑</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { padding: 20, paddingBottom: 4 },
  title: { fontSize: 26, fontWeight: "800", color: colors.cycloneDark },
  list: { padding: 16, gap: 10 },
  promptRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  bubbleWrap: { marginBottom: 10 },
  bubbleLeft: { alignItems: "flex-start" },
  bubbleRight: { alignItems: "flex-end" },
  bubble: { padding: 12, borderRadius: radii.lg, maxWidth: "85%" },
  userBubble: { backgroundColor: colors.cardinal },
  cyBubble: { backgroundColor: colors.offWhite, borderWidth: 1, borderColor: "rgba(0,0,0,0.06)" },
  bubbleText: { fontSize: 15, color: colors.slate, lineHeight: 20 },
  actionCard: {
    marginTop: 6,
    backgroundColor: colors.gold,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radii.md,
  },
  actionText: { color: colors.cycloneDark, fontWeight: "700" },
  ttsRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  ttsBtn: { paddingHorizontal: 10, paddingVertical: 4 },
  ttsText: { fontSize: 12, color: colors.info, fontWeight: "600" },
  inputBar: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.06)",
    alignItems: "center",
  },
  input: {
    flex: 1,
    minHeight: tap.minSize,
    backgroundColor: colors.offWhite,
    borderRadius: 999,
    paddingHorizontal: 16,
    fontSize: 15,
    color: colors.slate,
  },
  mic: {
    width: tap.minSize,
    height: tap.minSize,
    borderRadius: tap.minSize / 2,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  send: {
    width: tap.minSize,
    height: tap.minSize,
    borderRadius: tap.minSize / 2,
    backgroundColor: colors.cardinal,
    alignItems: "center",
    justifyContent: "center",
  },
  sendText: { color: "white", fontSize: 20, fontWeight: "800" },
});
