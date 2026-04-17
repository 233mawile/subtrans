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

export interface NetworkTextInput {
  type: "network";
  userAgent?: string;
  url: string;
}

export interface SourceTextInput {
  filename?: string;
  text: string;
  type: "source";
}

export type TextInput = NetworkTextInput | SourceTextInput;

export interface RunPipelineInput {
  fetchImpl?: typeof fetch;
  processor: TextInput;
  subscription: TextInput;
}

export interface RunPipelineResult {
  outputYaml: string;
}
