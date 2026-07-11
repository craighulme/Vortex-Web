export type WorkspaceLuaScript = {
  id: string;
  name: string;
  path: string;
  source: string;
  lastModified: number;
  workspace: true;
};

type WorkspaceAsset = {
  path: string;
  file: File;
  lastModified: number;
  url: string;
};

type FileSystemFileHandleLike = {
  kind: "file";
  name: string;
  getFile(): Promise<File>;
  createWritable?: () => Promise<{ write(value: string): Promise<void>; close(): Promise<void> }>;
};

type FileSystemDirectoryHandleLike = {
  kind: "directory";
  name: string;
  values(): AsyncIterable<FileSystemFileHandleLike | FileSystemDirectoryHandleLike>;
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandleLike>;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandleLike>;
  queryPermission?: (options?: { mode?: "read" | "readwrite" }) => Promise<PermissionState>;
  requestPermission?: (options?: { mode?: "read" | "readwrite" }) => Promise<PermissionState>;
};

type WorkspaceDb = IDBDatabase;

const WORKSPACE_DB = "vweb-lua-workspace";
const WORKSPACE_STORE = "handles";
const DIRECTORY_KEY = "directory";
const SCRIPT_EXT = ".lua";
const ASSET_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".avif"]);

export class ScriptWorkspaceService {
  private directory: FileSystemDirectoryHandleLike | null = null;
  private readonly scripts = new Map<string, WorkspaceLuaScript>();
  private readonly assets = new Map<string, WorkspaceAsset>();
  private pollTimer: number | null = null;
  private onChange: (() => void) | null = null;

  constructor(
    private readonly windowRef: Window,
    private readonly runtimeAssetBaseUrl: string
  ) {}

  supported(): boolean {
    return typeof (this.windowRef as Window & { showDirectoryPicker?: unknown }).showDirectoryPicker === "function";
  }

  mounted(): boolean {
    return Boolean(this.directory);
  }

  status(): { supported: boolean; mounted: boolean; name: string | null; scripts: number; assets: number } {
    return {
      supported: this.supported(),
      mounted: this.mounted(),
      name: this.directory?.name || null,
      scripts: this.scripts.size,
      assets: this.assets.size
    };
  }

  listScripts(): WorkspaceLuaScript[] {
    return [...this.scripts.values()].sort((a, b) => a.path.localeCompare(b.path));
  }

  async restore(): Promise<boolean> {
    if (!this.supported()) return false;
    const handle = await readPersistedHandle(this.windowRef).catch(() => null);
    if (!handle) return false;
    const granted = await queryPermission(handle, false);
    if (!granted) return false;
    this.directory = handle;
    await this.refresh();
    return true;
  }

  async chooseDirectory(): Promise<boolean> {
    if (!this.supported()) return false;
    const picker = (this.windowRef as Window & {
      showDirectoryPicker?: (options?: { id?: string; mode?: "read" | "readwrite" }) => Promise<FileSystemDirectoryHandleLike>;
    }).showDirectoryPicker;
    if (!picker) return false;
    const handle = await picker({ id: "vortex-web-lua-workspace", mode: "readwrite" });
    const granted = await queryPermission(handle, true);
    if (!granted) return false;
    this.directory = handle;
    await persistHandle(this.windowRef, handle).catch(() => {});
    await this.refresh();
    return true;
  }

  async refresh(): Promise<void> {
    if (!this.directory) return;
    const previousAssetUrls = new Map(this.assets);
    this.scripts.clear();
    this.assets.clear();

    await this.scanDirectory(this.directory, "", 0);

    for (const [key, asset] of previousAssetUrls) {
      const next = this.assets.get(key);
      if (!next || next.lastModified !== asset.lastModified) {
        URL.revokeObjectURL(asset.url);
      } else {
        URL.revokeObjectURL(next.url);
        this.assets.set(key, asset);
      }
    }
  }

  async writeScript(path: string, source: string): Promise<WorkspaceLuaScript | null> {
    if (!this.directory) return null;
    const cleanPath = sanitizeWorkspacePath(path);
    if (!cleanPath.endsWith(SCRIPT_EXT)) return null;
    const parts = cleanPath.split("/");
    const fileName = parts.pop();
    if (!fileName) return null;
    let directory = this.directory;
    for (const part of parts) directory = await directory.getDirectoryHandle(part, { create: true });
    const file = await directory.getFileHandle(fileName, { create: true });
    const writable = await file.createWritable?.();
    if (!writable) return null;
    await writable.write(source);
    await writable.close();
    await this.refresh();
    return this.scripts.get(workspaceScriptId(cleanPath)) ?? null;
  }

