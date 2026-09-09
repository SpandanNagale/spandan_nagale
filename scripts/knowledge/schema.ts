import { z } from 'zod';

export const KeyFileSchema = z.object({
  path: z.string().min(1),
  why: z.string().min(1),
});

export const MetricSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
});

export const TalkingPointSchema = z.object({
  q: z.string().min(1),
  a: z.string().min(1),
});

export const ProjectStatusSchema = z.enum(['complete', 'in-progress', 'archived']);

export const ProjectEntrySchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/, 'slug must be lowercase-kebab-case'),
  name: z.string().min(1),
  repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/, 'repo must be "owner/name"').optional(),
  live_url: z.string().url().nullable().optional(),
  status: ProjectStatusSchema,
  one_liner: z.string().min(1),
  stack: z.array(z.string().min(1)).min(1),
  design_rationale: z
    .string()
    .min(80, 'design_rationale must be a real 3-6 sentence explanation, not a placeholder'),
  metrics: z.array(MetricSchema).default([]),
  key_files: z.array(KeyFileSchema).default([]),
  talking_points: z
    .array(TalkingPointSchema)
    .min(1, 'each project needs at least one anticipated interview question'),
});

export const ProjectsYamlSchema = z.array(ProjectEntrySchema).min(1);

export type ProjectEntry = z.infer<typeof ProjectEntrySchema>;
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;
