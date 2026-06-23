type DiagnosticPayload = Record<string, unknown>;

export class DiagnosticsService {
  info(event: string, payload: DiagnosticPayload = {}): void {
    console.info(`[Vortex Web] ${event}`, payload);
  }

  warn(event: string, payload: DiagnosticPayload = {}): void {
    console.warn(`[Vortex Web] ${event}`, payload);
  }

  error(event: string, payload: DiagnosticPayload = {}): void {
    console.error(`[Vortex Web] ${event}`, payload);
  }
}
