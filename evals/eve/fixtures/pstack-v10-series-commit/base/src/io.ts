export interface Io {
  out: (line: string) => void;
  err: (line: string) => void;
  /** Stops long-running commands such as followed streams. */
  signal?: AbortSignal;
}
