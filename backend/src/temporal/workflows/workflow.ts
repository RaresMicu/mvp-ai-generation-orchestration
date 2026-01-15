import { proxyActivities, sleep } from "@temporalio/workflow";
import type * as activities from "../activities";

const { httpCallActivity } = proxyActivities<typeof activities>({
  startToCloseTimeout: "30s",
});

export async function orchestrationWorkflow(definition: any): Promise<any> {
  const { activities, dependencies, entrypoint } = definition.workflow;

  // Results cache: activityId -> result
  const results: Record<string, any> = {};

  // Helper to substitute variables
  // e.g. "/users/${fetch_user.id}" -> "/users/123"
  // e.g. inputs: { "userId": "${fetch_user.id}" }
  const substitute = (text: string): string => {
    let result = text;
    // Regex for ${nodeId.path}
    // Simple implementation: ${nodeId.field}
    const regex = /\$\{([^}]+)\}/g;
    return result.replace(regex, (match, key) => {
      const parts = key.split('.');
      const nodeId = parts[0];
      const field = parts.slice(1).join('.');

      if (results[nodeId]) {
        // Access property
        // For robustness, could use lodash.get
        let val = results[nodeId];
        for (const f of parts.slice(1)) {
          val = val?.[f];
        }
        return val !== undefined ? String(val) : match;
      }
      return match;
    });
  };

  const processInputs = (inputs: any): any => {
    if (!inputs) return {};
    const processed: any = {};
    for (const [k, v] of Object.entries(inputs)) {
      if (typeof v === 'string') {
        processed[k] = substitute(v);
      } else {
        processed[k] = v;
      }
    }
    return processed;
  };

  // Topological execution
  // We need to keep track of completed nodes
  const completed = new Set<string>();
  const pending = new Set<string>(activities.map((a: any) => a.id));

  // Dependency Graph: to -> [froms]
  const parentsMap: Record<string, string[]> = {};
  const validActivityIds = new Set(activities.map((a: any) => a.id));

  if (Array.isArray(dependencies)) {
    dependencies.forEach((d: any) => {
      // Robustness: Only track dependencies where BOTH nodes are actual activities
      // This filters out "virtual" edges like 'parallel_group_1 -> node' which cause deadlocks
      if (validActivityIds.has(d.from) && validActivityIds.has(d.to)) {
        if (!parentsMap[d.to]) parentsMap[d.to] = [];
        parentsMap[d.to].push(d.from);
      } else {
        console.warn(`Ignoring invalid dependency: ${d.from} -> ${d.to} (One or both IDs not found in activities)`);
      }
    });
  }

  // Dynamic Event Loop for Independent Parallelism
  // Track running promises: ID -> Promise
  const executing = new Map<string, Promise<string>>();

  // Loop while there is work to do (pending tasks OR running tasks)
  while (pending.size > 0 || executing.size > 0) {

    // 1. Find NEW runnable tasks from 'pending'
    const runnable: any[] = [];
    for (const actId of pending) {
      const parents = parentsMap[actId] || [];
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
      pending.delete(act.id); // Move from pending to executing

      const endpoint = substitute(act.endpoint);
      const payload = processInputs(act.inputs);
      console.log(`Executing ${act.id}: ${act.method} ${endpoint}`);

      // Create a promise that resolves to its OWN ID when done
      const p = (async () => {
        try {
          const result = await httpCallActivity({
            method: act.method,
            endpoint: endpoint,
            payload: payload
          });
          results[act.id] = result;
          return act.id; // Return ID on success
        } catch (err) {
          console.error(`Activity ${act.id} failed`, err);
          throw err; // Fail workflow on error
        }
      })();

      executing.set(act.id, p);
    }

    // 3. Wait for the NEXT task to finish (if any are running)
    if (executing.size > 0) {
      // Promise.race returns the ID of the first finished task
      const finishedId = await Promise.race(executing.values());

      // Update state
      completed.add(finishedId);
      executing.delete(finishedId);

      // Loop continues immediately to check if new tasks became runnable due to this completion
    } else if (pending.size > 0) {
      // No tasks executing, but pending tasks exist -> Deadlock
      throw new Error("Deadlock or Cycle detected: No tasks executing but pending tasks remain.");
    } else {
      // No executing, No pending -> Done
      break;
    }
  }

  // Return the result of the LAST completed activity? Or the whole dump?
  // Let's return the whole results map for debugging, or specific output if defined.
  return results;
}
