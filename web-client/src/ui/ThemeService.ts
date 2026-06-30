export type ThemeSnapshot = {
  variables: Record<string, string>;
};

const THEME_STORAGE_KEY = "vwebRuntimeTheme";
const ALLOWED_PREFIX = "--vw-ui-";

export class ThemeService {
  private variables: Record<string, string> = {};

  constructor(
    private readonly documentRef: Document,
    private readonly storage: Pick<Storage, "getItem" | "setItem" | "removeItem">
  ) {}

  installGlobal(windowRef: Window & Record<string, unknown>): this {
    this.load();
    windowRef.VortexTheme = {
      get: () => this.snapshot(),
      setVar: (name: string, value: string) => this.setVariable(name, value),
      apply: (variables: Record<string, unknown>) => this.apply(variables),
      reset: () => this.reset(),
      export: () => JSON.stringify(this.snapshot(), null, 2),
      import: (json: string) => this.import(json)
    };
    return this;
  }

  load(): ThemeSnapshot {
    try {
      const raw = this.storage.getItem(THEME_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed?.variables && typeof parsed.variables === "object") this.apply(parsed.variables, { persist: false });
    } catch {
      this.variables = {};
    }
    return this.snapshot();
  }

  snapshot(): ThemeSnapshot {
    return { variables: { ...this.variables } };
  }

  setVariable(name: string, value: string): ThemeSnapshot {
    const key = normalizeVariableName(name);
    if (!key) return this.snapshot();
    this.variables[key] = String(value);
    this.documentRef.documentElement.style.setProperty(key, this.variables[key]);
    this.persist();
    return this.snapshot();
  }

  apply(variables: Record<string, unknown>, options: { persist?: boolean } = {}): ThemeSnapshot {
    for (const [name, value] of Object.entries(variables || {})) {
      const key = normalizeVariableName(name);
      if (!key) continue;
      this.variables[key] = String(value);
      this.documentRef.documentElement.style.setProperty(key, this.variables[key]);
    }
    if (options.persist !== false) this.persist();
    return this.snapshot();
  }

  import(json: string): ThemeSnapshot {
    const parsed = JSON.parse(json);
    return this.apply(parsed?.variables && typeof parsed.variables === "object" ? parsed.variables : parsed);
  }

  reset(): ThemeSnapshot {
    for (const name of Object.keys(this.variables)) {
      this.documentRef.documentElement.style.removeProperty(name);
    }
    this.variables = {};
    this.storage.removeItem(THEME_STORAGE_KEY);
    return this.snapshot();
  }

  private persist(): void {
    this.storage.setItem(THEME_STORAGE_KEY, JSON.stringify(this.snapshot()));
  }
}

function normalizeVariableName(name: string): string | null {
  const key = String(name || "").trim();
  if (!key.startsWith(ALLOWED_PREFIX)) return null;
  if (!/^--vw-ui-[a-z0-9-]+$/i.test(key)) return null;
  return key;
}
