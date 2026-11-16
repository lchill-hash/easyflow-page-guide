import { mapPermissionState } from "../../shared/speech/permission";
import type {
  MicPermissionProbe,
  MicPermissionState,
} from "../../shared/speech/permission";

export interface MicPermissionsLike {
  query(descriptor: { name: string }): Promise<{ state: string }>;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  return value as Record<string, unknown>;
}

export function readMicPermissions(scope: unknown): MicPermissionsLike | null {
  const root = asRecord(scope);
  if (root === null) {
    return null;
  }
  const navigatorLike = asRecord(root["navigator"]);
  if (navigatorLike === null) {
    return null;
  }
  const permissions = asRecord(navigatorLike["permissions"]);
  if (permissions === null) {
    return null;
  }
  const query = permissions["query"];
  if (typeof query !== "function") {
    return null;
  }
  const queryFn = query as (
    this: unknown,
    descriptor: { name: string },
  ) => Promise<{ state: string }>;
  return {
    query(descriptor: { name: string }): Promise<{ state: string }> {
      return queryFn.call(permissions, descriptor);
    },
  };
}

export function createMicPermissionProbe(
  permissions: MicPermissionsLike | null,
): MicPermissionProbe {
  return {
    async query(): Promise<MicPermissionState> {
      if (permissions === null) {
        return "unsupported";
      }
      try {
        const status = await permissions.query({ name: "microphone" });
        return mapPermissionState((status as { state?: unknown } | null)?.state);
      } catch {
        return "unknown";
      }
    },
  };
}