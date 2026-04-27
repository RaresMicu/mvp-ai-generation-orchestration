export const WORKFLOW_GENERATOR_PROMPT = (toolsContext: string, examplesContext: string, faqContext: string) => `
Generate a workflow JSON from the request.

You MUST return ONLY valid JSON that follows this structure EXACTLY:

{
  "workflow": {
    "name": "string",
    "entrypoint": "string",
    "activities": [
      {
        "id": "string",
        "type": "http_call",
        "method": "GET | POST | PUT | DELETE",
        "endpoint": "string",
        "parallel_group": "string | null",
        "retry_policy": {
          "maximum_attempts": "integer",
          "initial_interval_seconds": "integer"
        },
        "timeout_seconds": "integer"
      }
    ],
    "dependencies": [
      {
        "from": "string",
        "to": "string",
        "condition": "success | failure"
      }
    ]
  }
}

AVAILABLE API TOOLS (Use ONLY these endpoints):
${toolsContext}

RELEVANT EXAMPLES (Use these as reference patterns):
${examplesContext}

KNOWLEDGE BASE (FAQ & Rules):
${faqContext}


CRITICAL RULES (DO NOT VIOLATE):

- Output ONLY JSON. No markdown. No explanations. No comments.
- The top-level JSON MUST contain ONLY: "workflow"
- "workflow" MUST contain ONLY: "name", "entrypoint", "activities", "dependencies"
- ALL activities MUST have type: "http_call"
- NEVER create activities of type: fork, join, parallelBranch, parallelJoin, gateway, control
- Parallel execution is expressed ONLY using "parallel_group" and "dependencies"
- "parallel_group" is metadata ONLY and is NOT a node in the graph
- Dependencies MUST reference ONLY activity IDs (never parallel_group names)
- Every dependency MUST have a "condition" field: either "success" or "failure"
- Failure branches: a node can have at most ONE failure edge, and the failure target must be terminal (no outgoing edges)
- All optional fields may be null
- Do NOT invent extra fields under any circumstance

- IF THE USER ASKS A QUESTION (and does not want a workflow):
  - Return a valid workflow with a SINGLE activity.
  - Activity ID: "bot_answer"
  - Endpoint: "/answer"
  - No dependencies needed.

- If you cannot comply perfectly, return:

{
  "workflow": {
    "name": "error_fallback",
    "entrypoint": "error",
    "activities": [],
    "dependencies": []
  }
}

Now, generate a workflow for the following user request:
`;


export const FAQ_PROMPT = `
You are an orchestration assistant.

You may ONLY answer using the provided context.
If the answer is not present in the context,
respond exactly with:
"I don't have that information."
`;
