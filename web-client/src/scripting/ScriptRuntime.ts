import type { DiagnosticsService } from "../diagnostics/DiagnosticsService";
import type { EventBus } from "../runtime/EventBus";
import type { RuntimeEventMap } from "../runtime/types";
import { PermissionSet, type ScriptPermission } from "./permissions";

export type ScriptLanguage = "js-module" | "lua";

export type ScriptPackage = {
  id: string;
  apiVersion: number;
  language: ScriptLanguage;
  sourceUrl?: string;
  source?: string;
  integrity?: string;
  permissions?: ScriptPermission[];
};

export const SCRIPT_API_VERSION = 1;

export class ScriptRuntime {
  private readonly packages = new Map<string, ScriptPackage>();

  constructor(
    private readonly events: EventBus<RuntimeEventMap>,
    private readonly diagnostics: DiagnosticsService
  ) {}

  registerPackage(pkg: ScriptPackage): boolean {
    const rejection = validateScriptPackage(pkg);
    if (rejection) {
      this.events.emit("script:package-rejected", { reason: rejection });
      this.diagnostics.warn("script.package.rejected", { id: pkg.id, reason: rejection });
      return false;
    }
    this.packages.set(pkg.id, pkg);
    return true;
  }

  permissionsFor(id: string): PermissionSet {
    return new PermissionSet(this.packages.get(id)?.permissions ?? []);
  }
}

export function validateScriptPackage(pkg: ScriptPackage): string | null {
  if (!pkg.id) return "missing id";
  if (pkg.apiVersion !== SCRIPT_API_VERSION) return "unsupported api version";
  if (pkg.language !== "js-module" && pkg.language !== "lua") return "unsupported language";
  if (!pkg.sourceUrl && !pkg.source) return "missing script source";
  if (pkg.sourceUrl && !pkg.integrity) return "remote script packages require integrity";
  return null;
}
