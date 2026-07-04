import type { UgcDraft, UgcDraftFileRef } from "./UgcTypes";

const DRAFTS_KEY = "vwebUgcDraftsV2";
const DB_NAME = "vweb-ugc-drafts";
const DB_VERSION = 1;
const FILE_STORE = "files";

export class UgcDraftStore {
  constructor(private readonly storage: Storage = window.localStorage) {}

  list(): UgcDraft[] {
    try {
      const raw = this.storage.getItem(DRAFTS_KEY);
      const parsed = raw ? JSON.parse(raw) as unknown : [];
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isDraft);
    } catch {
      return [];
    }
  }

  async save(draft: UgcDraft, files: { model: File; particles: Map<string, File> }): Promise<UgcDraft[]> {
    await putDraftFile(draft.modelFile.id, files.model);
    for (const particle of draft.particleFiles) {
      const file = files.particles.get(particle.emitterId);
      if (file) await putDraftFile(particle.file.id, file);
    }
    const previous = this.findMatchingDraft(draft);
    const nextDraft = {
      ...previous,
      ...draft,
      createdAt: previous?.createdAt || draft.createdAt || Date.now(),
      updatedAt: Date.now()
    };
    const drafts = this.list().filter((item) => item.id !== nextDraft.id && !sameDraftIdentity(item, nextDraft));
    drafts.unshift(nextDraft);
    this.write(drafts.slice(0, 100));
    return drafts;
  }

  findMatchingDraft(draft: Pick<UgcDraft, "id" | "identityKey">): UgcDraft | null {
    return this.list().find((item) => item.id === draft.id || sameDraftIdentity(item, draft)) || null;
  }

  async remove(id: string): Promise<UgcDraft[]> {
    const removed = this.list().find((item) => item.id === id);
    const drafts = this.list().filter((item) => item.id !== id);
    this.write(drafts);
    if (removed) {
      await deleteDraftFile(removed.modelFile.id);
      await Promise.all(removed.particleFiles.map((particle) => deleteDraftFile(particle.file.id)));
    }
    return drafts;
  }

  updateMetadata(id: string, patch: Partial<Pick<UgcDraft, "remoteItemId" | "remoteStatus" | "submittedAt" | "updatedAt">>): UgcDraft[] {
    const drafts = this.list().map((item) => item.id === id
      ? { ...item, ...patch, updatedAt: patch.updatedAt || item.updatedAt }
      : item);
    this.write(drafts);
    return drafts;
  }

  async loadModelFile(draft: UgcDraft): Promise<File | null> {
    return loadDraftFile(draft.modelFile);
  }

  async loadParticleFiles(draft: UgcDraft): Promise<Map<string, File>> {
    const files = new Map<string, File>();
    for (const particle of draft.particleFiles) {
      const file = await loadDraftFile(particle.file);
      if (file) files.set(particle.emitterId, file);
    }
    return files;
  }

  private write(drafts: UgcDraft[]): void {
    try {
      this.storage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
    } catch {}
  }
}

export function draftFileRef(id: string, file: File): UgcDraftFileRef {
  return {
    id,
    name: file.name,
    type: file.type,
    size: file.size,
    lastModified: file.lastModified || Date.now()
  };
}

async function putDraftFile(id: string, file: File): Promise<void> {
  const db = await openDb();
  await requestToPromise(db.transaction(FILE_STORE, "readwrite").objectStore(FILE_STORE).put(file, id));
  db.close();
}

async function loadDraftFile(ref: UgcDraftFileRef): Promise<File | null> {
  const db = await openDb();
  const value = await requestToPromise<Blob | File | undefined>(
    db.transaction(FILE_STORE, "readonly").objectStore(FILE_STORE).get(ref.id)
  );
  db.close();
  if (!value) return null;
  if (value instanceof File && value.name === ref.name) return value;
  return new File([value], ref.name, {
    type: ref.type || value.type || "application/octet-stream",
    lastModified: ref.lastModified || Date.now()
  });
}

async function deleteDraftFile(id: string): Promise<void> {
  const db = await openDb();
  await requestToPromise(db.transaction(FILE_STORE, "readwrite").objectStore(FILE_STORE).delete(id));
  db.close();
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(FILE_STORE)) db.createObjectStore(FILE_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("draft database failed to open"));
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("draft database request failed"));
  });
}

function isDraft(value: unknown): value is UgcDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as UgcDraft;
  return draft.schemaVersion === 1 &&
    isCleanString(draft.id) &&
    isCleanString(draft.name) &&
    (draft.kind === "avatar-item" || draft.kind === "character-morph" || draft.kind === "animation-pack") &&
    isCleanString(draft.rigVersion) &&
    isDraftFileRef(draft.modelFile) &&
    Array.isArray(draft.particleFiles) &&
    draft.particleFiles.every((particle) => isCleanString(particle.emitterId) && isDraftFileRef(particle.file)) &&
    !!draft.manifest &&
    typeof draft.manifest === "object" &&
    draft.manifest.apiVersion === 1;
}

function sameDraftIdentity(left: Pick<UgcDraft, "id" | "identityKey">, right: Pick<UgcDraft, "id" | "identityKey">): boolean {
  if (left.id && right.id && left.id === right.id) return true;
  return !!left.identityKey && !!right.identityKey && left.identityKey === right.identityKey;
}

function isDraftFileRef(value: unknown): value is UgcDraftFileRef {
  if (!value || typeof value !== "object") return false;
  const ref = value as UgcDraftFileRef;
  return isCleanString(ref.id) &&
    isCleanString(ref.name) &&
    typeof ref.type === "string" &&
    Number.isFinite(ref.size) &&
    Number.isFinite(ref.lastModified);
}

function isCleanString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length < 2048 && /^[\x20-\x7e]+$/.test(value);
}
