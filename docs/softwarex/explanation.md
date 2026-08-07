# Defending the SoftwareX manuscript

Written for the supervisor meeting. It covers where the manuscript stands, how each item on
the revision checklist was handled, which items were deliberately not handled the way the
checklist suggested, and what is still open.

## Current state, in numbers

| Measure | Value | Where it comes from |
|---|---|---|
| Word count under the journal's own rule | 2,995 | `tools/release/check_softwarex_release.py`, the counter the release gate uses |
| Figures | 6 (3 diagrams, 3 interface plates) | the journal's maximum is 6 |
| Interface panels | 8, two of them phone viewports | inside the 6 figures, so the cap still holds |
| Compiled length | 18 pages | pdfTeX, MiKTeX 26.5 |
| Overfull boxes | 0 | `medora_softwarex.log` |
| Undefined references or citations | 0 | same log, after two passes |
| Numbered sections | 5 | Motivation, Software description, Illustrative examples, Impact, Conclusions |
| Abstract | 133 words | guideline is "ca. 100" |
| Keywords | 6 | maximum is 6 |

The release gate still exits 2, but on three complaints rather than seventeen, and all
three trace to the same two places: the Zenodo deposit has not happened and the licensed
clinician review has not happened.

```
- release metadata contains RELEASE_PENDING           # no DOI, URL, or archive hash yet
- missing generated artifact release_metadata.tex     # written only once the DOI exists
- generated report did not pass: safety_results.json  # clinician_reviewed = 0
```

The pre-archive gate matrix reads 19 passed, 2 blocked, 1 deferred. All nine verification
receipts pass on the commit they name. Neither open item is a scientific claim, and the
manuscript asserts nothing that depends on either.

## The length rules, and why the earlier answer was wrong

There are two documents, they disagree, and the stricter one is the one that binds.

The **article template** (`Updated_osp_template.tex`, which ships with the journal) says:

> Your main body of text (sections 1-5 below) should be a maximum 6 pages in total
> (excluding metadata, tables, figures, references) with a 3000-word limit (we ask that
> more priority is placed on the word limit versus the page count).

The **Guide for Authors** on ScienceDirect says something narrower:

> The maximum word count is 3000 excluding: title, authors, affiliations, references,
> metadata tables and including: abstract, running text, captions, footnotes. The maximum
> number of figures is six (6).

Two differences matter. Captions count toward the 3,000 under the Guide but are excluded
under the template's wording, and the Guide caps figures at six, which the template never
mentions. We now satisfy the stricter reading of both.

That change was expensive and it is worth being straight about the cost. Counted the
Guide's way, the manuscript stood at 3,557 words with 9 figures. Getting to 2,995 words and
6 figures meant dropping three figures and cutting roughly 570 words:

- The booking-timeline diagram is gone. Its content, that consistency ends at commit and
  propagation is measured separately, is now a sentence in the text and a column in the
  booking table.
- The prescription-composition screenshot is gone. The medicine reference is still
  described and counted in its own table.
- The standalone mobile plate is gone, but two phone viewports came back as panels inside
  the consent and assistive-AI figures. Panel (c) of the consent figure is the same screen
  as panel (a) at a phone width, which is the responsiveness evidence, and it costs no
  figure against the cap because it lives inside an existing figure.
- The rest came out of prose, mostly by compressing captions, removing repetition between
  the Motivation and the Conclusions, and cutting one enumeration that duplicated a table
  column.

Nothing was removed that carried a claim, a number, or a limitation. Every checklist item
that was satisfied before is still satisfied.

Page count is now a non-issue: 18 pages of which most are floats, and the Guide sets no
page limit at all.

## Checklist verification

The point-by-point response the checklist asks for lives in `response_to_revision.md`. The
change log it also asks for is the git history plus the append-only work log at the bottom
of `SUBMISSION_READINESS.md`. This table is the short version.

### Submission blockers

