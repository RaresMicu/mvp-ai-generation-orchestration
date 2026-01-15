export function normalizeGraph(workflow: any) {
  const parallelGroups: Record<string, string[]> = {};

  // Build parallel group map
  workflow.activities.forEach((a: any) => {
    if (a.parallelGroup) {
      if (!parallelGroups[a.parallelGroup]) {
        parallelGroups[a.parallelGroup] = [];
      }
      parallelGroups[a.parallelGroup].push(a.id);
    }
  });

  // Rewrite dependencies
  const normalizedDeps: any[] = [];

  workflow.dependencies.forEach((dep: any) => {
    // If "from" is a parallelGroup, expand it
    if (parallelGroups[dep.from]) {
      parallelGroups[dep.from].forEach((activityId) => {
        normalizedDeps.push({
          from: activityId,
          to: dep.to,
        });
      });
    } else {
      normalizedDeps.push(dep);
    }
  });

  workflow.dependencies = normalizedDeps;
}
