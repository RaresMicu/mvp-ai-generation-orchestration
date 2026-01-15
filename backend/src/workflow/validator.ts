import { WorkflowSchema } from "./schema";

export function validateWorkflow(data: unknown) {
  return WorkflowSchema.parse(data);
}
