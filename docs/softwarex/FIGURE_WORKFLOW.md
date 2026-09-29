# Scientific figure-making workflow

The [figures4papers scientific-figure-making skill](https://github.com/ChenLiu-1996/figures4papers/tree/f0bb7559abe90f5e1828797126d4d133c1bd47d7/scientific-figure-making)
was inspected and installed for both authoring agents on 29 September 2026.
Upstream author: Chen Liu. Pinned revision: `f0bb7559abe90f5e1828797126d4d133c1bd47d7`.

## Installation and invocation

- Codex: `C:/Users/sarwa/.codex/skills/scientific-figure-making/SKILL.md`
- Claude Code: `C:/Users/sarwa/.claude/skills/scientific-figure-making/SKILL.md`

Both installations contain the upstream `SKILL.md` and five `references/` documents,
plus the upstream licence and a local source/provenance note. They are pinned copies,
not symlinks. Codex can discover the new skill on the next turn; restart or refresh
Claude Code's skill discovery if the current session does not list it. An explicit
absolute-path reference also works without discovery.

The skill describes Matplotlib conventions and helper interfaces; it is not an installed
plotting library or a runnable `finalize_figure` implementation. Implement helpers in an
appropriate plotting script when an actual figure is requested. Installing the skill
does not install Matplotlib, NumPy or TeX dependencies.

Example prompt for either agent:

> Use the scientific-figure-making skill and its design-theory.md and api.md references.
> Prepare a publication-sized plot from the specified frozen SoftwareX JSON report.
> Preserve every comparator, population boundary, denominator and reported uncertainty.
> Export PDF and 300-DPI PNG; inspect the result at its final manuscript width.
> Do not add it to the manuscript or replace an existing figure without checking the
> six-figure limit and whether it communicates more clearly than the current table.

## Relevance to the current paper

| Material | Fit | Current decision |
| --- | --- | --- |
| Rules/MuRIL/union comparison | Grouped comparison or point-and-interval plot; development and separate probe must remain distinct | Keep the current full table unless a figure is explicitly requested |
| Booking contention | Concurrency-versus-latency plot with separate transaction/outbox series | Keep the table's exact quantiles and topology scope; no invented smooth trend or confidence band |
| Emergency-screen uncertainty | Proportion-and-interval plot | Current table is compact and includes all four rates |
| Consent-scope experiment | Potential utility/exposure scatter | Five aggregate observations; do not imply a paired causal trade-off, clinical utility or a fitted optimum |
| Architecture and consent diagrams | Not this skill's primary scope | Retain the existing vector TikZ sources |
| Bilingual frontend illustrations | Not this skill's scope | Retain authentic captures and application context; do not fabricate or redraw screens |
| Excess manuscript float spacing | LaTeX layout, not Matplotlib styling | Already handled in the manuscript; installation does not change float placement |

The paper already has six figures. Skill installation does not create another revision
requirement or justify a seventh figure. Apply portable typography, vector export,
grayscale-distinguishable encoding and final-width inspection where appropriate, rather
than copying the demos' large canvas sizes or absolute font sizes into a small paper panel.
For proportions use honest bounds; bar charts normally start at zero. Do not infer
uncertainty from a curve's visual variation or conceal less favourable comparator results.

## Licence boundary

The [upstream licence](https://github.com/ChenLiu-1996/figures4papers/blob/f0bb7559abe90f5e1828797126d4d133c1bd47d7/LICENSE)
is **CC BY-NC 4.0**, not MIT. The skill/reference copies remain in the local agent
directories with their licence and provenance. No upstream scripts, demo figures or
assets are added to Medora's application, capsule or public release by this installation.
If code or assets are later adapted for redistribution, retain the required attribution,
identify modifications and resolve applicable licensing before inclusion; do not label
copied material as project-authored MIT code.
