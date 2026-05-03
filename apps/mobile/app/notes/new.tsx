import { useEffect, useRef } from "react";
import { ActivityIndicator, View } from "react-native";
import { useRouter } from "expo-router";
import { recordXp, upsertNote } from "@/db/repositories";
import { XP_RULES } from "@studynest/shared";
import { colors } from "@/theme";

export default function NewNoteModal() {
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      try {
        const note = await upsertNote({ title: "Untitled" });
        await recordXp("createNote", XP_RULES.createNote);
        router.replace({ pathname: "/notes/[id]", params: { id: note.id } });
      } catch (e) {
        console.error("NewNoteModal", e);
        router.back();
      }
    })();
  }, [router]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: "center" }}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}
