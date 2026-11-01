/** Native JSON projection shared by HTTP responses and immutable audit snapshots. */
export function jsonValue<T>(value: T): unknown {
  return JSON.parse(JSON.stringify(value)) as unknown;
}
