// hooks/use-decompose.ts

"use client";

import { useCallback, useRef, useState } from "react";
import type { DecompositionTree, SSEEvent } from "@/lib/decompose/types";

interface DecomposeState {
  tree: DecompositionTree | null;
  isLoading: boolean;
  error: string | null;
  durationMs: number | null;
  selectedNodeId: string | null;
}

export function useDecompose() {
  const [state, setState] = useState<DecomposeState>({
    tree: null,
    isLoading: false,
    error: null,
    durationMs: null,
    selectedNodeId: null,
  });
  const abortRef = useRef<AbortController | null>(null);

  const decompose = useCallback(
    async (product: string, suppliers: string[]) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setState({
        tree: null,
        isLoading: true,
        error: null,
        durationMs: null,
        selectedNodeId: null,
      });

      try {
        const resp = await fetch("/api/decompose", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ product, suppliers }),
          signal: controller.signal,
        });

        if (!resp.ok || !resp.body) {
          throw new Error(`HTTP ${resp.status}`);
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          let eventType = "";
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              eventType = line.slice(7).trim();
            } else if (line.startsWith("data: ") && eventType) {
              try {
                const data = JSON.parse(line.slice(6));
                handleEvent(
                  { type: eventType, ...data } as SSEEvent,
                  setState
                );
              } catch {
                // skip malformed JSON
              }
              eventType = "";
            }
          }
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: (e as Error).message,
          }));
        }
      }
    },
    []
  );

  const selectNode = useCallback((nodeId: string | null) => {
    setState((prev) => ({ ...prev, selectedNodeId: nodeId }));
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { ...state, decompose, selectNode, abort };
}

function handleEvent(
  event: SSEEvent,
  setState: React.Dispatch<React.SetStateAction<DecomposeState>>
) {
  switch (event.type) {
    case "skeleton":
      setState((prev) => ({ ...prev, tree: event.tree }));
      break;
    case "refining":
      setState((prev) => {
        if (!prev.tree) return prev;
        return { ...prev, tree: { ...prev.tree, phase: "refining" } };
      });
      break;
    case "verified":
      setState((prev) => ({ ...prev, tree: event.tree }));
      break;
    case "done":
      setState((prev) => ({
        ...prev,
        isLoading: false,
        durationMs: event.duration_ms,
      }));
      break;
    case "error":
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: event.message,
      }));
      break;
  }
}
