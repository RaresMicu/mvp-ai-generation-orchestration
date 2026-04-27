import { WorkflowDefinition } from "../../workflow/types";

export function generateTemporalWorkflowCode(def: WorkflowDefinition): string {
    const { name, entrypoint, activities, dependencies } = def.workflow;

    // 1. Imports
    let code = `import { proxyActivities } from "@temporalio/workflow";\n`;
    code += `import type * as activities from "./activities";\n\n`;

    // 2. Activities proxy
    code += `const { httpCallActivity } = proxyActivities<typeof activities>({\n`;
    code += `  startToCloseTimeout: "30s",\n`;
    code += `});\n\n`;

    // 3. Workflow function
    code += `export async function ${name.replace(/\s+/g, "_")}(args: any): Promise<void> {\n`;

    // 4. Find parallel groups
    const groups: Record<string, string[]> = {};
    activities.forEach(a => {
        if (a.parallel_group) {
            if (!groups[a.parallel_group]) groups[a.parallel_group] = [];
            groups[a.parallel_group].push(a.id);
        }
    });

    // 5. Build failure map
    const failureEdges: Record<string, string> = {};
    dependencies.forEach(d => {
        if (d.condition === "failure") {
            failureEdges[d.from] = d.to;
        }
    });

    // 6. Entrypoint
    code += `  // Entrypoint\n`;
    const entryAct = activities.find(a => a.id === entrypoint);
    if (entryAct) {
        const hasFailure = failureEdges[entryAct.id];
        if (hasFailure) {
            code += `  let ${entryAct.id}Result;\n`;
            code += `  try {\n`;
            code += `    ${entryAct.id}Result = await httpCallActivity({\n`;
            code += `      method: "${entryAct.method}",\n`;
            code += `      endpoint: "${entryAct.endpoint}"\n`;
            code += `    });\n`;
            code += `  } catch (err) {\n`;
            const failTarget = activities.find(a => a.id === hasFailure);
            if (failTarget) {
                code += `    // Failure branch -> ${failTarget.id}\n`;
                code += `    await httpCallActivity({ method: "${failTarget.method}", endpoint: "${failTarget.endpoint}" });\n`;
                code += `    return;\n`;
            }
            code += `  }\n\n`;
        } else {
            code += `  const ${entryAct.id}Result = await httpCallActivity({\n`;
            code += `    method: "${entryAct.method}",\n`;
            code += `    endpoint: "${entryAct.endpoint}"\n`;
            code += `  });\n\n`;
        }
    }

    // 7. Handle Parallel Groups
    const failureTargetIds = new Set(Object.values(failureEdges));
    Object.entries(groups).forEach(([groupName, actIds]) => {
        // Filter out failure targets from parallel execution
        const normalIds = actIds.filter(id => !failureTargetIds.has(id));
        if (normalIds.length === 0) return;

        code += `  // Parallel Group: ${groupName}\n`;
        code += `  await Promise.all([\n`;
        normalIds.forEach(id => {
            const act = activities.find(a => a.id === id);
            if (act) {
                code += `    httpCallActivity({ method: "${act.method}", endpoint: "${act.endpoint}" }),\n`;
            }
        });
        code += `  ]);\n\n`;
    });

    // 8. Handle remaining sequential (excluding entrypoint, parallel, and failure targets)
    const groupedIds = new Set(Object.values(groups).flat());
    const remaining = activities.filter(
        a => a.id !== entrypoint && !groupedIds.has(a.id) && !failureTargetIds.has(a.id)
    );

    if (remaining.length > 0) {
        code += `  // Remaining Sequential Activities\n`;
        remaining.forEach(act => {
            const hasFailure = failureEdges[act.id];
            if (hasFailure) {
                code += `  try {\n`;
                code += `    await httpCallActivity({ method: "${act.method}", endpoint: "${act.endpoint}" });\n`;
                code += `  } catch (err) {\n`;
                const failTarget = activities.find(a => a.id === hasFailure);
                if (failTarget) {
                    code += `    await httpCallActivity({ method: "${failTarget.method}", endpoint: "${failTarget.endpoint}" });\n`;
                    code += `    return;\n`;
                }
                code += `  }\n`;
            } else {
                code += `  await httpCallActivity({ method: "${act.method}", endpoint: "${act.endpoint}" });\n`;
            }
        });
    }

    code += `}\n`;

    return code;
}
