export interface RunPipelineInput {
  fetchImpl?: typeof fetch;
  processorPath: string;
  subscriptionUrl: string;
}

export interface RunPipelineResult {
  outputYaml: string;
}
