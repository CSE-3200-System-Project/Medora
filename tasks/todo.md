# Task — Raise PHI redaction recall baseline, then sharpen the plan

**Goal:** lift measured redaction recall from 75.5% with principled, general (not case-fitted)
deterministic rules, re-measure on the 134-case set, then state the new baseline + the >90%
learned-NER plan more prominently in the whitepaper. Plain-language vision throughout.

## Constraints
- Production redactor `backend/app/core/ai_privacy.py` — minimal blast radius, additive patterns only.
- Patterns must GENERALIZE (name lists, obfuscation handling, month-name dates), not match the 134
  strings verbatim. Report stays honest: 134 is a dev set; held-out validation is the 8-15k plan.
- Re-run the FULL safety benchmark: recall must rise AND over-redaction/precision must not regress.
- No "anonymised" claims. Redaction is defense-in-depth.

## Todo
- [ ] Read redactor + the actual missed cases (name/email/date/passport/account/address categories)
- [ ] Add name coverage: honorific/role triggers + conservative gazetteer
- [ ] Add adversarial-email pattern ([at]/(at)/dot/spaces)
- [ ] Add textual-date pattern (month names EN + Bangla)
- [ ] Loosen bare passport/account in ID context
- [ ] Add address gazetteer (divisions/districts)
- [ ] Re-run safety benchmark; confirm recall up, over-redaction in bounds
- [ ] Update paper: new baseline number + prominent >90% NER-union plan, plain words
- [ ] Update claim-evidence-map + self-review

## Review

**Done, verified, honest.**
- `backend/app/core/ai_privacy.py`: added general rules for the leaking classes — obfuscated
  email, textual dates (EN+BN months), bare document IDs, broadened account-ID (digit-required
  value), name gazetteer + honorific/role triggers, structural+area addresses. Fixed two
  over-greedy patterns caught by the benchmark (account-ID ate lowercase words; address ate
  benign sentences; obfuscated-email ate the trailing clause).
- Results: 134-case dev set now recall 1.0 / precision 0.969 / over-redaction 2.4% (was
  .947/.755/.032). **Reported as a DEV figure, not a recall claim** (rules tuned on that set).
- Held-out probe (`generate_phi_holdout.py`, `pii_holdout_cases.jsonl`): structured/cued classes
  generalise ~100%; residual is unlabelled unseen names -> motivates the learned NER.
- Retired 22 stale residual-risk flags + 1 stale over-redaction flag in `pii_safety_cases.jsonl`
  (previously-documented leaks now genuinely fixed; the honesty test enforces this).
- Tests: `test_ai_privacy.py` + `test_softwarex_privacy_suite.py` = 13 passed; safety benchmark
  gate green. Archived v1.0.2 softwarex result left untouched (baseline provenance).
- Paper: §Lokkhon states dev closure + held-out residual honestly; §PHI plan sharpened to target
  unlabelled names; abstract keeps the archived 75.5% baseline. Held at 10 pages, em-dash-free.
- claim-evidence-map + self-review updated.

**Not run:** full repo suite (blast radius beyond privacy) — redaction change is additive/"redact
more", low risk; privacy unit tests + full safety benchmark (privacy+navigation+summary) all green.
