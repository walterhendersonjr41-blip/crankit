/**
 * Optional future hook to sync driveway learning with a shared server.
 * Leave `endpoint` empty — learning stays on this device only (free, offline).
 * Do not put API keys or personal info here.
 */
export type MechanicSyncConfig = {
  endpoint: string;
  apiKey: string;
};

export const mechanicSync: MechanicSyncConfig = {
  endpoint: "",
  apiKey: "",
};

export function hasMechanicSync(): boolean {
  return mechanicSync.endpoint.trim().length > 0;
}
