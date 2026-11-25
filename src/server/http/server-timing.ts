import "server-only";

type Stage = "auth" | "archive" | "profile" | "db_connect" | "db_query" | "db_prepare" | "validate" | "serialize";

/** Request-local durations only: never put tokens, SQL, IDs or payloads in headers. */
export class ServerTiming {
  private readonly started: number;
  private readonly durations = new Map<Stage, number>();
  constructor(private readonly now: () => number = () => performance.now()) {
    this.started = now();
  }
  private record(name: Stage, started: number) {
    this.durations.set(name, (this.durations.get(name) ?? 0) + Math.max(0, this.now() - started));
  }
  async measure<T>(name: Stage, operation: () => Promise<T>): Promise<T> {
    const started = this.now();
    try { return await operation(); }
    finally { this.record(name, started); }
  }
  measureSync<T>(name: Stage, operation: () => T): T {
    const started = this.now();
    try { return operation(); }
    finally { this.record(name, started); }
  }
  finish(response: Response): Response {
    const entries = [...this.durations].map(([name, duration]) => `${name};dur=${duration.toFixed(1)}`);
    entries.push(`total;dur=${Math.max(0, this.now() - this.started).toFixed(1)}`);
    response.headers.set("Server-Timing", entries.join(", "));
    return response;
  }
}
