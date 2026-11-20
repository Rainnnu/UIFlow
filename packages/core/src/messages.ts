// View metadata is separate from the domain IR. IDs are resolved by the host registry only.
export interface SourceAction { id: string; label: string; location: string }
export type SourceActions = Record<string, SourceAction[]>;
export type ViewRequest = { type: 'requestGraph'; requestId: string } | { type: 'revealSource'; requestId: string; sourceRefId: string };
export function parseViewRequest(value: unknown): ViewRequest | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return;
  const message = value as Record<string, unknown>;
  if (typeof message.requestId !== 'string' || !message.requestId.length || message.requestId.length > 100) return;
  const keys = message.type === 'requestGraph' ? ['type', 'requestId'] : message.type === 'revealSource' ? ['type', 'requestId', 'sourceRefId'] : [];
  if (!keys.length || Object.keys(message).some(key => !keys.includes(key))) return;
  if (message.type === 'revealSource' && (typeof message.sourceRefId !== 'string' || !message.sourceRefId.length || message.sourceRefId.length > 200)) return;
  return message as ViewRequest;
}
