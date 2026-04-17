export interface TransformInput {
  processorSource: string;
  subscriptionText: string;
}

export type TransformErrorCode = "input" | "script" | "core";

export interface TransformFailure {
  error: {
    cause?: unknown;
    code: TransformErrorCode;
    message: string;
  };
  ok: false;
}

export interface TransformSuccess {
  ok: true;
  output: string;
}

export type TransformResult = TransformFailure | TransformSuccess;
