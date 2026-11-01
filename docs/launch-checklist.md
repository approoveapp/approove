# Global launch checklist

What this branch adds for the global, English-first launch, and what still has to happen outside the code before turning it on. The AI import gates in [import-production-readiness.md](import-production-readiness.md) still apply; this list does not replace them.

## What changed in the product

- **Positioning.** The home page, page titles and structured data speak to social media managers and agencies (no longer "agencies and marketing teams"). The hero says the approval resets when the creative or caption changes. Sections now go: problem → how the client approves → why the approval holds → AI import → team features → pricing.
- **AI import on the site follows the feature flag.** The AI import section, its FAQ answer, the nav link, the marquee item and the "AI imports per month" line in pricing only show when `IMPORT_AI_ENABLED=1` (any non-production environment counts as on). Turning the flag off hides them again.
- **FAQ.** New answers to "Does Approove schedule or publish posts?" and "How is it different from Planable, Later, or Sprout Social?".
- **Language.** `?lang=en` or `?lang=pt` on any page sets a cookie (`approove-locale`) that wins over country and browser language. The site footer has an English / Português switch. Currency still follows the language: English shows USD, Portuguese shows BRL. Use `?lang=en` on English ad links.
- **Founding offer.** Set `STRIPE_FOUNDING_COUPON_ID` and the coupon is applied automatically at checkout, and the hero, pricing and subscribe pages show "Founding offer: X% off …" with the spots left. The discount, duration and number of spots all come from the Stripe coupon. When the coupon runs out or becomes invalid, the offer disappears and checkout goes on without it.
- **Signup and onboarding.** Signup asks for "Your business name" (freelancers don't have an agency). Onboarding is now three questions: who you are, how many clients, and where clients approve today. The answers are saved on the organization (`profileRole`, `profileClientRange`, `profileChannels`, `profileAnsweredAt`) and sent to GA as `onboarding_profile`. Only the owner who signed up sees onboarding.
- **Dashboard.** A "Get started" checklist (add a client → add or import posts → send the review link) stays until a client first approves or asks for changes. That moment fires the GA event `first_client_response`.
- **English across the app.** The client workspace, client review page, pins, reviewers, invite pages, e-mails, API error messages, AI import and the Terms/Privacy pages now have English text.

## Before turning it on

1. **Database.** Apply `prisma/migrations/20261031-1-onboarding-profile` (additive, four nullable columns) after `20261022-1-import-jobs`, before deploying code that reads them. Rehearse with `npm run qa:migration:prod` first.
2. **Founding coupon (optional).** In Stripe, in both test and live mode, create a coupon, for example 30% off, duration `forever`, `max_redemptions` 100. Put its ID in `STRIPE_FOUNDING_COUPON_ID` in Vercel. Leaving it empty means no offer.
3. **AI import.** Complete the gates in `import-production-readiness.md`, then set `IMPORT_AI_ENABLED=1`, `ANTHROPIC_API_KEY`, `IMPORT_BLOB_READ_WRITE_TOKEN` and `CRON_SECRET` in Vercel. Rollback is `IMPORT_AI_ENABLED=0`.
4. **Legal.** The English Terms and Privacy pages are translations of the Portuguese ones and need a legal review before you rely on them outside Brazil.
5. **Analytics.** In GA, mark `onboarding_profile` and `first_client_response` as key events, and send the Meta Pixel/CAPI "trial started" event from signup if you run paid ads.
