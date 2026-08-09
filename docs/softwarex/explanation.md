# Defending the SoftwareX manuscript

Written for the supervisor meeting. It covers where the manuscript stands, how each item on
the revision checklist was handled, which items were deliberately not handled the way the
checklist suggested, and what is still open.

## Current state, in numbers

| Measure | Value | Where it comes from |
|---|---|---|
| Word count under the journal's own rule | 2,999 | `tools/release/check_softwarex_release.py`, the counter the release gate uses |
| Figures | 6 (3 diagrams, 3 interface plates) | the journal's maximum is 6 |
| Interface panels | 8, two of them phone viewports | inside the 6 figures, so the cap still holds |
| Compiled length | 18 pages | pdfTeX, MiKTeX 26.5 |
| Overfull boxes | 0 | `medora_softwarex.log` |
| Undefined references or citations | 0 | same log, after two passes |
| Numbered sections | 5 | Motivation, Software description, Illustrative examples, Impact, Conclusions |
| Abstract | 131 words | guideline is "ca. 100"; it was 133 before the last pass |
| Keywords | 6 | maximum is 6 |
| Archived release | `v1.0.2`, DOI `10.5281/zenodo.21846125` | concept DOI `10.5281/zenodo.21844459` |

**`check_softwarex_release.py` exits 0.** It was failing on seventeen complaints when this
round started.

The archive is deposited, the manuscript cites its own DOI, and all nine verification
receipts pass on the commit the `v1.0.2` tag points at. The pre-archive matrix reads 20
passed, 1 blocked, 1 deferred. The blocked entry is the OCR gold standard, which is a
withdrawn claim rather than an unfinished one, and the deferred entry is the deposit
step that has now happened.

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
Guide's way, the manuscript stood at 3,557 words with 9 figures. Getting under the cap
meant dropping three figures and cutting roughly 570 words:

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
| C1 fixed archived release and DOI | Done | `v1.0.2` is archived at `10.5281/zenodo.21846125` under concept DOI `10.5281/zenodo.21844459`. The recorded checksum is of the file downloaded back from Zenodo, so it describes what is published rather than a local rebuild. The self-citation resolves through `\ReleaseDOI` |
| C2 separate text, image, audio paths | Done | `figures-src/trust_boundary.tex`; `processing_consent.py`; `ai_service/app/pipeline.py` |
| C3 no absolute anonymity claims | Done | Every remaining use of an anonymity word in the `.tex` is a limiting one |
| C4 evaluate PII and consent guard | Done | 134 production-path cases, precision 0.947, recall 0.755, false redaction 0.032, 43 written limitations, 0 undisclosed failures |
| C5 rebuild OCR evaluation | Withdrawn | No accuracy figure is stated and no OCR table is published. See "deliberate deviations" below |
| C6 OCR baselines and ablation | Withdrawn | Same reason. The harness is still in the repository for future work |
| C7 atomic booking under concurrency | Done | 30 of 30 at concurrency 2, 10, and 50. Transaction p95 81.1, 658.9, 1789.8 ms; outbox p95 124.5, 793.9, 1739.3 ms; no duplicate active row |
| C8 AI safety and factuality | Done | A licensed clinician reviewed all 30 navigation fixtures case by case and corrected two, so the labels are clinical rather than authored. 19 of 30 agree with the labelled class, emergency agreement is 7/7 on both scored paths, 5 emergency false positives, 0 false negatives, 7 documented limitations. 12 of 12 summary fixtures run the summarizer end to end |
| C9 ethics and data governance | Done for this release | The prescription image corpus is not deposited, which removes the approval-citation dependency. Provenance, licence, and a re-identification prohibition stay in the repository |
| C10 no production-grade wording | Done | The release gate fails on the literal phrase, and the abstract, impact, and conclusion are research-framed |

### Major revisions

M1 motivation, M2 navigation rather than triage, M3 grounded summaries, M4 acknowledgment
and discrepancy semantics, M6 consistency separated from propagation, M8 role and
permission matrix, M9 consent semantics, M10 related work, and M12 worked examples are all
implemented with a named evidence path in `response_to_revision.md`.

M5, M7, and M11 were partial when this document was first written. All three are now
closed, and they took most of the work.

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
and the manuscript pass fixed it. Details in the next section.

## What the manuscript pass found and fixed

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

## What the database audit turned up

Running Supabase's own linter and comparing the models against the live schema found two
things worth reporting to a supervisor, because both are the kind of defect a test suite
is structurally unable to see.

**Eleven enum members were usable in code and rejected by the database.** Writing any of
them raised at insert time and surfaced as a 500. `surgeryurgency` in Postgres held only
`immediate` and `scheduled`, so every surgery-urgency value the API accepts except
`scheduled` would have failed. `ConsultationStatus.CANCELLED` and the `years`, `ongoing`,
and `as_needed` prescription durations were in the same state. Two labels also existed in
the database with no member able to read them.

