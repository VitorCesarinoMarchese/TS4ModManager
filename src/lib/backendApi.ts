import { toBackendErrorCode, type ApiError } from "./error";
import type { DryRunResult, GameInstance, Issue, Mod } from "./types";

type ScannedModDto = Omit<Mod, "id"> & {
  id?: string;
  key?: string;
};

type InvokeFn = <T = unknown>(command: string, payload?: Record<string, unknown>) => Promise<T>;

type ApplyResult = {
  applied: boolean;
  issues: Issue[];
};

type MigrateResult = {
  managedModId: string;
  issues: Issue[];
};

function normalizeError(error: unknown): ApiError {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error &&
    typeof (error as { code: unknown }).code === "string" &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    const e = error as { code: string; message: string; details?: Record<string, unknown> };
    return {
      code: toBackendErrorCode(e.code),
      message: e.message,
      details: e.details
    };
  }

  return {
    code: "INTERNAL_ERROR",
    message: "Unknown backend error",
    details: { original: error }
  };
}

export function createBackendApi(invoke: InvokeFn) {
  return {
    async detectGameInstances(): Promise<GameInstance[]> {
      try {
        return await invoke<GameInstance[]>("detect_game_instances");
      } catch (error) {
        throw normalizeError(error);
      }
    },

    async scanMods(instanceId: string): Promise<Mod[]> {
      try {
        const mods = await invoke<ScannedModDto[]>("scan_mods", { instanceId });
        return mods.map(({ key, id, ...mod }) => ({
          ...mod,
          id: id ?? key ?? mod.name
        }));
      } catch (error) {
        throw normalizeError(error);
      }
    },

    async detectOrphanSymlinks(instanceId: string): Promise<{ path: string; target: string }[]> {
      try {
        return await invoke<{ path: string; target: string }[]>("detect_orphan_symlinks", {
          instanceId
        });
      } catch (error) {
        throw normalizeError(error);
      }
    },

    async validateCustomInstance(path: string): Promise<GameInstance> {
      try {
        return await invoke<GameInstance>("validate_custom_instance", { path });
      } catch (error) {
        throw normalizeError(error);
      }
    },

    async importArchive(archivePath: string, name: string, slug?: string): Promise<{ modId: string }> {
      try {
        return await invoke<{ modId: string }>("import_archive", { archivePath, name, slug });
      } catch (error) {
        throw normalizeError(error);
      }
    },

    async dryRunToggle(
      modId: string,
      targetEnabled: boolean,
      instanceId: string
    ): Promise<DryRunResult> {
      try {
        return await invoke<DryRunResult>("dry_run_toggle", {
          modId,
          targetEnabled,
          instanceId
        });
      } catch (error) {
        throw normalizeError(error);
      }
    },

    async applyToggle(
      modId: string,
      targetEnabled: boolean,
      instanceId: string
    ): Promise<ApplyResult> {
      try {
        return await invoke<ApplyResult>("apply_toggle", {
          modId,
          targetEnabled,
          instanceId
        });
      } catch (error) {
        throw normalizeError(error);
      }
    },

    async migrateExternalMod(modId: string, instanceId: string): Promise<MigrateResult> {
      try {
        return await invoke<MigrateResult>("migrate_external_mod", {
          modId,
          instanceId
        });
      } catch (error) {
        throw normalizeError(error);
      }
    }
  };
}
