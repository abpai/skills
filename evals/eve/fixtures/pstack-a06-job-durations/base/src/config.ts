export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export interface JobConfig {
  name: string;
  command: string[];
  timeout: number;
  retryDelay: number;
  retries: number;
}

export interface Config {
  jobs: JobConfig[];
}

type RawObject = Record<string, unknown>;

const isObject = (value: unknown): value is RawObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function millis(value: unknown, job: string, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new ConfigError(`job "${job}": ${field} must be a non-negative number of milliseconds`);
  }
  return value;
}

function parseJob(raw: unknown, index: number): JobConfig {
  if (!isObject(raw)) throw new ConfigError(`jobs[${index}] must be an object`);
  const name = raw.name;
  if (typeof name !== "string" || name === "") {
    throw new ConfigError(`jobs[${index}].name must be a non-empty string`);
  }
  const command = raw.command;
  if (!Array.isArray(command) || command.length === 0 || !command.every((c) => typeof c === "string")) {
    throw new ConfigError(`job "${name}": command must be a non-empty array of strings`);
  }
  const retries = raw.retries ?? 0;
  if (typeof retries !== "number" || !Number.isInteger(retries) || retries < 0) {
    throw new ConfigError(`job "${name}": retries must be a non-negative integer`);
  }
  return {
    name,
    command,
    timeout: millis(raw.timeout ?? 60_000, name, "timeout"),
    retryDelay: millis(raw.retryDelay ?? 1_000, name, "retryDelay"),
    retries,
  };
}

export function parseConfig(text: string): Config {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    throw new ConfigError(`invalid JSON: ${(err as Error).message}`);
  }
  if (!isObject(raw) || !Array.isArray(raw.jobs)) {
    throw new ConfigError("config must be an object with a jobs array");
  }
  const jobs = raw.jobs.map(parseJob);
  const seen = new Set<string>();
  for (const job of jobs) {
    if (seen.has(job.name)) throw new ConfigError(`duplicate job name "${job.name}"`);
    seen.add(job.name);
  }
  return { jobs };
}

export async function loadConfig(path: string): Promise<Config> {
  return parseConfig(await Bun.file(path).text());
}
