# TODO — Joel's Iteration Backlog

Ideas for polishing the auth + professor area (Joel's lane). None of these touch Garv's or Neil's files.

## Polish in lane

- [ ] **Form validation on `AssignmentForm.tsx`** — required fields, min/max length, friendly error messages instead of browser defaults
- [k] **Empty states** — professor dashboard when there are zero assignments ("Create your first one")
- [ ] **Loading + error states** — spinner on save, toast on success/failure
- [k] **Confirm-delete UX** on `DeleteButton.tsx` — modal instead of `window.confirm`, or "type assignment title to confirm"
- [ ] **Auth polish** — password strength hint, "show password" toggle, redirect-after-login back to where they came from
- [k] **Forgot password flow** — wire up Supabase built-in email reset

## Cross-cutting (no one else owns these yet)

- [k] **Landing page / `src/app/page.tsx`** — replace default Next.js page with an Ora intro + login CTA
- [k] **Shared layout polish** — header with logout, role badge, breadcrumbs
- [] **Accessibility pass** — labels, focus rings, aria attributes on the forms
- [ ] **Mobile responsiveness** check across professor pages

## Pre-milestone-5 prep (helps QA)

- [ ] **Seed script** — `supabase/seed.sql` with sample professor + 3 assignments
- [ ] **README quickstart polish** — add a screenshot or two

---

Suggested next pull: **landing page + AssignmentForm validation** — both visible, both in lane, both make the demo feel finished.