| Code | Status | Evidence |
|---|---|---|
| C1 fixed archived release and DOI | Blocked, external | `CITATION.cff`, `CHANGELOG.md`, `codemeta.json` exist and the software self-citation carries `\ReleaseDOI`. `tools/release/build_zenodo_deposit.py` builds the archive, hashes it, and writes the deposition record; the authenticated upload is the only remaining step |
| C2 separate text, image, audio paths | Done | `figures-src/trust_boundary.tex`; `processing_consent.py`; `ai_service/app/pipeline.py` |
| C3 no absolute anonymity claims | Done | Every remaining use of an anonymity word in the `.tex` is a limiting one |
| C4 evaluate PII and consent guard | Done | 134 production-path cases, precision 0.947, recall 0.755, false redaction 0.032, 43 written limitations, 0 undisclosed failures |
| C5 rebuild OCR evaluation | Withdrawn | No accuracy figure is stated and no OCR table is published. See "deliberate deviations" below |
| C6 OCR baselines and ablation | Withdrawn | Same reason. The harness is still in the repository for future work |
| C7 atomic booking under concurrency | Done | 30 of 30 at concurrency 2, 10, and 50. Transaction p95 81.1, 658.9, 1789.8 ms; outbox p95 124.5, 793.9, 1739.3 ms; no duplicate active row |
| C8 AI safety and factuality | Partly done | 30 navigation fixtures scored on two paths, 17 of 30 agreeing with the labelled class, 5 emergency false positives, 0 false negatives, 9 documented limitations. 12 of 12 summary fixtures run the summarizer end to end. Licensed clinician review is outstanding, and it is the reason `safety_results.json` reports `passed: false` |
| C9 ethics and data governance | Done for this release | The prescription image corpus is not deposited, which removes the approval-citation dependency. Provenance, licence, and a re-identification prohibition stay in the repository |
| C10 no production-grade wording | Done | The release gate fails on the literal phrase, and the abstract, impact, and conclusion are research-framed |

### Major revisions

M1 motivation, M2 navigation rather than triage, M3 grounded summaries, M4 acknowledgment
and discrepancy semantics, M6 consistency separated from propagation, M8 role and
permission matrix, M9 consent semantics, M10 related work, and M12 worked examples are all
implemented with a named evidence path in `response_to_revision.md`.

M5, M7, and M11 were partial when this document was first written. All three are now
closed, and closing them is where most of the work of this pass went.

**M5** asked for a reproducible benchmark protocol covering API latency and web vitals as
well as booking. Booking was already frozen and executed. Lighthouse and the API latency
benchmark had never been run, and running each of them for the first time exposed
defects. The manuscript still reports no latency or Lighthouse number, so none of this
changes a claim; it changes whether the claim of having a protocol is true.

**M7** now runs. Twelve specs pass across the English and Bangla projects with no skipped
authenticated journey, against synthetic accounts a committed provisioner creates.

**M11** is closed conservatively. Neither Groq nor Vapi exposes its organisation
zero-data-retention flag to an API, so instead of recording a favourable claim nobody
verified, the manifest records the documented worst case as operative and states that no
zero-data-retention agreement is claimed. What was checked, and what each endpoint
answered, is written down beside it.

### Presentation

P1, P2, P3, P5, and P6 are done. P4 was the one that had been marked complete but was not,
and this pass fixed it. Details in the next section.

## What this pass found and fixed

Three real defects, none of which had been caught before.

**A wrong citation.** The TracSum reference had the author's name inverted, giving "C. Bo"
for what is actually Bohao Chu, and an abridged title. It is now the full author list, the
exact published title, the EMNLP 2025 page range, and the DOI. This is the kind of thing a
reviewer checks first, so it was worth finding.

**Two names for one language.** The manuscript used "Bangla" five times and "Bengali" three
times, and one table row managed both in the same cell: "Bengali localization ... Bundled
English and Bangla catalogs". Checklist item P4 asks for "Bengali" consistently in academic
prose, so every use of the language name is now Bengali. The country and its adjective stay
"Bangladesh" and "Bangladeshi", which is correct and not the same word.

**Unlabelled screenshots.** The checklist asks twice for screenshots to be labelled, and its
final audit asks for confirmation that demo accounts use synthetic records only. Ours are
not synthetic. The patient record in the figures is an author's own account. Rather than
claim synthetic data we do not have, each interface caption now points to the ethics
section, and that section states plainly that the patient record belongs to a consenting
author and the clinician entries are test accounts. One contact field visible in the
prescription figure is covered with opaque fill, using the same reasoning as the image
redaction tool: blur is partially invertible and is not a de-identification control.

If you would prefer strict compliance with the checklist's wording, the fix is to recreate
the same five screens on fully synthetic accounts and rerun `build_ui_figures.py`. That is
a couple of hours of work and no code changes. I did not do it unilaterally because the
current disclosure is accurate and recapturing changes what the figures show.

## The repository

The Guide for Authors is specific about the code as well as the paper. It requires an
open-access GitHub repository (it asks authors to avoid GitLab), a README.md and a
LICENSE.txt at the permanent link, and an Open Source Initiative licence. Three problems
turned up when we checked ours against that.

