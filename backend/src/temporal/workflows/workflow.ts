import { proxyActivities, sleep } from "@temporalio/workflow";
import type * as activities from "../activities";

const { httpCallActivity } = proxyActivities<typeof activities>({
  startToCloseTimeout: "30s",
});

export async function orchestrationWorkflow(definition: any): Promise<any> {
  const { activities, dependencies, entrypoint } = definition.workflow;

  // Results cache: activityId -> result
  const results: Record<string, any> = {};

  // Build dependency maps
  const validActivityIds = new Set(activities.map((a: any) => a.id));

  // Success parents: node -> [parents that must succeed before it runs]
  const successParents: Record<string, string[]> = {};
  // Failure edges: source -> target (at most one per source)
  const failureEdges: Record<string, string> = {};
  // Track which nodes are failure targets (should NOT run on success path)
  const failureTargets = new Set<string>();

  if (Array.isArray(dependencies)) {
    dependencies.forEach((d: any) => {
      if (!validActivityIds.has(d.from) || !validActivityIds.has(d.to)) {
        console.warn(`Ignoring invalid dependency: ${d.from} -> ${d.to}`);
        return;
      }

      const condition = d.condition || "success";

      if (condition === "failure") {
        failureEdges[d.from] = d.to;
        failureTargets.add(d.to);
      } else {
        // success dependency
        if (!successParents[d.to]) successParents[d.to] = [];
        successParents[d.to].push(d.from);
      }
    });
  }

  // Dynamic Event Loop for Independent Parallelism
  const completed = new Set<string>();
  const failed = new Set<string>();
  const pending = new Set<string>(
    activities
      .map((a: any) => a.id)
      // Exclude failure targets from initial pending — they only run on failure
      .filter((id: string) => !failureTargets.has(id))
  );

  const executing = new Map<string, Promise<{ id: string; success: boolean }>>();

  while (pending.size > 0 || executing.size > 0) {

    // 1. Find NEW runnable tasks from 'pending'
    const runnable: any[] = [];
    for (const actId of pending) {
      const parents = successParents[actId] || [];
      const allParentsDone = parents.every(p => completed.has(p));
      if (allParentsDone) {
        const act = activities.find((a: any) => a.id === actId);
        if (act) {
          runnable.push(act);
        } else {
          console.warn(`Activity definition not found for ID: ${actId}`);
          pending.delete(actId);
        }
      }
    }

    // 2. Start all new runnable tasks
    for (const act of runnable) {
      pending.delete(act.id);

      const endpoint = act.endpoint;
      console.log(`Executing ${act.id}: ${act.method} ${endpoint}`);

      const p = (async () => {
        try {
          const result = await httpCallActivity({
            method: act.method,
            endpoint: endpoint,
            payload: {}
          });
          results[act.id] = result;
          return { id: act.id, success: true };
        } catch (err) {
          console.error(`Activity ${act.id} failed`, err);
          return { id: act.id, success: false };
        }
      })();

      executing.set(act.id, p);
    }

    // 3. Wait for the NEXT task to finish
    if (executing.size > 0) {
      const finished = await Promise.race(executing.values());
      executing.delete(finished.id);

      if (finished.success) {
        completed.add(finished.id);
        // Success path: downstream success dependencies will become runnable
      } else {
        failed.add(finished.id);

        // Check for failure branch
        const failureTarget = failureEdges[finished.id];
        if (failureTarget) {
          console.log(`Failure branch: ${finished.id} -> ${failureTarget}`);
          // Add the failure target to pending so it gets executed
          pending.add(failureTarget);
        } else {
          // No failure handler — propagate the failure
          throw new Error(`Activity ${finished.id} failed with no failure handler`);
        }
      }
    } else if (pending.size > 0) {
      throw new Error("Deadlock or Cycle detected: No tasks executing but pending tasks remain.");
    } else {
      break;
    }
  }

  return results;
}
