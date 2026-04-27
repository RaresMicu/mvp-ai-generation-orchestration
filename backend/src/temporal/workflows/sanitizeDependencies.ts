export function sanitizeDependencies(workflow: any) {
  const activityIds = new Set(workflow.activities.map((a: any) => a.id));

  workflow.dependencies = workflow.dependencies
    .map((dep: any) => {
      if (!dep.from && dep.to) {
        // Infer: all parallel tasks must finish before this node
        const parents = workflow.activities
          .filter(
            (a: any) =>
              a.parallel_group &&
              workflow.activities.find(
                (b: any) => b.id === dep.to && b.parallel_group === null
              )
          )
          .map((a: any) => a.id);

        return parents.map((p: string) => ({
          from: p,
          to: dep.to,
          condition: dep.condition || "success"
        }));
      }

      // Ensure condition field always exists
      return {
        ...dep,
        condition: dep.condition || "success"
      };
    })
    .flat()
    // Filter out dependencies referencing non-existent activities
    .filter((dep: any) => activityIds.has(dep.from) && activityIds.has(dep.to));
}
