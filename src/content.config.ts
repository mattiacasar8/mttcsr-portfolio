import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { glob } from 'astro/loaders';

const mediaItem = z.object({
  src: z.string(),
  type: z.enum(['image', 'video']),
});

const workSchema = z.object({
  title: z.string(),
  subtitle: z.string().optional(),

  // Media paths are relative to src/assets/works/<slug>/
  hero: z.string(),
  heroType: z.enum(['image', 'video']),
  // Optional card media for the works grid; falls back to hero.
  cover: z.string().optional(),
  coverType: z.enum(['image', 'video']).optional(),

  text: z.string().optional(),

  // Meta list
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/, 'Format must be YYYY-MM').optional(),
  context: z.string().optional(),
  award: z.string().optional(),
  role: z.string().optional(),
  tags: z.array(z.string()).default([]),

  gallery: z.array(mediaItem).default([]),

  published: z.boolean().default(true),
});

export const collections = {
  works: defineCollection({
    loader: glob({ pattern: '*.md', base: './src/content/works' }),
    schema: workSchema,
  }),
};
