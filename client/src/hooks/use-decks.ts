import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type InsertDeck, type InsertCard } from "@shared/routes";

// List all decks
export function useDecks() {
  return useQuery({
    queryKey: [api.decks.list.path],
    queryFn: async () => {
      const res = await fetch(api.decks.list.path);
      if (!res.ok) throw new Error("Failed to fetch decks");
      return api.decks.list.responses[200].parse(await res.json());
    },
  });
}

// Get single deck with cards
export function useDeck(id: number) {
  return useQuery({
    queryKey: [api.decks.get.path, id],
    queryFn: async () => {
      const url = buildUrl(api.decks.get.path, { id });
      const res = await fetch(url);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to fetch deck");
      return api.decks.get.responses[200].parse(await res.json());
    },
    enabled: !!id,
  });
}

// Create a new deck
export function useCreateDeck() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: InsertDeck) => {
      const res = await fetch(api.decks.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create deck");
      return api.decks.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.decks.list.path] });
    },
  });
}

// Bulk create cards (for import)
export function useCreateCards() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ deckId, cards }: { deckId: number; cards: InsertCard[] }) => {
      const url = buildUrl(api.cards.create.path, { id: deckId });
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cards),
      });
      if (!res.ok) throw new Error("Failed to create cards");
      return api.cards.create.responses[201].parse(await res.json());
    },
    onSuccess: (_, { deckId }) => {
      queryClient.invalidateQueries({ queryKey: [api.decks.get.path, deckId] });
    },
  });
}

// Delete deck
export function useDeleteDeck() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.decks.delete.path, { id });
      const res = await fetch(url, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete deck");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.decks.list.path] });
    },
  });
}
