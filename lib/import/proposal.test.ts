import { describe, expect, it } from "vitest";
import {
  attachmentTypeFor,
  buildImportNote,
  importCommitSchema,
  importProposalSchema,
  importStageFor,
  proposalLocalDateTime,
  unusedMediaNames,
  type ImportMedia,
  type ImportProposalPost,
} from "./proposal";

const post: ImportProposalPost = {
  date: "2026-11-03",
  time: null,
  dateIsSuggested: false,
  channel: "Instagram",
  format: "reels",
  title: "Lançamento",
  copyText: "Chegou!",
  media: ["lancamento.mp4"],
  notes: "Usar trilha da campanha",
  source: "briefing.pdf, p. 2",
};

const media = (name: string): ImportMedia => ({
  name,
  url: `/dev-uploads/uploads/org/import-${name}`,
  mediaType: name.endsWith(".mp4") ? "video" : "image",
  mime: name.endsWith(".mp4") ? "video/mp4" : "image/jpeg",
});

describe("import proposal", () => {
  it("accepts the shape the model is asked for", () => {
    const parsed = importProposalSchema.safeParse({ summary: "1 post", posts: [post], warnings: [] });
    expect(parsed.success).toBe(true);
  });

  it("rejects channels outside the calendar's list", () => {
    const parsed = importProposalSchema.safeParse({
      summary: "",
      posts: [{ ...post, channel: "Orkut" }],
      warnings: [],
    });
    expect(parsed.success).toBe(false);
  });

  it("defaults to 10:00 and ignores malformed times", () => {
    expect(proposalLocalDateTime(post)).toBe("2026-11-03T10:00");
    expect(proposalLocalDateTime({ ...post, time: "18:30" })).toBe("2026-11-03T18:30");
    expect(proposalLocalDateTime({ ...post, time: "6pm" })).toBe("2026-11-03T10:00");
  });

  it("records origin, format, source and notes in the production note", () => {
    expect(buildImportNote(post, "pt-BR")).toBe(
      "Importado com IA · Formato: Reels · Fonte: briefing.pdf, p. 2 · Usar trilha da campanha"
    );
    expect(buildImportNote({ ...post, notes: "x".repeat(3000) }, "pt-BR").length).toBe(2000);
    expect(buildImportNote({ ...post, format: "carousel" }, "en")).toBe(
      "Imported with AI · Format: Carousel · Source: briefing.pdf, p. 2 · Usar trilha da campanha"
    );
  });

  it("lists uploaded media that no post uses", () => {
    const uploaded = [media("lancamento.mp4"), media("logo.png"), media("kit.jpg")];
    expect(unusedMediaNames(uploaded, [post, { media: ["kit.jpg"] }])).toEqual(["logo.png"]);
  });
});

describe("migrated post shape", () => {
  it("maps formats to the calendar's material types", () => {
    expect(attachmentTypeFor("carousel", "Instagram", 3)).toBe("carousel");
    // Carrossel com uma só imagem não passa na regra de 2+ slides: vira post de feed.
    expect(attachmentTypeFor("carousel", "Instagram", 1)).toBe("post_feed");
    expect(attachmentTypeFor("stories", "Instagram", 1)).toBe("post_stories");
    expect(attachmentTypeFor("reels", "Instagram", 1)).toBe("reels_cover");
    expect(attachmentTypeFor("feed", "LinkedIn", 1)).toBe("post_linkedin");
    expect(attachmentTypeFor("feed", "Instagram", 1)).toBe("post_feed");
    expect(attachmentTypeFor("video", "YouTube", 1)).toBe("other");
  });

  it("sets the production stage from what was migrated, never ready for the client", () => {
    expect(importStageFor(true, true)).toBe("internal_review");
    expect(importStageFor(true, false)).toBe("waiting_design");
    expect(importStageFor(false, true)).toBe("draft_copy");
    expect(importStageFor(false, false)).toBe("draft_copy");
  });
});

describe("import commit", () => {
  const valid = {
    scheduledAt: "2026-11-03T13:00:00.000Z",
    channel: "Instagram",
    format: "feed",
    title: "Lançamento",
    copyText: "Chegou!",
  };

  it("needs at least one post and caps the batch", () => {
    expect(importCommitSchema.safeParse({ reviewAcknowledged: true, posts: [] }).success).toBe(false);
    expect(importCommitSchema.safeParse({ reviewAcknowledged: true, posts: Array(201).fill(valid) }).success).toBe(false);
    const parsed = importCommitSchema.parse({ reviewAcknowledged: true, posts: [valid] });
    expect(parsed.posts[0].media).toEqual([]);
  });

  it("applies the same limits as manual post creation", () => {
    expect(importCommitSchema.safeParse({ reviewAcknowledged: true, posts: [{ ...valid, scheduledAt: "amanhã" }] }).success).toBe(false);
    expect(importCommitSchema.safeParse({ reviewAcknowledged: true, posts: [{ ...valid, copyText: "x".repeat(10001) }] }).success).toBe(false);
    expect(importCommitSchema.safeParse({ reviewAcknowledged: true, posts: [{ ...valid, channel: "" }] }).success).toBe(false);
    expect(importCommitSchema.safeParse({ reviewAcknowledged: true, posts: [{ ...valid, format: "meme" }] }).success).toBe(false);
  });
});
