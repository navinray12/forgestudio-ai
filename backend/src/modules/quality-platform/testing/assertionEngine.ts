/**
 * Module 43: Assertion Matcher Engine
 * Comprehensive test assertion matcher library compatible with Jest/Vitest/Expect API.
 */

export class AssertionError extends Error {
  public expected: any;
  public actual: any;

  constructor(message: string, expected?: any, actual?: any) {
    super(message);
    this.name = "AssertionError";
    this.expected = expected;
    this.actual = actual;
  }
}

export class Matcher {
  constructor(private actual: any, private isInverse = false) {}

  get not(): Matcher {
    return new Matcher(this.actual, !this.isInverse);
  }

  private fail(msg: string, expected?: any): void {
    throw new AssertionError(msg, expected, this.actual);
  }

  public toBe(expected: any): void {
    const pass = Object.is(this.actual, expected);
    if (this.isInverse ? pass : !pass) {
      this.fail(
        this.isInverse
          ? `Expected value not to be ${String(expected)}`
          : `Expected ${String(this.actual)} to be ${String(expected)}`,
        expected
      );
    }
  }

  public toEqual(expected: any): void {
    const pass = JSON.stringify(this.actual) === JSON.stringify(expected);
    if (this.isInverse ? pass : !pass) {
      this.fail(
        this.isInverse
          ? `Expected value not to equal ${JSON.stringify(expected)}`
          : `Expected ${JSON.stringify(this.actual)} to deeply equal ${JSON.stringify(expected)}`,
        expected
      );
    }
  }

  public toBeTruthy(): void {
    const pass = Boolean(this.actual);
    if (this.isInverse ? pass : !pass) {
      this.fail(`Expected ${String(this.actual)} ${this.isInverse ? "not " : ""}to be truthy`);
    }
  }

  public toBeFalsy(): void {
    const pass = !this.actual;
    if (this.isInverse ? pass : !pass) {
      this.fail(`Expected ${String(this.actual)} ${this.isInverse ? "not " : ""}to be falsy`);
    }
  }

  public toBeNull(): void {
    const pass = this.actual === null;
    if (this.isInverse ? pass : !pass) {
      this.fail(`Expected ${String(this.actual)} ${this.isInverse ? "not " : ""}to be null`);
    }
  }

  public toBeDefined(): void {
    const pass = this.actual !== undefined;
    if (this.isInverse ? pass : !pass) {
      this.fail(`Expected value ${this.isInverse ? "not " : ""}to be defined`);
    }
  }

  public toContain(item: any): void {
    let pass = false;
    if (typeof this.actual === "string") {
      pass = this.actual.includes(String(item));
    } else if (Array.isArray(this.actual)) {
      pass = this.actual.some((x) => JSON.stringify(x) === JSON.stringify(item) || x === item);
    }
    if (this.isInverse ? pass : !pass) {
      this.fail(`Expected ${JSON.stringify(this.actual)} ${this.isInverse ? "not " : ""}to contain ${JSON.stringify(item)}`);
    }
  }

  public toHaveLength(len: number): void {
    const actualLen = this.actual?.length;
    const pass = actualLen === len;
    if (this.isInverse ? pass : !pass) {
      this.fail(`Expected length ${this.isInverse ? "not " : ""}to be ${len}, but got ${actualLen}`);
    }
  }

  public toBeGreaterThan(n: number): void {
    const pass = typeof this.actual === "number" && this.actual > n;
    if (this.isInverse ? pass : !pass) {
      this.fail(`Expected ${this.actual} ${this.isInverse ? "not " : ""}to be greater than ${n}`);
    }
  }

  public toBeLessThan(n: number): void {
    const pass = typeof this.actual === "number" && this.actual < n;
    if (this.isInverse ? pass : !pass) {
      this.fail(`Expected ${this.actual} ${this.isInverse ? "not " : ""}to be less than ${n}`);
    }
  }

  public toThrow(errPattern?: string | RegExp): void {
    if (typeof this.actual !== "function") {
      this.fail("Expected actual value to be a function");
    }

    let threw = false;
    let thrownError: any = null;

    try {
      this.actual();
    } catch (e: any) {
      threw = true;
      thrownError = e;
    }

    if (!this.isInverse && !threw) {
      this.fail("Expected function to throw an error, but it did not throw");
    }

    if (this.isInverse && threw) {
      this.fail(`Expected function not to throw, but it threw: ${thrownError?.message || thrownError}`);
    }

    if (threw && errPattern) {
      const msg = thrownError?.message || String(thrownError);
      const matches = typeof errPattern === "string" ? msg.includes(errPattern) : errPattern.test(msg);
      if (!matches) {
        this.fail(`Expected error message to match ${String(errPattern)}, but got: '${msg}'`);
      }
    }
  }
}

export function expect(actual: any): Matcher {
  return new Matcher(actual);
}
