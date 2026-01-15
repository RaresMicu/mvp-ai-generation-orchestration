import { WorkflowDefinition } from "../../workflow/types";

export function generateTemporalWorkflowCode(def: WorkflowDefinition): string {
    const { name, entrypoint, activities, dependencies } = def.workflow;

    // 1. Imports
    let code = `import { proxyActivities, defineSignal, setHandler } from "@temporalio/workflow";\n`;
    code += `import type * as activities from "./activities";\n\n`;

    // 2. Activities proxy
    code += `const { httpCallActivity } = proxyActivities<typeof activities>({\n`;
    code += `  startToCloseTimeout: "30s",\n`;
    code += `});\n\n`;

    // 3. Workflow function
    code += `export async function ${name.replace(/\s+/g, "_")}(args: any): Promise<void> {\n`;
    code += `  const activityPromises: Record<string, Promise<any>> = {};\n\n`;

    // 4. Generate implementation based on dependencies
    // This is a naive linear/parallel generation based on dependencies for visualization

    // Find parallel groups
    const groups: Record<string, string[]> = {};
    activities.forEach(a => {
        if (a.parallelGroup) {
            if (!groups[a.parallelGroup]) groups[a.parallelGroup] = [];
            groups[a.parallelGroup].push(a.id);
        }
    });

    code += `  // Entrypoint\n`;
    const entryAct = activities.find(a => a.id === entrypoint);
    if (entryAct) {
        code += `  // Method: ${entryAct.method} ${entryAct.endpoint}\n`;
        code += `  const ${entryAct.id}Result = await httpCallActivity({\n`;
        code += `    method: "${entryAct.method}",\n`;
        code += `    endpoint: "${entryAct.endpoint}"\n`;
        code += `  });\n\n`;
    }

    // Handle Parallel Groups
    Object.entries(groups).forEach(([groupName, actIds]) => {
        code += `  // Parallel Group: ${groupName}\n`;
        code += `  await Promise.all([\n`;
        actIds.forEach(id => {
            const act = activities.find(a => a.id === id);
            if (act) {
                code += `    httpCallActivity({ method: "${act.method}", endpoint: "${act.endpoint}" }),\n`;
            }
        });
        code += `  ]);\n\n`;
    });

    // Handle remaining/sequential (simple logic for demo)
    const groupedIds = new Set(Object.values(groups).flat());
    const remaining = activities.filter(a => a.id !== entrypoint && !groupedIds.has(a.id));

    if (remaining.length > 0) {
        code += `  // Remaining Sequential Activities\n`;
        remaining.forEach(act => {
            code += `  await httpCallActivity({ method: "${act.method}", endpoint: "${act.endpoint}" });\n`;
        });
    }

    code += `}\n`;

    return code;
}
