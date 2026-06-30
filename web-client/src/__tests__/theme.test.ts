import { describe, expect, it } from "vitest";
import { ThemeService } from "../ui/ThemeService";

describe("ThemeService", () => {
  it("applies and persists allowed runtime theme variables", () => {
    const storage = memoryStorage();
    const documentRef = { documentElement: { style: styleStore() } } as unknown as Document;
    const windowRef = {} as Window & Record<string, unknown>;
    const service = new ThemeService(documentRef, storage).installGlobal(windowRef);

    service.setVariable("--vw-ui-accent", "#ff00aa");
    service.setVariable("--not-allowed", "red");

    expect(documentRef.documentElement.style.getPropertyValue("--vw-ui-accent")).toBe("#ff00aa");
    expect(documentRef.documentElement.style.getPropertyValue("--not-allowed")).toBe("");
    expect(JSON.parse(storage.getItem("vwebRuntimeTheme") || "{}")).toEqual({
      variables: { "--vw-ui-accent": "#ff00aa" }
    });
    expect((windowRef.VortexTheme as { get(): unknown }).get()).toEqual({
      variables: { "--vw-ui-accent": "#ff00aa" }
    });
  });

  it("loads saved variables and can reset them", () => {
    const storage = memoryStorage({
      vwebRuntimeTheme: JSON.stringify({ variables: { "--vw-ui-radius": "10px" } })
    });
    const documentRef = { documentElement: { style: styleStore() } } as unknown as Document;
    const service = new ThemeService(documentRef, storage);

    service.load();
    expect(documentRef.documentElement.style.getPropertyValue("--vw-ui-radius")).toBe("10px");

    service.reset();
    expect(documentRef.documentElement.style.getPropertyValue("--vw-ui-radius")).toBe("");
    expect(storage.getItem("vwebRuntimeTheme")).toBeNull();
  });
});

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); }
  };
}

function styleStore() {
  const values = new Map<string, string>();
  return {
    setProperty: (key: string, value: string) => { values.set(key, value); },
    removeProperty: (key: string) => { values.delete(key); },
    getPropertyValue: (key: string) => values.get(key) ?? ""
  };
}
