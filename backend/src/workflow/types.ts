export type Activity = {
  id: string;
  type: "http_call";
  method: "GET" | "POST" | "PUT" | "DELETE";
  endpoint: string;
  parallel_group?: string | null;
  retry_policy?: {
    maximum_attempts: number;
    initial_interval_seconds: number;
  } | null;
  timeout_seconds?: number | null;
};

export type Dependency = {
  from: string;
  to: string;
  condition: "success" | "failure";
};

export type WorkflowDefinition = {
  workflow: {
    name: string;
    entrypoint: string;
    activities: Activity[];
    dependencies: Dependency[];
  };
};
