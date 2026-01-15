export function sanitizeDependencies(workflow: any) {
  const activities = workflow.activities.map((a: any) => a.id);

  workflow.dependencies = workflow.dependencies
    .map((dep: any) => {
      if (!dep.from && dep.to) {
        // infer: all parallel tasks must finish before this
        const parents = workflow.activities
          .filter(
            (a: any) =>
              a.parallelGroup &&
              workflow.activities.find(
                (b: any) => b.id === dep.to && b.parallelGroup === null
              )
          )
          .map((a: any) => a.id);

        return parents.map((p: string) => ({ from: p, to: dep.to }));
      }

      return dep;
    })
    .flat();
}