**`LICENSE.txt` did not exist.** It had been deleted earlier as a byte-identical duplicate
of `LICENSE`, which is reasonable housekeeping and also happens to remove a file the
journal asks for by name. Restored.

**`.gitignore` was swallowing the entire manuscript directory.** Line 82 read
`softwarex/`, with no leading slash. Git matches an unanchored directory pattern at any
depth, so it silently ignored everything under `docs/softwarex/` that was not already
tracked. The consequence is not cosmetic: `figures-src/chorui_architecture.pdf` and all six
interface PNGs could not be committed, so a reviewer cloning the repository would get a
manuscript that does not compile, and the archived release would ship a broken paper. The
pattern is now anchored to the repository root, and the two figure sources the manuscript
inputs are explicitly un-ignored.

**One reproducibility gap we left open, deliberately.** `docs/softwarex/imagesui/` holds the
raw screenshots and stays out of the repository at about 25 MB. The figures derived from
them are committed, so the paper builds from a clean clone, but re-running
`tools/softwarex/build_ui_figures.py` needs the raw captures. Adding them is a size
decision rather than a correctness one, so it is yours to make.

Everything else the Guide asks for is present: `README.md` with install, run, and test
instructions, `CITATION.cff`, `CHANGELOG.md`, `codemeta.json`, `CONTRIBUTING.md`,
`CODE_OF_CONDUCT.md`, `SECURITY.md`, `THIRD_PARTY_NOTICES.md`, `DATA_LICENSE.md`, and the
MIT licence, which is on the Open Source Initiative list.

## Reference verification

Every bibliography entry was checked against a registry, not against memory.

| Entry | Checked against | Result |
|---|---|---|
| `prescriptionocr` | Crossref, DOI 10.1016/j.compbiomed.2025.109812 | Exact match, Apurba Datta, Comput. Biol. Med. 188, 2025, article 109812 |
| `bdmeds` | DataCite, DOI 10.17632/zhtvkny53n.1 | Match. Title punctuation aligned to the source |
| `tracsum` | Crossref | Corrected, as above |
| `wallace2022` | Crossref, DOI 10.1038/s41746-022-00667-w | Exact match, npj Digital Medicine 5, 2022, article 118 |
| `ahmed2014` | Crossref, DOI 10.1186/1472-6963-14-260 | Exact match |
| `khan2012` | Crossref, DOI 10.1002/j.1681-4835.2012.tb00387.x | Exact match |
| `rxnorm` | Crossref, DOI 10.1109/MITP.2005.122 | Exact match, IT Professional 7(5), 17 to 23 |
| `du2020`, `shing2021` | arXiv API | Both exact, arXiv:2009.09941 and arXiv:2104.13498 |
| `whisper` | PMLR v202 | Page range 28492 to 28518 confirmed |
| `openmrs`, `bahmni`, `gnuhealth` | Project documentation sites | Cited as documentation, not as papers |

## Deliberate deviations from the checklist

Three places where we did not do what the checklist suggested. Each is defensible, and each
should be raised before someone raises it for us.

**We did not use the recommended title.** The checklist proposes "Medora: An open-source,
consent-aware platform for healthcare workflow management, prescription digitization, and
bounded AI assistance". Prescription digitization is no longer a claim we make, so putting
it in the title would advertise a capability the paper reports as not working. The current
title leads with the two contributions that survived review.

**We did not use the recommended abstract either**, for the same reason. It describes OCR
field accuracy as part of the technical evaluation.

**We withdrew the OCR accuracy claim instead of completing C5 and C6.** This is the biggest
deviation and the one most worth rehearsing. Completing those items honestly needed 103
corrected transcriptions from the primary author, 103 blinded independent labels from a
different licensed clinician or pharmacist, full adjudication of every disagreement, a
corpus freeze, and one held-out run of the eight-configuration ablation. None of the human
labelling happened. The pipeline also does not work well enough on handwritten Bangladeshi
prescriptions to support a claim even if it had been labelled, because recognition on
cursive prescriber handwriting is the binding constraint and fuzzy matching against 67,001
brands turns a partly recognised token into a confident wrong match as easily as a correct
one.

So the paper reports it as a negative result with the mechanism named, publishes no number,
and keeps the code. A reported negative result costs less credibility than a
weakly-supported positive one, and it is the only version of this section we can defend.

## Two things we chose not to change

The manuscript uses "doctor" for the system role and "clinician" for the human doing the
reviewing. P4 asks for "clinician where the role is not limited to a physician". In Medora
the role is limited to a physician, since doctors are verified against BMDC registration, so
"doctor" is correct where it names the role. If you want it uniform anyway, it is a
mechanical pass.

