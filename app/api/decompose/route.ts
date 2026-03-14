// app/api/decompose/route.ts

import { runPipeline } from "@/lib/decompose/pipeline";
import type { DecomposeRequest } from "@/lib/decompose/types";

export const maxDuration = 300; // 5 minutes for Vercel

export async function POST(request: Request) {
  let body: DecomposeRequest;
  try {
    body = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const { product, suppliers = [] } = body;
  if (!product || typeof product !== "string") {
    return new Response("Missing product name", { status: 400 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const event of runPipeline(product, suppliers, request.signal)) {
          controller.enqueue(encoder.encode(event));
        }
      } catch (e) {
        const errorEvent = `event: error\ndata: ${JSON.stringify({
          message: e instanceof Error ? e.message : "Pipeline failed",
        })}\n\n`;
        controller.enqueue(encoder.encode(errorEvent));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
