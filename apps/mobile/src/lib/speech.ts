import * as Speech from "expo-speech";
import { getLanguageDescriptor, type SupportedLanguage } from "@cyaccess/shared";

export function speak(
  text: string,
  options: { language: SupportedLanguage; rate?: number } = { language: "en" },
) {
  if (!text) return;
  const descriptor = getLanguageDescriptor(options.language);
  Speech.stop();
  Speech.speak(text, {
    language: descriptor.ttsLocale,
    rate: options.rate ?? 0.95,
  });
}

export function stopSpeech() {
  Speech.stop();
}
