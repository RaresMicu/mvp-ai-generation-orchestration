import { normalizeGraph } from "./normalizeGraph";
import { sanitizeActivities } from "./sanitizeActivities";
import { sanitizeDependencies } from "./sanitizeDependencies";

export function normalizeWorkflow(parsed: any) {
  // Guard against total failure
  if (!parsed?.workflow) {
    return {
      workflow: {
        name: "",
        entrypoint: "",
        activities: [],
        dependencies: []
      }
    };
  }

  sanitizeActivities(parsed.workflow);
  normalizeGraph(parsed.workflow);
  sanitizeDependencies(parsed.workflow);

  return parsed;
}
