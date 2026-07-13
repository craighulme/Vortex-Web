type DiagnosticPayload = Record<string, unknown>;

export class DiagnosticsService {
  info(event: string, payload: DiagnosticPayload = {}): void {
    console.info(formatDiagnosticLine(event, payload), payload);
  }

  warn(event: string, payload: DiagnosticPayload = {}): void {
    console.warn(formatDiagnosticLine(event, payload), payload);
  }

  error(event: string, payload: DiagnosticPayload = {}): void {
    console.error(formatDiagnosticLine(event, payload), payload);
  }
}

function formatDiagnosticLine(event: string, payload: DiagnosticPayload): string {
  const summary = summarizePayload(payload);
  return summary ? `[Vortex Web] ${event} ${summary}` : `[Vortex Web] ${event}`;
}

function summarizePayload(payload: DiagnosticPayload): string {
  if (!payload || Object.keys(payload).length === 0) return "";
  try {
    const text = JSON.stringify(payload, (_key, value) => {
      if (value instanceof Error) return `${value.name}: ${value.message}`;
      if (typeof value === "function") return "[function]";
      return value;
    });
    return text.length > 500 ? `${text.slice(0, 497)}...` : text;
  } catch {
    return String(payload);
  }
}