The test suite could not have caught this. `tests/conftest.py` builds its schema with
`Base.metadata.create_all`, which generates the enum types from the same models it is
checking, so the two always agree there by construction. This is the third instance of
the same shape in this project, after the PII corpus generated from the redactor's own
patterns and the grant test that ran against a fixture with no `anon` role.
`tools/release/check_enum_sync.py` now compares against a real database.

**The trigger on every appointment write had a mutable `search_path`.** An earlier audit
missed it because that audit only inspected `SECURITY DEFINER` functions. Revision
`sec_003` pins it.

Fifteen foreign keys also had no supporting index, and the database was two Alembic
revisions behind its own head because the medicine tables had been loaded outside the
migration that describes them.

Supabase's linter also reports fifty tables with row-level security enabled and no
policy. That one is deliberate: `sec_001` enables RLS with no policies precisely so the
default is deny, as a second barrier behind the revoked grants. The backend connects as
`postgres`, which bypasses RLS, so adding policies would grant access the design removed.

## The clinical review, and what it changed

The last gate needed a licensed clinician to judge the 30 navigation fixtures. He did it
case by case, and he did not simply agree with us.

**He corrected NAV-022 (`শ্বাসকষ্ট হচ্ছে`) and NAV-023
(`বুক ধড়ফড় করছে এবং মাথা ঘুরছে`) from specialty candidates to emergency**, on the
grounds that both need handling immediately. Those two were labelled by the authors, and
they were the two the "0 emergency false negatives" figure depended on. The figure had
been resting on a wrong label.

The rules were extended to match: `EMERGENCY_PATTERNS` previously matched only "cannot
breathe" and "severe chest pain" in Bengali, so neither presentation fired. It now also
matches `শ্বাসকষ্ট` and `ধড়ফড়`. Dizziness alone stays out deliberately, since NAV-023
matches on palpitations and broadening to `মাথা ঘোরা` had no clinical instruction behind
it. Across all 30 fixtures the change adds no new false positive.

| | before the review | after |
|---|---|---|
| emergency cases | 5 | 7 |
| emergency agreement, both paths | 5/5 | 7/7 |
| false negatives | 0, against an authored label | 0, against a clinical label |
| agreement overall | 17/30 | 19/30 |

This is the strongest evidence in the paper, and it is stronger precisely because the
reviewer changed something. The competing-interest section declares that he is the first
author's sibling: the ICMJE standard asks for disclosure of relationships a reader might
want to know about, regardless of conduct, and an undisclosed relationship discovered
later would cost far more than a declared one.

## Still open

Nothing gates the submission. Two items remain worth knowing.

The authenticated browser journeys run under Desktop Chrome at both locales, so they have
never executed at a phone viewport. The manuscript therefore says the patient client
installs and that the service worker controls the page, both verifiable, and says nothing
about the signed-in experience on a phone. Adding a mobile Playwright project is the
obvious next measurement.

The `v1.0.2` archive was deposited just before the final manuscript pass, so the `.tex`
inside it lacks the paragraph about the installable client. The software is identical and
the submission is the PDF, so this is cosmetic; it folds in free if another release
happens.

One wrinkle in the release procedure is worth knowing before you hit it. `verification.json`
records the commit its nine checks ran against, and it is a tracked file, so committing it
always leaves it naming its own parent. The checker used to compare that field to HEAD,
which no released repository can ever satisfy, since recording the receipts produces a
commit of its own. It now resolves the commit behind the tag named in `version` and
requires the metadata and the receipts to agree with that instead.

## Likely questions

**Which length rule did you follow?** The stricter of the two. The Guide for Authors counts
captions and caps figures at six, so the manuscript is measured that way: 2,999 words and 6
figures. The template's separate 6-page guidance has no equivalent in the Guide, and the
page count is not a limit the Guide states.

**Are the screenshots real patient data?** No third party's record appears. The patient
record shown belongs to an author who consents to publishing it, and the clinician entries
are test accounts. The ethics section says this rather than claiming the data is synthetic.

**Who was the clinician, and were they independent?** A licensed clinician registered with
the BMDC, and no: he is the first author's sibling, which the competing-interest
declaration states. He reviewed each fixture separately and corrected two of ours, which
is the opposite of rubber-stamping. Independence would be better and is worth arranging
for any future evaluation.

**Why is only agreement reported, and not accuracy?** Because the labels describe intended
navigation behaviour, not ground-truth clinical outcomes. Agreement with a reviewed label
says the implementation does what a clinician expected on those 30 utterances. It says
nothing about the thousands of presentations not in the fixture set, which is why the
limitations state that emergency rules cannot cover every presentation.

**Why report 75.5% recall instead of improving it?** Because the test corpus was written
independently of the redaction patterns it tests. Tuning the patterns against the corpus
would raise the number and destroy its meaning. The 23 misses are enumerated with a written
limitation each, and the release gate fails on any undisclosed one.

**Did an AI write this paper?** An AI-assisted writing and coding tool was used during
revision, and the manuscript declares it in the standard Elsevier declaration. The authors
checked the manuscript, the code, the citations, and the generated evidence. The citation
error found in this pass is an example of that checking working.
