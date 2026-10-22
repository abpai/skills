// Reference solution used only to prove the hidden acceptance tests are passable.
const UNITS: Array<[string, number]> = [
  ["d", 86_400_000],
  ["h", 3_600_000],
  ["m", 60_000],
  ["s", 1_000],
  ["ms", 1],
];

const PATTERN = /^(?:(\d+(?:\.\d+)?)d)?(?:(\d+(?:\.\d+)?)h)?(?:(\d+(?:\.\d+)?)m)?(?:(\d+(?:\.\d+)?)s)?(?:(\d+(?:\.\d+)?)ms)?$/;

export function parseDuration(input: string): number {
  const match = PATTERN.exec(input);
  if (!input || !match || match.slice(1).every((g) => g === undefined)) {
    throw new Error(`invalid duration ${JSON.stringify(input)}`);
  }
  let total = 0;
  UNITS.forEach(([, factor], i) => {
    const part = match[i + 1];
    if (part !== undefined) total += Number(part) * factor;
  });
  return Math.round(total);
}
