export type SSEEvent = { event: string; data: unknown };

export function formatSSE(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export function createSSEStream(
  producer: (write: (event: string, data: unknown) => Promise<void>) => Promise<void>,
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const write = async (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(formatSSE(event, data)));
      };
      try {
        await producer(write);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unexpected server error.';
        controller.enqueue(encoder.encode(formatSSE('error', { message })));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
