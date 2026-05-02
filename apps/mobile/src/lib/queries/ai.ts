import { useMutation } from "@tanstack/react-query";
import type { SupportedLanguage } from "@cyaccess/shared";
import { apiFetch } from "../api";

type CompanionMessage = { role: "user" | "assistant"; content: string };

type CompanionResp = { reply: string };

export function useAskCy() {
  return useMutation({
    mutationFn: (input: {
      language: SupportedLanguage;
      messages: CompanionMessage[];
      context?: string;
    }) =>
      apiFetch<CompanionResp>("/ai/companion", {
        method: "POST",
        body: JSON.stringify(input),
      }),
  });
}

type BoardResp = { result: { text: string; language: string; confidence: number } };

export function useExtractBoardText() {
  return useMutation({
    mutationFn: (imageUrl: string) =>
      apiFetch<BoardResp>("/ai/extract-board-text", {
        method: "POST",
        body: JSON.stringify({ imageUrl }),
      }),
  });
}

type BoardUploadResp = {
  uploadUrl: string;
  token: string;
  path: string;
  publicReadUrl: string;
};

export function useBoardUpload() {
  return useMutation({
    mutationFn: () => apiFetch<BoardUploadResp>("/ai/board-uploads", { method: "POST" }),
  });
}

export function useTranslate() {
  return useMutation({
    mutationFn: (input: { text: string; targetLanguage: SupportedLanguage }) =>
      apiFetch<{ translated: string }>("/ai/translate", {
        method: "POST",
        body: JSON.stringify(input),
      }),
  });
}
