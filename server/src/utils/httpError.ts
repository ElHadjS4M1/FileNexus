/**
 * Representa un error consciente de HTTP que transporta un código de estado y una carga opcional.
 */
export class HttpError extends Error {
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  /**
   * Construye una nueva instancia de HttpError.
   * @param {number} statusCode - Código de estado HTTP que se propagará.
   * @param {string} message - Descripción del error legible.
   * @param {Record<string, unknown>} [details] - Metadatos adicionales para los registros.
   */
  constructor(statusCode: number, message: string, details?: Record<string, unknown>) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}
