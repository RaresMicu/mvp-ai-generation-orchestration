export type Activity = {
  id: string;
  type: "http_call";
  method: "GET" | "POST";
  endpoint: string;
  parallelGroup?: string | null;
  retryPolicy?: {
    maxAttempts: number;
    backoffSeconds: number;
  };
  timeoutSeconds?: number;
};

export type Dependency = {
  from: string;
  to: string;
};

export type WorkflowDefinition = {
  workflow: {
    name: string;
    entrypoint: string;
    activities: Activity[];
    dependencies: Dependency[];
  };
  manualFields: string[];
};
