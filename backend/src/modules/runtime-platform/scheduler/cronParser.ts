/**
 * Module 48: Cron Expression Parser & Next Run Calculator
 * Supports standard 5-part cron syntax and standard aliases with drift compensation.
 */

export class CronParser {
  private static ALIASES: Record<string, string> = {
    "@hourly": "0 * * * *",
    "@daily": "0 0 * * *",
    "@midnight": "0 0 * * *",
    "@weekly": "0 0 * * 0",
    "@monthly": "0 0 1 * *",
    "@yearly": "0 0 1 1 *",
    "@annually": "0 0 1 1 *",
  };

  /**
   * Validates if a cron expression is syntactically sound
   */
  public static isValid(expression: string): boolean {
    try {
      this.normalize(expression);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Normalizes expression and validates 5 fields
   */
  public static normalize(expression: string): string {
    const trimmed = expression.trim();
    if (this.ALIASES[trimmed]) {
      return this.ALIASES[trimmed];
    }

    const parts = trimmed.split(/\s+/);
    if (parts.length !== 5) {
      throw new Error(`Invalid cron expression '${expression}': expected 5 fields, got ${parts.length}`);
    }

    // Basic range validation
    this.validateField(parts[0], 0, 59, "minute");
    this.validateField(parts[1], 0, 23, "hour");
    this.validateField(parts[2], 1, 31, "day-of-month");
    this.validateField(parts[3], 1, 12, "month");
    this.validateField(parts[4], 0, 7, "day-of-week");

    return parts.join(" ");
  }

  private static validateField(field: string, min: number, max: number, name: string): void {
    if (field === "*") return;

    // Check step: e.g. */5
    if (field.startsWith("*/")) {
      const step = parseInt(field.slice(2), 10);
      if (isNaN(step) || step < 1 || step > max) {
        throw new Error(`Invalid step in ${name}: ${field}`);
      }
      return;
    }

    // Check list or range: e.g. 1,2,3 or 1-5
    const items = field.split(",");
    for (const item of items) {
      if (item.includes("-")) {
        const [startStr, endStr] = item.split("-");
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        if (isNaN(start) || isNaN(end) || start < min || end > max || start > end) {
          throw new Error(`Invalid range in ${name}: ${item}`);
        }
      } else {
        const num = parseInt(item, 10);
        if (isNaN(num) || num < min || num > max) {
          throw new Error(`Invalid value in ${name}: ${item}`);
        }
      }
    }
  }

  /**
   * Calculates next execution timestamp from a given reference date
   */
  public static getNextRunDate(expression: string, fromDate = new Date()): Date {
    const normalized = this.normalize(expression);
    const [minExpr, hourExpr, domExpr, monExpr, dowExpr] = normalized.split(" ");

    // Start evaluation from next minute with 0 seconds
    const cursor = new Date(fromDate.getTime() + 60 * 1000);
    cursor.setSeconds(0, 0);

    // Limit lookahead to 1 year
    const maxLookahead = 366 * 24 * 60;
    let minutesChecked = 0;

    while (minutesChecked < maxLookahead) {
      const curMinute = cursor.getMinutes();
      const curHour = cursor.getHours();
      const curDom = cursor.getDate();
      const curMonth = cursor.getMonth() + 1; // 1-12
      const curDow = cursor.getDay(); // 0-6

      if (
        this.matches(curMinute, minExpr, 0, 59) &&
        this.matches(curHour, hourExpr, 0, 23) &&
        this.matches(curDom, domExpr, 1, 31) &&
        this.matches(curMonth, monExpr, 1, 12) &&
        this.matches(curDow, dowExpr, 0, 7)
      ) {
        return cursor;
      }

      cursor.setTime(cursor.getTime() + 60 * 1000);
      minutesChecked++;
    }

    // Fallback: 1 hour from now
    return new Date(fromDate.getTime() + 3600 * 1000);
  }

  private static matches(val: number, expr: string, min: number, max: number): boolean {
    if (expr === "*") return true;

    if (expr.startsWith("*/")) {
      const step = parseInt(expr.slice(2), 10);
      return val % step === 0;
    }

    const items = expr.split(",");
    for (const item of items) {
      if (item.includes("-")) {
        const [start, end] = item.split("-").map((s) => parseInt(s, 10));
        if (val >= start && val <= end) return true;
      } else {
        const num = parseInt(item, 10);
        if (val === num || (max === 7 && val === 0 && num === 7)) return true;
      }
    }

    return false;
  }
}
