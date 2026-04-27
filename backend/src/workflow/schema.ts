import { z } from "zod";

export const ActivitySchema = z.object({
  id: z.string(),
  type: z.literal("http_call"),
  method: z.enum(["GET", "POST", "PUT", "DELETE"]),
  endpoint: z.string(),
  parallel_group: z.string().nullable().optional(),
  retry_policy: z
    .object({
      maximum_attempts: z.number(),
      initial_interval_seconds: z.number()
    })
    .nullable()
    .optional(),
  timeout_seconds: z.number().nullable().optional()
});

export const WorkflowSchema = z.object({
  workflow: z.object({
    name: z.string(),
    entrypoint: z.string(),
    activities: z.array(ActivitySchema),
    dependencies: z.array(
      z.object({
        from: z.string(),
        to: z.string(),
        condition: z.enum(["success", "failure"])
      })
    )
  })
});
