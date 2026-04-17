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
