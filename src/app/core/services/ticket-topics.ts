import type { Ticket } from './models';

export function topicKey(value: string): string {
  return value.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('es');
}

export function normalizeTopics(values: readonly string[], known: readonly string[] = []): string[] {
  const canonical = new Map(known.map(value => [topicKey(value), value]));
  const unique = new Map<string, string>();
  for (const value of values) {
    const label = value.normalize('NFC').trim().replace(/\s+/g, ' ');
    const key = topicKey(label);
    if (key && !unique.has(key)) unique.set(key, canonical.get(key) ?? label);
  }
  return [...unique.values()];
}

export function ticketHasTopic(ticket: Pick<Ticket, 'topics'>, topic: string): boolean {
  return (ticket.topics ?? []).some(value => topicKey(value) === topicKey(topic));
}
