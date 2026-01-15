import { generateTemporalWorkflowCode } from "../temporal/generator/workflowGenerator";
import { WorkflowDefinition } from "../workflow/types";

export function generateTemporalCode(
  workflow: WorkflowDefinition
) {
  return generateTemporalWorkflowCode(workflow);
}
