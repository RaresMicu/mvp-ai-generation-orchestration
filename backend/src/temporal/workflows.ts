import { proxyActivities } from "@temporalio/workflow";

const { httpCallActivity } = proxyActivities<any>({
  startToCloseTimeout: "30s"
});

/**
 * Simple orchestration workflow (legacy — kept for reference).
 * For the full condition-aware workflow, see ./workflows/workflow.ts
 */
export async function orchestrationWorkflow(def: any) {
  const activityMap = new Map<string, Promise<any>>();

  // Step 1: entrypoint
  const entry = def.workflow.entrypoint;
  const entryActivity = def.workflow.activities.find(
    (a: any) => a.id === entry
  );

  activityMap.set(
    entry,
    httpCallActivity({
      method: entryActivity.method,
      endpoint: entryActivity.endpoint
    })
  );

  // Step 2: remaining activities (simple parallel/sequential)
  for (const act of def.workflow.activities) {
    if (act.id === entry) continue;

    if (act.parallel_group) {
      activityMap.set(
        act.id,
        httpCallActivity({
          method: act.method,
          endpoint: act.endpoint
        })
      );
    } else {
      await Promise.all(activityMap.values());
      activityMap.clear();

      activityMap.set(
        act.id,
        httpCallActivity({
          method: act.method,
          endpoint: act.endpoint
        })
      );
    }
  }

  await Promise.all(activityMap.values());
}
