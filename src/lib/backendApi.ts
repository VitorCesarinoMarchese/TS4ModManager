import { toBackendErrorCode, type ApiError } from "./error";
import type { DryRunResult, GameInstance, Issue, Mod } from "./types";

type ScannedModDto = Omit<Mod, "id"> & {
  id?: string;
  key?: string;
};

type ModMetadataDto = {
  id?: string;
  modId?: string;
  name?: string;
  displayName?: string;
  files?: string[];
  source?: string;
  sourceUrl?: string;
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

type UninstallResult = {
  modId: string;
  trashedPath: string;
  issues: Issue[];
};

function modFromMetadata(mod: ModMetadataDto, fallbackId: string, fallbackName: string): Mod {
  return {
    id: mod.id ?? mod.modId ?? fallbackId,
    name: mod.displayName ?? mod.name ?? fallbackName,
    files: mod.files ?? [],
    enabled: false,
    source: mod.source === "external" ? "external" : "managed",
    sourceUrl: mod.sourceUrl
  };
}

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
    },

    async renameModDisplayName(modId: string, displayName: string): Promise<Mod> {
      try {
        const mod = await invoke<ModMetadataDto>("rename_mod_display_name", {
          modId,
          displayName
        });
        return modFromMetadata(mod, modId, displayName);
      } catch (error) {
        throw normalizeError(error);
      }
    },

    async removeSourceUrl(modId: string): Promise<Mod> {
      try {
        const mod = await invoke<ModMetadataDto>("remove_source_url", { modId });
        return modFromMetadata(mod, modId, mod.displayName ?? mod.name ?? modId);
      } catch (error) {
        throw normalizeError(error);
      }
    },

    async uninstallManagedMod(modId: string, instanceId: string): Promise<UninstallResult> {
      try {
        return await invoke<UninstallResult>("uninstall_managed_mod", { modId, instanceId });
      } catch (error) {
        throw normalizeError(error);
      }
    },

    async openManagedModsFolder(): Promise<void> {
      try {
        await invoke("open_managed_mods_folder");
      } catch (error) {
        throw normalizeError(error);
      }
    },

    async openTrashFolder(): Promise<void> {
      try {
        await invoke("open_trash_folder");
      } catch (error) {
        throw normalizeError(error);
      }
    },

    async attachSourceUrl(modId: string, sourceUrl: string, providerId?: string): Promise<Mod> {
      try {
        const mod = await invoke<ModMetadataDto>("attach_source_url", {
          modId,
          sourceUrl,
          providerId
        });
        return modFromMetadata(mod, modId, mod.displayName ?? mod.name ?? modId);
      } catch (error) {
        throw normalizeError(error);
      }
    }
  };
}
