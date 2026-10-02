export const normalize = (s: string) =>
  s.normalize("NFKC").trim().toLocaleLowerCase("en").replace(/\s+/g, " ");
export const clamp = (n: number, min = 0, max = 1) =>
  Math.max(min, Math.min(max, n));
export const partyPoints = (raw: number, max: number) =>
  max > 0 ? Math.round(100 * clamp(raw / max)) : 0;
export const syncFactor = (k: number, n: number) =>
  n > 1 ? (k - 1) / (n - 1) : 0;
export const uniqueFactor = (k: number) => (k > 0 ? 1 / k : 0);
export const roundPoints = (n: number) => Math.round(n * 100) / 100;
export function canonical(
  value: string,
  merges: [string, string][] = [],
  aliases: Record<string, string> = {},
) {
  let result = Object.hasOwn(aliases, normalize(value))
    ? aliases[normalize(value)]
    : normalize(value);
  for (let i = 0; i < merges.length + 1; i++) {
    const link = merges.find(([from]) => normalize(from) === result);
    if (!link) break;
    result = normalize(link[1]);
  }
  return result;
}
export function groups(
  answers: Record<string, string>,
  merges: [string, string][] = [],
) {
  const result: Record<string, string[]> = Object.create(null);
  for (const [id, answer] of Object.entries(answers)) {
    const key = canonical(answer, merges);
    (result[key] ??= []).push(id);
  }
  return result;
}
export function accepted(
  answer: string,
  expected: string,
  aliases: string[] = [],
) {
  return [expected, ...aliases].some((a) => normalize(a) === normalize(answer));
}
