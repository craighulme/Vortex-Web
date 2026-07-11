declare module "monaco-editor/esm/vs/editor/common/languages.js" {
  export const TokenizationRegistry: {
    get(languageId: string): unknown;
    getColorMap(): string[];
  };
}

declare module "monaco-editor/esm/vs/editor/common/encodedTokenAttributes.js" {
  export const TokenMetadata: {
    getClassNameFromMetadata(metadata: number): string;
    getForeground(metadata: number): number;
  };
}
