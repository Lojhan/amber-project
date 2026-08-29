export type StreamEvent = { id: string; type: string; data: unknown };
export type EventConnection = {
  close: () => void;
  lastEventId: () => string | undefined;
};

export const projectionEventTypes = [
  "quotation.completed",
  "quotation.parsed",
  "matching.resolved",
  "negotiation.started",
  "OfferSubmitted",
  "OfferRejected",
  "SupplierCapacityChanged",
  "negotiation.completed",
  "decision.recommended",
  "purchase-order.issued",
] as const;

export function connectEvents(
  url: string,
  onEvent: (event: StreamEvent) => void,
  onInvalidate: () => void,
): EventConnection {
  let lastEventId: string | undefined;
  const stream = new EventSource(url);
  const seen = new Set<string>();
  const consume = (event: MessageEvent<string>) => {
    if (!event.lastEventId || seen.has(event.lastEventId)) return;
    let data: unknown;
    try {
      data = JSON.parse(event.data);
    } catch {
      onInvalidate();
      return;
    }
    seen.add(event.lastEventId);
    if (seen.size > 250) seen.delete(seen.values().next().value as string);
    lastEventId = event.lastEventId;
    onEvent({ id: event.lastEventId, type: event.type, data });
  };

  stream.onmessage = consume;

  for (const type of projectionEventTypes)
    stream.addEventListener(type, consume);
  stream.onerror = () => onInvalidate();

  return { close: () => stream.close(), lastEventId: () => lastEventId };
}

export async function pollUntil<T>(
  read: () => Promise<T>,
  done: (value: T) => boolean,
  attempts = 8,
  signal?: AbortSignal,
  delay = 25,
): Promise<T> {
  let value = await read();
  for (let attempt = 1; !done(value) && attempt < attempts; attempt += 1) {
    if (signal?.aborted)
      throw new DOMException("Polling aborted", "AbortError");
    await new Promise<void>((resolve) => setTimeout(resolve, delay * attempt));
    value = await read();
  }
  return value;
}
