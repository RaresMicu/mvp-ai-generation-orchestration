export function sanitizeActivities(workflow: any) {
  workflow.activities = workflow.activities.filter(
    (a: any) => a.type === "http_call"
  );

  // Remove dependencies pointing to deleted nodes
  const validIds = new Set(workflow.activities.map((a: any) => a.id));

  workflow.dependencies = workflow.dependencies.filter(
    (d: any) => validIds.has(d.from) && validIds.has(d.to)
  );
}
