/**
 * Optional future hook for a remote mechanic LLM.
 * Leave `endpoint` empty to keep the built-in offline rule engine
 * (no network, no API cost). Do not put API keys or personal info here.
 */
export type MechanicAiConfig = {
  /** POST URL for a future chat API. Empty = use the local rule engine. */
  endpoint: string;
  /** Optional bearer token for that API. Leave empty. */
  apiKey: string;
};

export const mechanicAi: MechanicAiConfig = {
  endpoint: "",
  apiKey: "",
};

export function hasRemoteMechanic(): boolean {
  return mechanicAi.endpoint.trim().length > 0;
}
