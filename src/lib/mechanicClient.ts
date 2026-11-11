import { hasRemoteMechanic, mechanicAi } from "../config/mechanicAi";
import { composeMechanicReply, type MechanicContext, type MechanicReply } from "./mechanicEngine";

/**
 * Returns a mechanic reply. Uses the free offline rule engine unless
 * `mechanicAi.endpoint` is later set. That remote path is not used in
 * the shipped build and must not be turned on without a cost check.
 */
export async function getMechanicReply(input: string, ctx: MechanicContext = {}): Promise<MechanicReply> {
  if (!hasRemoteMechanic()) {
    return composeMechanicReply(input, ctx);
  }
  const endpoint = mechanicAi.endpoint.trim();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const key = mechanicAi.apiKey.trim();
  if (key) headers.Authorization = `Bearer ${key}`;
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ message: input }),
    });
    if (!res.ok) return composeMechanicReply(input, ctx);
    const data = (await res.json()) as { text?: string };
    if (!data.text?.trim()) return composeMechanicReply(input, ctx);
    return { intent: "fallback", text: data.text.trim(), links: composeMechanicReply(input, ctx).links };
  } catch {
    return composeMechanicReply(input, ctx);
  }
}