The Impact section is short, and SoftwareX says reviewers weight that section heavily. It is
short because we have no downloads, no users, no citations, and no commercial deployment,
which are the things the template asks that section to report. Padding it with prospective
benefit is the exact overclaiming that C10 exists to prevent. The section instead names what
is reusable independently of the platform: the medicine reference with its build script, the
deterministic mock provider, and the registry containment pattern.

## What running the untested benchmarks exposed

Every benchmark that had never been executed was broken, and one of them was measuring a
real product defect. This is the same pattern as the 2026-08-03 evidence audit: a check
that has never run is not evidence that something works.

**The landing page took 12.3 seconds to paint on a throttled mobile connection.** The hero
carousel advances every six seconds and only the first slide was preloaded, so the browser
attributed the largest contentful paint to an image that started downloading at the moment
of the advance. Desktop finished before the first advance and scored 0.99 on the same page,
which is why nobody had noticed. Below the large breakpoint that image is a thirty-percent
opacity decorative wash behind the text, so it is now pinned to the slide that is
preloaded; the visible rotation continues on desktop and the text and buttons still rotate
on mobile. The page went from 0.72 to 0.91 and from 12,282 ms to 2,205 ms.

**The latency benchmark had three defects that would each have produced a meaningless
number.** Every booking targeted the same date and slot, so fifty-nine of sixty requests
measured the rejection path. Sixty requests were sent to an endpoint documented as
accepting twenty per minute, so forty of them measured the rate limiter. The upload
fixture was a one-pixel PNG that Pillow rejects as truncated, so every OCR request answered
502. After fixing all three the run is 155 requests with zero failures.

**Six browser journeys had never executed and all six were broken.** The worst of them was
a login helper that filled a password field, clicked sign in, waited for the network to go
quiet, and returned without ever checking that it had logged in. Had the other defects not
masked it, every authenticated spec would have run as an anonymous visitor and passed.

**A production dependency vulnerability had come back.** `dompurify` at or below 3.4.12
carries a moderate cross-site-scripting advisory and reaches the bundle through
`html2pdf.js`. The gate matrix claimed zero production vulnerabilities. It is pinned now.

## Still open, and who has to close it

Two gates, neither of which an agent or a script can close honestly.

1. A licensed clinician has to review the 30 navigation fixtures. Two of them, NAV-022 and
   NAV-023, are Bengali paraphrases of red-flag presentations that the current patterns do
   not match, and they need a clinical decision rather than a yes or no sign-off.
2. The release manager has to tag, deposit, and paste the DOI back into
   `release_metadata.json`. `tools/release/build_zenodo_deposit.py` does everything up to
   that point: it refuses to run on a dirty tree, builds the archive from the exact
   verified commit, hashes it, writes a Zenodo deposition record from `CITATION.cff`, and
   prints the five remaining steps in order.

Only after both does `check_softwarex_release.py` exit 0, and it is written to stay
fail-closed until then.

One wrinkle in that procedure is worth knowing before you hit it. `verification.json`
records the commit its nine checks ran against, and it is a tracked file, so committing it
always leaves it naming its own parent. The checker compares that field to HEAD and
refuses the mismatch. In practice `verification.json` and `release_metadata.json` stay
uncommitted at the point of deposit, and the deposit builder treats exactly those two as
expected-dirty and everything else as a stop.

## Likely questions

**Which length rule did you follow?** The stricter of the two. The Guide for Authors counts
captions and caps figures at six, so the manuscript is measured that way: 2,995 words and 6
figures. The template's separate 6-page guidance has no equivalent in the Guide, and the
page count is not a limit the Guide states.

**Are the screenshots real patient data?** No third party's record appears. The patient
record shown belongs to an author who consents to publishing it, and the clinician entries
are test accounts. The ethics section says this rather than claiming the data is synthetic.

**Why does the safety benchmark say `passed: false`?** Because `passed` is defined as
`deterministic_passed and review_complete`, and the licensed clinician review has not
happened. `deterministic_passed` is true. The flag is the gate working, not a failure.

**Why report 75.5% recall instead of improving it?** Because the test corpus was written
independently of the redaction patterns it tests. Tuning the patterns against the corpus
would raise the number and destroy its meaning. The 23 misses are enumerated with a written
limitation each, and the release gate fails on any undisclosed one.

**Did an AI write this paper?** An AI-assisted writing and coding tool was used during
revision, and the manuscript declares it in the standard Elsevier declaration. The authors
checked the manuscript, the code, the citations, and the generated evidence. The citation
error found in this pass is an example of that checking working.
