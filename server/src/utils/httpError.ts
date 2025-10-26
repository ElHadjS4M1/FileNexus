/**
 * Represents an HTTP-aware error carrying a status code and optional payload.
 */
export class HttpError extends Error {
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  /**
   * Builds a new HttpError instance.
   * @param {number} statusCode - HTTP status code to propagate.
   * @param {string} message - Human readable error description.
   * @param {Record<string, unknown>} [details] - Additional metadata for logs.
   */
  constructor(statusCode: number, message: string, details?: Record<string, unknown>) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}
