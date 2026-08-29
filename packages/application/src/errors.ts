export class ApplicationError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
    readonly fields?: Readonly<Record<string, string>>,
  ) {
    super(message);

    this.name = "ApplicationError";
  }
}

export const conflict = (code: string, message: string): ApplicationError =>
  new ApplicationError(code, 409, message);
