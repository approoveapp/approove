import { z } from "zod";

/**
 * What the progress screen shows while the model is still writing: only the fields needed to
 * place a post on the calendar. Never committed; the validated proposal replaces it.
 */
const progressPostSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().max(5).nullable().catch(null),
  channel: z.string().max(40),
  format: z.string().max(40),
  title: z.string().transform((value) => value.slice(0, 300)),
});

export type ImportProgressPost = z.infer<typeof progressPostSchema>;

export const MAX_PROGRESS_POSTS = 200;

/**
 * Complete post objects found so far in the streamed JSON text of a proposal.
 * The text is cut mid-token, so only objects whose closing brace already arrived are read.
 */
export function extractPartialPosts(text: string): ImportProgressPost[] {
  const posts: ImportProgressPost[] = [];
  let depth = 0;
  let inString = false;
  let escaped = false;
  let stringStart = -1;
  let lastKey = "";
  let inPosts = false;
  let objectStart = -1;

  for (let i = 0; i < text.length && posts.length < MAX_PROGRESS_POSTS; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') {
        inString = false;
        // Keys of the root object only: a "posts" inside a caption must not open the array.
        if (depth === 1 && !inPosts) lastKey = text.slice(stringStart + 1, i);
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
      stringStart = i;
    } else if (ch === "[") {
      if (depth === 1 && !inPosts && lastKey === "posts") inPosts = true;
      depth++;
    } else if (ch === "]") {
      depth--;
      if (inPosts && depth === 1) break;
    } else if (ch === "{") {
      if (inPosts && depth === 2) objectStart = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (inPosts && depth === 2 && objectStart >= 0) {
        try {
          const parsed = progressPostSchema.safeParse(JSON.parse(text.slice(objectStart, i + 1)));
          if (parsed.success) posts.push(parsed.data);
        } catch {
          // An object the model is still writing, or malformed: skip it.
        }
        objectStart = -1;
      }
    }
  }
  return posts;
}

/** Stored in `ImportJob.resultJson` only while the job is `processing`. */
export function serializeProgress(posts: ImportProgressPost[]) {
  return JSON.stringify({ partial: true, posts });
}

export function parseProgress(value: unknown): ImportProgressPost[] {
  const parsed = z.object({ partial: z.literal(true), posts: z.array(progressPostSchema).max(MAX_PROGRESS_POSTS) }).safeParse(value);
  return parsed.success ? parsed.data.posts : [];
}
