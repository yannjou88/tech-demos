declare module "bun:test" {
  type Matcher = {
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toBeCloseTo(expected: number, digits?: number): void;
    toMatchObject(expected: object): void;
  };

  export function describe(name: string, fn: () => void): void;
  export function test(name: string, fn: () => void | Promise<void>): void;
  export function expect(actual: unknown): Matcher;
}
