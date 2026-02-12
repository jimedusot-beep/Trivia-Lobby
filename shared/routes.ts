import { z } from 'zod';
import { insertDeckSchema, insertCardSchema, decks, cards } from './schema';

// ============================================
// SHARED ERROR SCHEMAS
// ============================================
export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
};

// ============================================
// API CONTRACT
// ============================================
export const api = {
  decks: {
    list: {
      method: 'GET' as const,
      path: '/api/decks' as const,
      responses: {
        200: z.array(z.custom<typeof decks.$inferSelect>()),
      },
    },
    get: {
      method: 'GET' as const,
      path: '/api/decks/:id' as const,
      responses: {
        200: z.custom<typeof decks.$inferSelect & { cards: typeof cards.$inferSelect[] }>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: 'POST' as const,
      path: '/api/decks' as const,
      input: insertDeckSchema,
      responses: {
        201: z.custom<typeof decks.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    delete: {
      method: 'DELETE' as const,
      path: '/api/decks/:id' as const,
      responses: {
        204: z.void(),
        404: errorSchemas.notFound,
      },
    },
  },
  cards: {
    create: {
      method: 'POST' as const,
      path: '/api/decks/:id/cards' as const,
      input: z.array(insertCardSchema), // Bulk create for imports
      responses: {
        201: z.array(z.custom<typeof cards.$inferSelect>()),
        400: errorSchemas.validation,
      },
    },
  }
};

// ============================================
// URL HELPER
// ============================================
export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}

// ============================================
// TYPE HELPERS
// ============================================
export type DeckResponse = z.infer<typeof api.decks.get.responses[200]>;
export type DeckListResponse = z.infer<typeof api.decks.list.responses[200]>;
