import { Response } from "express";

type ServiceResult = { success: boolean; status?: number };

const SERVER_ERROR_MESSAGE = "An error occurred, please try again!";
const DUPLICATE_MESSAGE = "A record with the same value already exists!";
const CLIENT_ERROR_NAMES = new Set(["CastError", "ValidationError", "SyntaxError", "BSONError", "BSONTypeError"]);

export const resultStatus = (result: ServiceResult): number => (result.success ? 200 : (result.status ?? 400));

// An error thrown on purpose with a status and a message meant for the client (see httpError).
type ExposedError = Error & { status: number; expose: true };
export const isExposed = (error: unknown): error is ExposedError =>
  error instanceof Error && (error as Partial<ExposedError>).expose === true && typeof (error as Partial<ExposedError>).status === "number";

export const httpError = (status: number, message: string): ExposedError =>
  Object.assign(new Error(message), { status, expose: true as const });

// A malformed id or JSON body is the client's fault; any other error thrown while handling a request is ours.
export const caughtErrorStatus = (error: unknown): number => {
  if (isExposed(error)) return error.status;
  if ((error as { isAxiosError?: boolean } | null)?.isAxiosError) return 502;
  if ((error as { code?: number } | null)?.code === 11000) return 409;
  return error instanceof Error && CLIENT_ERROR_NAMES.has(error.name) ? 400 : 500;
};

// FileManager rejections that are the caller's doing are passed on; anything else is a failure of the upstream service.
export const upstreamStatus = (status?: number): number =>
  status === 400 || status === 403 || status === 404 || status === 409 ? status : 502;

export const sendCaughtError = (res: Response, error: unknown, message: string, serverMessage = SERVER_ERROR_MESSAGE): void => {
  const status = caughtErrorStatus(error);
  const body = isExposed(error) ? error.message : status === 409 ? DUPLICATE_MESSAGE : status === 400 ? message : serverMessage;
  res.status(status).json({ code: "error", message: body });
};
