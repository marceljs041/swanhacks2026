import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  AiHazardSuggestion,
  CreateHazardInput,
  Hazard,
  HazardVote,
} from "@cyaccess/shared";
import { apiFetch } from "../api";

type ListResp = { hazards: Hazard[] };
type OneResp = { hazard: Hazard };
type SuggestionResp = { suggestion: AiHazardSuggestion };
type UploadResp = { uploadUrl: string; token: string; path: string; publicReadUrl: string };

export function useHazards(filter?: { buildingId?: string; floorId?: string }) {
  const params = new URLSearchParams();
  if (filter?.buildingId) params.set("buildingId", filter.buildingId);
  if (filter?.floorId) params.set("floorId", filter.floorId);
  const qs = params.toString();
  return useQuery({
    queryKey: ["hazards", filter ?? null],
    queryFn: () => apiFetch<ListResp>(`/hazards${qs ? `?${qs}` : ""}`),
    staleTime: 30_000,
  });
}

export function useHazard(id: string | null) {
  return useQuery({
    enabled: !!id,
    queryKey: ["hazard", id],
    queryFn: () => apiFetch<OneResp>(`/hazards/${id}`),
  });
}

export function useCreateHazard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateHazardInput) =>
      apiFetch<OneResp>("/hazards", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hazards"] });
    },
  });
}

export function useResolveHazard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<OneResp>(`/hazards/${id}/resolve`, { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hazards"] }),
  });
}

export function useVoteHazard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: { id: string; vote: HazardVote }) =>
      apiFetch<OneResp>(`/hazards/${args.id}/vote`, {
        method: "POST",
        body: JSON.stringify({ vote: args.vote }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hazards"] }),
  });
}

export function useHazardUpload() {
  return useMutation({
    mutationFn: () =>
      apiFetch<UploadResp>("/hazards/uploads", { method: "POST" }),
  });
}

export function useClassifyHazard() {
  return useMutation({
    mutationFn: (input: {
      imageUrl: string;
      buildingId?: string | null;
      floorId?: string | null;
    }) =>
      apiFetch<SuggestionResp>("/ai/classify-hazard", {
        method: "POST",
        body: JSON.stringify(input),
      }),
  });
}
