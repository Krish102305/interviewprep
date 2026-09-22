export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message);
  }
}

export const badRequest = (msg: string) => new AppError(400, msg, "bad_request");
export const unauthorized = (msg = "Please sign in to continue.") => new AppError(401, msg, "unauthorized");
export const forbidden = (msg = "You don't have access to this.") => new AppError(403, msg, "forbidden");
export const notFound = (msg = "Not found.") => new AppError(404, msg, "not_found");
export const conflict = (msg: string) => new AppError(409, msg, "conflict");
export const tooMany = (msg = "Too many requests. Please slow down.") => new AppError(429, msg, "rate_limited");
