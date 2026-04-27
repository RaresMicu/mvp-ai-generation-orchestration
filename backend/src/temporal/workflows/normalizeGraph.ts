export function normalizeGraph(workflow: any) {
  const parallelGroups: Record<string, string[]> = {};

  // Build parallel group map (snake_case field)
  workflow.activities.forEach((a: any) => {
    if (a.parallel_group) {
      if (!parallelGroups[a.parallel_group]) {
        parallelGroups[a.parallel_group] = [];
      }
      parallelGroups[a.parallel_group].push(a.id);
    }
  });

  // Rewrite dependencies — expand group references if any
  const normalizedDeps: any[] = [];

  workflow.dependencies.forEach((dep: any) => {
    // If "from" is a parallelGroup name, expand it to individual activity edges
    if (parallelGroups[dep.from]) {
      parallelGroups[dep.from].forEach((activityId) => {
        normalizedDeps.push({
          from: activityId,
          to: dep.to,
          condition: dep.condition || "success"
        });
      });
    } else {
      // Ensure condition field always exists
      normalizedDeps.push({
        ...dep,
        condition: dep.condition || "success"
      });
    }
  });

  workflow.dependencies = normalizedDeps;
}