  startPolling(callback: () => void, intervalMs = 1000): void {
    this.stopPolling();
    this.onChange = callback;
    this.pollTimer = this.windowRef.setInterval(() => {
      void this.poll().catch(() => {});
    }, intervalMs);
  }

  stopPolling(): void {
    if (this.pollTimer !== null) this.windowRef.clearInterval(this.pollTimer);
    this.pollTimer = null;
    this.onChange = null;
  }

  assetUrl(path: unknown): string | null {
    const raw = String(path || "").trim();
    if (/^(https:|http:|chrome-extension:|blob:)/i.test(raw)) return null;
    const clean = sanitizeWorkspacePath(raw);
    if (!clean) return null;
    const local = this.assets.get(clean) || this.assets.get(`assets/${clean}`);
    if (local) return local.url;
    return new URL(`lua/assets/${clean}`, this.runtimeAssetBaseUrl).href;
  }

  private async poll(): Promise<void> {
    if (!this.directory) return;
    const before = fingerprintScripts(this.scripts);
    await this.refresh();
    const after = fingerprintScripts(this.scripts);
    if (before !== after) this.onChange?.();
  }

  private async scanDirectory(directory: FileSystemDirectoryHandleLike, prefix: string, depth: number): Promise<void> {
    if (depth > 5) return;
    for await (const entry of directory.values()) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.kind === "directory") {
        if (entry.name.startsWith(".")) continue;
        await this.scanDirectory(entry, path, depth + 1);
        continue;
      }
      const lower = entry.name.toLowerCase();
      if (lower.endsWith(SCRIPT_EXT)) {
        const file = await entry.getFile();
        const source = await file.text();
        const cleanPath = sanitizeWorkspacePath(path);
        this.scripts.set(workspaceScriptId(cleanPath), {
          id: workspaceScriptId(cleanPath),
          name: entry.name.replace(/\.lua$/i, ""),
          path: cleanPath,
          source,
          lastModified: file.lastModified,
          workspace: true
        });
      } else if (isAssetFile(lower)) {
        const file = await entry.getFile();
        const cleanPath = sanitizeWorkspacePath(path);
        this.assets.set(cleanPath, {
          path: cleanPath,
          file,
          lastModified: file.lastModified,
          url: URL.createObjectURL(file)
        });
      }
    }
  }
}

export function workspaceScriptId(path: string): string {
  return `workspace:${sanitizeWorkspacePath(path)}`;
}

function fingerprintScripts(scripts: Map<string, WorkspaceLuaScript>): string {
  return [...scripts.values()]
    .map((script) => `${script.path}:${script.lastModified}:${script.source.length}`)
    .sort()
    .join("|");
}

function sanitizeWorkspacePath(path: string): string {
  return path
    .replace(/\\/g, "/")
    .split("/")
    .filter((part) => part && part !== "." && part !== ".." && !part.includes(":"))
    .join("/")
    .slice(0, 240);
}

function isAssetFile(lowerName: string): boolean {
  const index = lowerName.lastIndexOf(".");
  return index >= 0 && ASSET_EXTENSIONS.has(lowerName.slice(index));
}

async function queryPermission(handle: FileSystemDirectoryHandleLike, request: boolean): Promise<boolean> {
  if (request && handle.requestPermission) {
    return await handle.requestPermission({ mode: "readwrite" }) === "granted";
  }
  if (handle.queryPermission) {
    return await handle.queryPermission({ mode: "readwrite" }) === "granted";
  }
  return true;
}

async function openDb(windowRef: Window): Promise<WorkspaceDb> {
  return await new Promise((resolve, reject) => {
    const request = windowRef.indexedDB.open(WORKSPACE_DB, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(WORKSPACE_STORE);
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

async function persistHandle(windowRef: Window, handle: FileSystemDirectoryHandleLike): Promise<void> {
  const db = await openDb(windowRef);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(WORKSPACE_STORE, "readwrite");
    tx.objectStore(WORKSPACE_STORE).put(handle, DIRECTORY_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

async function readPersistedHandle(windowRef: Window): Promise<FileSystemDirectoryHandleLike | null> {
  const db = await openDb(windowRef);
  const result = await new Promise<FileSystemDirectoryHandleLike | null>((resolve, reject) => {
    const tx = db.transaction(WORKSPACE_STORE, "readonly");
    const request = tx.objectStore(WORKSPACE_STORE).get(DIRECTORY_KEY);
    request.onsuccess = () => resolve((request.result as FileSystemDirectoryHandleLike | undefined) || null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return result;
}
