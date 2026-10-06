export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(
    message: string,
    statusCode: number,
    code: string
  ) {
    super(message);

    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;

    // Preserve subclasses so specialized errors can trigger their recovery path.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
