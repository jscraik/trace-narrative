# Firefly Narrative — Interface Craft UI/UX Review

**Date:** 2026-02-23  
**Skill used:** Interface Craft by Josh Puckett — Design Critique sub-skill  
**Input mode:** Code + live application screenshots  
**Disclaimer:** Visual observations are inferred from code and live screenshots. Items marked with ⚠️ are inferred from code alone and should be verified visually.

---

## Table of Contents
- [Context](#context)
- [Noticing Log](#noticing-log)
- [First Impressions](#first-impressions)
- [Visual Design](#visual-design)
- [Interface Design](#interface-design)
- [Consistency & Conventions](#consistency--conventions)
- [User Context](#user-context)
- [Uncommon Care Opportunities](#uncommon-care-opportunities)
- [Less, but Better Reductions](#less-but-better-reductions)
- [Top Opportunities](#top-opportunities)
- [Industry Standard Gap](#industry-standard-gap)
- [DialKit Assessment](#dialkit-assessment)
- [Animation & Motion Assessment](#animation--motion-assessment)
- [Component Architecture Assessment](#component-architecture-assessment)

---

## Context

**Screen purpose:** Firefly Narrative is a Tauri desktop app that captures AI-agent coding sessions and presents a rich, timeline-driven narrative of code evolution. It spans five modes: Landing (brand hero), Demo (sample data), Repo (live git analysis), Dashboard (metrics), and Docs (overview).

**Who it serves:** Developers and engineering leads who use AI coding agents (Claude, Codex, Gemini, Kimi, Ollama) and want to understand, attribute, and tell the story of their code's evolution.

**Emotional context:** Productivity + exploration + trust. Users come to understand *intent* behind their code. Moments of discovery (insight) should feel rewarding; mundane tasks (browsing commits, reading diffs) should feel effortless. The brand identity carries a warm, amber/firefly aesthetic that is deeply integrated.

**Data assessment:** Demo mode uses representative data. Repo/Dashboard/Docs modes show empty states when no repository is loaded. The screenshots show the app in a real dev environment.

---

## Noticing Log

*Observations only — no prescriptions.*

1. **Landing page:** The hero orb + circuitry SVG is visually striking, but the orb partially overlaps the "Narrative" text and subtitle, making both harder to read at the captured viewport size. The subtitle text is cut off on the right ("discover the na…" and "woven into every co…").

2. **Landing page — DialKit overlap:** The "Brand Hero" DialKit panel permanently overlaps the top-right quadrant of the page, covering the "Docs" tab and "Open repo…" button. This is expected in dev-mode but obscures the navigation for any non-developer user.

3. **Landing page — footer brand chips:** The partner agent logos are visible and readable. The Kimi icon appears as a tiny dot, barely visible compared to the others.

4. **TopNav — "Docs" tab truncated:** The "Docs" tab is partially hidden behind the DialKit panel and the right-edge button cluster. With 5 tabs, the nav is near its horizontal limit.

5. **Demo view — timeline node labels:** Timeline labels at the bottom are truncated with ellipsis ("mory-effi…", "Built lazy-loading fo…"). The relationship between labels and dots is unclear at smaller sizes. Dates below ("Jan 18", "Jan 19", "Jan 20") provide useful temporal context.

6. **Demo view — "FAILURE" badge:** A red "FAILURE" badge appears in the Capture section without any context about what failed or how to fix it. This is an unresolved error state.

7. **Demo view — "No decision context available yet":** The "WHY THIS WAS BUILT THIS WAY" card has a single line of placeholder text. It occupies visual real estate without adding value.

8. **Repo / Dashboard empty states:** Both empty-state views are visually identical except for the icon (git branch vs. bar chart) and heading. The "Explore History" and "Link Sessions" cards look interactive but have no click handler visible in the screenshot. The "Waiting for repository context…" text is informative but passive.

9. **Error notification:** A persistent red circle with "!" (⊘) appears in the top-right across all views, suggesting a background error notification. It is not dismissible from the screenshots.

10. **Color system:** The warm amber/orange brand palette is deeply and consistently integrated through CSS custom properties. Light and dark mode both have dedicated token blocks.

11. **Typography:** The `brand-firefly` class uses 'Caveat' cursive font for the "Firefly" word, creating a distinctive hand-drawn feel. The rest of the UI uses system sans-serif. No Google Fonts are loaded for body text.

12. **Scroll containers:** The timeline has a `no-scrollbar` class hiding the scrollbar but maintaining scroll functionality. This is a deliberate aesthetic choice but may cause accessibility concerns.

13. **Focus management:** Focus rings are implemented with `--ring` variable and `:focus-visible` selectors. The `core-orb` button has explicit focus styles. This is above-average.

14. **Reduced motion:** Comprehensive `@media (prefers-reduced-motion: reduce)` rules are implemented across all animation files (firefly.css, FireflyHero.css, FireflyLanding.css). This is exemplary.

---

## First Impressions

This is a **well-above-average** application in terms of design intent and craft. The warm amber brand identity is deeply embedded — not an afterthought — and the token-driven design system (`styles.css`) is among the most thorough I've seen in a project of this size. The glassmorphism, `color-mix()` accent surfaces, `oklab` color space usage, and dark-mode adaptation all signal senior-level visual design thinking. The Landing hero with its copper-trace circuitry, breathing orb, and spring-physics mouse interaction is genuinely memorable.

However, the demo view reveals that the working interface has a **density and hierarchy problem**. There's a lot happening — intents, captures, decision context, files, timeline, breadcrumbs — and the visual weight distribution doesn't guide the eye clearly. The left column reads more like a vertically stacked settings page than a narrative tool. The brand promise of "telling a story" doesn't fully carry through into the UI beyond the landing page's emotional impact.

---

## Visual Design

### Color Intent
**Excellent.** The `color-mix(in oklab, ...)` approach for deriving accent surfaces (light, bg tints) is state-of-the-art. The five-color accent palette (blue, green, red, amber, violet) is systematically applied to semantic states (file pills, trace pills, test results, anchors). The `--contrast-lock` system for glass-heavy layouts is a thoughtful solution to legibility issues.

**No issues at the token level.** The design system is well-organized and would scale to additional views.

### Typography
**Good, not exceptional.** The hierarchy is carried primarily by font-size and weight, which works. But:

- **Issue:** Body text uses native system font stack (`-apple-system, BlinkMacSystemFont, …`). **Impact:** On macOS the rendering is excellent, but the app lacks a distinctive typographic voice beyond the Caveat brand word. **Direction:** Consider loading Inter or a similar modern sans-serif to create a sharper identity in the data-heavy views.

- **Issue:** Section headers use `text-transform: uppercase` with tight letter-spacing (0.03em). The uppercase styling fights with the warm, organic Caveat brand. **Impact:** The app feels like it has two competing personalities — handwritten warmth vs. enterprise-uppercase severity. **Direction:** Consider using sentence-case headers with semibold weight to create calm authority without uppercase rigidity.

### Spacing & Alignment
- **Issue:** The main BranchView content area uses `gap-5 p-6 lg:p-8`, which is generous. But within cards, spacing varies (the `.card` has varying internal padding per component). **Impact:** The rhythm feels uncertain between tight (timeline dots at 12px) and loose (intent list with generous padding). **Direction:** Establish 2–3 internal card padding steps (compact: 12px, default: 16px/20px, generous: 24px) and apply consistently.

### Shadows & Borders
**Good.** The `--shadow-sm` / `--shadow-md` system is clean. The `card` class with `var(--surface-elevated-sheen)` gradient overlay creates a premium glass feel. The subtle `inset 0 1px 0 ...` highlights on the landing shell are a nice touch.

---

## Interface Design

### Focus Mechanism
- **Issue:** The demo view presents 7+ distinct sections stacked vertically (BranchHeader, Narrative panel, Governance panel, Archaeology panel, Capture strip, Intent list, Breadcrumb, Files changed). There is no clear primary focal point. **Impact:** New users don't know where to start reading. The eye wanders. **Direction:** Introduce a visual "hero metric" or summary bar at the top of the BranchView that answers "what happened?" in one line before the detailed panels.

### Progressive Disclosure
- **Issue:** The right panel uses a tabbed interface (`RightPanelTabs`), which is good. But the left column shows everything at once. **Impact:** Information overload on the primary panel. **Direction:** Consider collapsing secondary panels (Governance, Decision Archaeology, Capture) into an expandable or tabbed structure on the left as well, or use a priority-based layout where secondary content collapses below a "Show more" boundary.

### Density
- **Issue:** The intent list has generous vertical spacing. Each intent is a full-width row with an arrow icon + text + a pill badge. **Impact:** 5 intents consume approximately 300px of vertical space — a significant portion of the viewport. **Direction:** Consider a more compact layout (inline badges, tighter line-height) or a summary → expand pattern.

### Feedback
- **Issue:** The "FAILURE" badge in the Capture section is a static red label with no explanation, action, or link. **Impact:** The user sees a problem but has no guidance on resolution. This erodes trust. **Direction:** Badge should include a hover tooltip or inline description and ideally a remediation action ("Retry", "View logs").

### Redundancy
- **Issue:** The empty Repo and Dashboard states share the exact same "Explore History" + "Link Sessions" card pair. These cards appear to be non-interactive. **Impact:** Users may click them expecting something to happen. **Direction:** Make the cards actionable (clicking "Explore History" should trigger `onOpenRepo`) or clearly style them as informational badges, not interactive cards.

---

## Consistency & Conventions

### Pattern Reuse
**Strong.** The pill system (`.pill-file`, `.pill-tool-*`, `.pill-test-*`, `.pill-trace-*`, `.pill-anchor-*`) is extremely well-structured. Each category has consistent border, background, and text color derivation using `color-mix()`. This is a model of systematic design.

### Platform Conventions
- **Issue:** The TopNav tab bar uses a custom segmented control design rather than native Tauri/macOS title bar integration. **Impact:** The app looks web-like rather than native when running in Tauri. **Direction:** Consider using Tauri's `decorations: false` with custom title bar for a more native feel, or leverage the current design but remove the redundant title bar chrome.

### Cohesive Design Language
**Mostly cohesive.** The warm amber brand color runs through: the `brand-firefly` text glow, landing page overlay, HUD tags, orb core, circuit traces, and error-ish notification dot. The only break in cohesion is the transition from the emotionally warm Landing view to the utilitarian, mostly gray/blue Repo view. The amber identity disappears in the working views.

- **Issue:** The timeline dots use `--accent-blue` as their primary color, not the brand amber. **Impact:** The signature brand color is absent from the primary workspace. **Direction:** Consider using amber for the blue accent in the timeline's selected state, or introduce a subtle amber accent as a secondary highlight in the working views (e.g., the Firefly signal uses amber, but the timeline itself uses blue).

---

## User Context

This app serves users in a **moderate-cognitive-load** context — they're reviewing work they've already done (or an AI has done). The emotional stakes are around trust and understanding:

- **Trust:** "Is this AI attribution accurate?" — The trace/session system addresses this directly. The Governance and Rollout panels add transparency.
- **Understanding:** "What happened and why?" — The narrative/intent panels tackle this but need stronger hierarchy.
- **Efficiency:** "Can I quickly scan the timeline and find what matters?" — The timeline works well for this with its dot-status-color coding, but truncated labels hurt scannability.

**Cognitive load concern:** The BranchView has ~15 props threaded through 40+ lines of the JSX tree. While this is an implementation concern, it manifests as UI density. Users face a wall of panels rather than a narrative flow.

---

## Uncommon Care Opportunities

1. **Timeline empty-then-populated transition:** When a repo loads and commits appear in the timeline, there is currently no entrance animation for the dots. Adding a staggered fade-in-up as commits populate would reinforce the "building a narrative" metaphor and feel polished. Use the Storyboard Animation pattern.

2. **Firefly as progress indicator:** The Firefly Signal animation system exists (`FireflySignal.tsx`) but is primarily decorative. Consider using the firefly "analyzing" state as a loading indicator when files/diffs are being fetched — replacing the generic "loading…" text with the firefly orbiting or pulsing. This would integrate the brand mascot into the functional UX.

3. **Error state with warmth:** The `FAILURE` badge and red error banners use harsh semantic red on a warm amber app. Design a custom error treatment that uses amber-tinted red (e.g., `color-mix(in oklab, var(--accent-red) 70%, var(--accent-amber) 30%)`) to keep error states on-brand while still signaling urgency.

4. **Timeline "now" indicator:** If the timeline represents the HEAD commit, add a subtle "now" marker or pulsing indicator on the rightmost node. Currently, the selected node has a blue ring, but there's no distinct affordance for "this is where you are."

5. **Keyboard navigation micro-feedback:** The timeline supports arrow-key navigation (`onKeyDown` handler). Add a subtle transient tooltip or visual indicator when the user navigates via keyboard to reinforce that keyboard interaction is supported and working.

---

## Less, but Better Reductions

1. **Remove the "WHY THIS WAS BUILT THIS WAY" card when empty.** "No decision context available yet" is wasted space. Hide the section entirely until data exists, or merge it into the BranchNarrativePanel as an expandable subsection.

2. **Consolidate TopNav tabs.** Five modes (Landing, Demo, Repo, Dashboard, Docs) is a lot for a segmented control. The "Landing" tab is unusual — it's a marketing/brand page, not a workspace. Consider removing it from the nav and making it the initial startup view only (which it already is by default). This frees horizontal space and simplifies the mental model to 4 modes.

3. **Simplify the Repo/Dashboard empty states.** Two static feature cards on an otherwise empty page create a sparse, under-designed impression. Replace with a single focused call-to-action: "Open a repository to get started →" with the git branch icon. Keep "Explore History" / "Link Sessions" details as hover/tooltip information, not standalone cards.

4. **Reduce DialKit panel presence.** The DialKit panel is always visible in dev mode, covering navigation. Add a collapsed/minimized state (a small floating button) by default, expanding on click. This preserves the DialKit workflow while keeping the UI usable for visual review.

5. **Trim timeline label overflow.** Currently labels truncate with CSS ellipsis, which is fine for long text, but 6-character truncations like "mory-effi…" are unreadable. Set a higher min-width for labels or show only the first meaningful word.

---

## Top Opportunities

### 1. **Strengthen the BranchView hierarchy** (Expected impact: High)
The primary workspace reads as a flat stack of panels. Introduce a visual summary bar or "What changed" headline at the top, followed by primary content (narrative + files/diff) and collapsible secondary content (governance, archaeology, capture). This reduces cognitive load and helps users orient immediately.

### 2. **Carry the amber brand identity into workspace views** (Expected impact: Medium-High)
The brand identity disappears after the Landing page. Thread amber accents through the timeline (selected dot, Firefly), section headers, and at least one surface treatment in the BranchView. This creates emotional continuity between the landing promise and the working experience.

### 3. **Design error states as first-class UI** (Expected impact: Medium)
The "FAILURE" badge, persistent error notification dot (⊘ in top-right), and `ImportErrorBanner` are minimal implementations. Design these with the same care as the success/insight states: warm amber tinting, clear actions, and dismissibility. Error states are where trust is built or lost.

### 4. **Improve the empty state experience** (Expected impact: Medium)
Both Repo and Dashboard empty states are passively informational. Transform them into welcoming guided-start experiences: show a visual walkthrough preview, an animated illustration, or at minimum make the action cards interactive. The empty state is the first impression for new users in those modes.

### 5. **Add entrance animations to the BranchView** (Expected impact: Medium)
The `animate-in` / `slide-in-from-bottom-1` class is applied to the outer BranchView container, but the internal panels appear without stagger. Adding a 100–200ms stagger between the header, narrative panel, intent list, and files section would create a "revealing the story" feel that aligns with the product metaphor.

---

## Industry Standard Gap

### Baseline Context
**Category:** Developer tool / desktop app (Tauri).  
**Platform:** macOS.  
**Reference set:** GitHub Desktop, Linear, Raycast, Warp, Tower (git client).

### Current Gap Assessment

| Area | Rating | Notes |
|------|--------|-------|
| Design system / token architecture | ✅ **Above baseline** | The `color-mix(in oklab, ...)` system and `--contrast-lock` mechanism exceed typical dev tool standards. |
| Brand identity / visual distinctiveness | ✅ **Above baseline** | The Firefly/amber identity is memorable and consistently applied where it appears. |
| Motion / animation quality | ✅ **Above baseline** | Breathing orb, spring physics, reduced-motion respect, IntersectionObserver guards — this is exceptional. |
| Landing page / onboarding | ✅ **At baseline** | Solid hero, clear CTA, but no guided onboarding flow after landing. |
| Information hierarchy (workspace) | ⚠️ **Below baseline** | Linear, GitHub Desktop, and Tower all use clear primary/secondary panel splits. Firefly's BranchView is flat. |
| Empty states | ⚠️ **Below baseline** | GitHub Desktop, Linear, and Raycast all have rich, animated empty states with guided actions. Firefly's are static text. |
| Error communication | ⚠️ **Below baseline** | "FAILURE" badge with no context is below the standard set by Warp, Linear, and modern dev tools. |
| Keyboard navigation | ✅ **At baseline** | Arrow-key timeline navigation, tab management, focus rings — meets platform expectations. |
| Responsive design | ✅ **At baseline** | Mobile breakpoints exist for the hero. BranchView uses `lg:` grid for responsive columns. |
| Accessibility | ✅ **At baseline** | ARIA roles/labels on Timeline, focus-visible rings, prefers-reduced-motion. Good foundations. |

### Priority Fixes to Reach Baseline
1. Redesign workspace information hierarchy (primary/secondary split)
2. Design actionable error states with context and remediation
3. Create rich, guided empty states for Repo/Dashboard

### Innovation Opportunities (post-baseline)
- Firefly as a functional UX element (loading, insight discovery)
- Storyboard-driven entrance animations for narrative reveal
- Ambient brand identity threading into workspace (subtle amber treatments)

---

## DialKit Assessment

The project makes excellent use of DialKit for live tuning. Three `useDialKit` instances were found:

| Component | Dial Panel | Parameters | Assessment |
|-----------|-----------|------------|------------|
| `FireflyHero` | "Brand Hero" | physics (stiffness, damping, mass) + motion (breathDuration, jitterIntensity, mousePower) | **Well-structured.** Grouped into semantic folders. Parameters are meaningful and impact is immediately visible. |
| `Timeline` | "Timeline" | layout (padding, maskWidth) | **Functional but minimal.** Only 2 parameters. Could expose more layout controls (gap between nodes, dot size, label visibility threshold). |
| `RepositoryPlaceholderCard` | "Placeholder Card" | animations (breathingDuration, entryDelay, waitingDuration, cardYOffset) | **Good.** Exposes the entrance animation timing for tuning. |

**DialKit best-practice compliance:**
- ✅ `dialkit` + `motion` are installed
- ✅ `DialRoot` exists (visible in screenshots as floating panel)
- ✅ Parameters use the `[default, min, max, step]` tuple format
- ✅ Semantic grouping via nested objects (physics, motion, layout, animations)
- ⚠️ The DialKit panel overlaps navigation in its default position. Consider `position="bottom-right"` or adding a collapsed-by-default state.

---

## Animation & Motion Assessment

### Storyboard Pattern Compliance
The existing animations do **not** follow the formal Storyboard Animation pattern (no TIMING const, no ASCII storyboard comment, no stage-driven `useEffect`). However, the animation quality is high:

- **FireflyHero:** Uses `framer-motion` springs with a custom rAF loop for breathing/jitter. The breath value is synced to a CSS variable for text glow. This is sophisticated and correct, but doesn't use the stage pattern.
- **FireflySignal:** CSS-class-driven state machine (idle/tracking/analyzing/insight). Well-organized. Could benefit from the Storyboard pattern for the multi-state sequence.
- **Landing entrance:** Uses `animate-fade-in-up` CSS animation classes with `delay-*` utility classes. Simple and effective.
- **Reduced motion:** ✅ Comprehensive respect for `prefers-reduced-motion` across all animation files. This is above industry standard.

**Recommendation:** The rAF-based animation loop in `FireflyHero` is correct for its use case (continuous breathing), but any future sequenced animations (e.g., BranchView entrance, timeline population) should adopt the Storyboard pattern for readability and maintainability.

---

## Component Architecture Assessment

### Strengths
- **Design system as CSS:** The token layer in `styles.css` is comprehensive and well-documented, with clear light/dark mode switching.
- **Separation of concerns:** UI components live in `src/ui/components/`, views in `src/ui/views/`, hooks in `src/hooks/`, core logic in `src/core/`. Clean project topology.
- **Pill system:** 11+ pill variants follow a consistent derivation pattern using `color-mix()`. This is extensible and maintainable.
- **DialKit integration:** Clean separation — DialKit exposes the tuning interface without polluting component logic.

### Areas for Improvement
- **BranchViewInner prop surface:** 40+ props is a code smell that suggests this component should be decomposed into smaller sub-views or use a context provider for shared state.
- **Inline styles in FireflyHero:** `style={{ transform: ..., filter: ..., opacity: ... }}` on the breathing-wrapper could be moved to CSS classes with CSS variables set from JS, reducing re-render scope.
- **CSS file proliferation:** `styles.css` (1259 lines), `firefly.css` (411 lines), `FireflyHero.css` (497 lines), `FireflyLanding.css` (451 lines). These could be better organized into a clear import hierarchy to prevent cascade surprises.

---

*Review conducted using Interface Craft by Josh Puckett — Design Critique, Industry Standards, and DialKit assessment sub-skills. All visual observations verified against live screenshots captured from the running application at `http://localhost:1420`.*
