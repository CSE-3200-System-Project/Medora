# Akkhor — Bangladesh medicine identity

**Release `akkhor-2026.08` · data CC BY 4.0 · code MIT · no authentication**

RxNorm does not cover Bangladesh. Akkhor is the canonical drug-identity layer Medora built
to work around that, published as a versioned HTTP API so anyone else can use it: a
hospital reconciling a formulary, a research group normalising prescription text, another
health-software vendor who needs the same reference and should not have to rebuild it.

Akkhor is permanently free and is never a paid line. It is not a revenue stream; it is the
reason Medora's clinical features are correct and the reason other Bangladeshi health
software can be correct too.

## What it contains

Counts are regenerated from the loaded database on every request to `/v1/akkhor/version`,
not transcribed here. As of `akkhor-2026.08`:

| Item | Count |
|---|---|
| Consolidated source rows | 71,795 |
| Canonical drugs (generic × strength × dosage form) | 7,389 |
| Brand entries | 67,001 |
| Search-index terms | 74,390 |
| Distinct generic names | 5,242 |
| Distinct brand names | 52,117 |

Distinct name counts fold case and surrounding whitespace: "Paracetamol" and
"paracetamol" are one generic. The raw distinct counts are 5,254 and 52,213, and the
difference is exactly that folding.

## Endpoints

Base path `/v1/akkhor`. The version is in the path because this is a contract consumers
pin against, unlike the unversioned in-app routes.

| Endpoint | Returns |
|---|---|
| `GET /version` | Release id, licences, and the six counts computed live |
| `GET /provenance` | The five source datasets, per-field derivation, and what is *not* established |
| `GET /drugs` | Canonical identities. Filters: `generic` (prefix), `dosage_form`, `strength` |
| `GET /drugs/{drug_id}` | One identity with every brand that maps onto it |
| `GET /brands` | Brand registry. Filters: `name`, `manufacturer`, `medicine_type`, `drug_id` |
| `GET /search?q=` | Typo-tolerant lookup over the term index |
| `GET /resolve?name=` | Best canonical identity for a free-text name, or an explicit no-match |

### Pagination

List endpoints use the platform's canonical contract: `limit` (default 20, max 100) and
`offset`, with `page`/`size` accepted as aliases. Responses carry
`{ items, total, limit, offset, has_more, page, page_size, total_pages }`.

### Caching

Corpus data changes only when the corpus is reloaded, so responses are publicly cacheable
with an `ETag`. Send `If-None-Match` and expect `304`. Every response carries
`X-Akkhor-Release`.

### Rate limits

Per client IP, per minute: 240 for catalogue reads, 120 for `/search` and `/resolve`, 10
for `/version` (it aggregates the whole corpus).

## `/resolve` is the interesting one

This is what an OCR pipeline or an external EMR calls. It does two things a plain search
does not.

**It splits an inline strength out of the name.** `Seclo 20mg` searches the index for
`Seclo` and constrains the result to a 20 mg row, instead of letting `20mg` drag the
similarity score down and resolving to whichever omeprazole sorts first. The response
echoes `name_searched` and `strength_applied` so you can see what it did.

**It can say no.** When nothing clears the confidence threshold, `resolved` is `false` and
you get the candidates in `alternatives`. A caller reconciling a prescription line needs
"no match" to be an answer it can receive — silently returning a nearest neighbour turns
an unmatched row into a confident wrong one.

```
GET /v1/akkhor/resolve?name=Seclo%2020mg
{
  "query": "Seclo 20mg",
  "name_searched": "Seclo",
  "strength_applied": "20mg",
  "resolved": true,
  "confidence": 0.75,
  "drug": { "generic_name": "omeprazole (mups tablet)", "strength": "20 mg", ... },
  "matched_on": "brand",
  "alternatives": [ ... ]
}

GET /v1/akkhor/resolve?name=zzzqqqxx
{ "resolved": false, "confidence": 0.0, "alternatives": [] }
```

## What this corpus is not

These constraints are served by `/provenance` as structured data, not just prose here.

- **Not regulator-sourced.** No source dataset has been validated against the DGDA
  register. Two of the five are community scrapes (MedEx and Netmeds), and the uploaders
  did not author the material they licensed. Do not describe Akkhor as official.
- **`common_uses` is search metadata.** Part of it originates in Indian pharmacy data
  written for a different market and regulatory context. Every record carries a
  disclaimer field saying so. It has had no clinical review.
- **Contradictions between sources are unreconciled.** A brand whose name carries a
  strength may map onto a canonical row with a different one — the corpus genuinely
  contains `Seclo 20` pointing at a 10 mg identity. `/resolve` surfaces this rather than
  papering over it, which is why `strength_applied` is in the response.
- **Confidence is lexical.** It is trigram and prefix arithmetic over a term index. It is
  not a judgement that a medicine is appropriate for any patient.

## Attribution

CC BY 4.0 requires attribution. Cite the corpus as:

> Akkhor Bangladesh medicine identity layer, release `akkhor-2026.08`, Team Medora,
> derived from five published datasets. See `/v1/akkhor/provenance` for source-level
> attribution and licences.

Source 5 (the academic backbone) carries its own DOI and must be cited when the identity
layer is used: `10.17632/zhtvkny53n.1`.

Full provenance, licence compatibility reasoning, and the `NOTICE` text that must travel
with any copy are in [`data/medicine_reference/`](../../data/medicine_reference/).

## Rebuilding the corpus

```bash
python data/medicine_reference/consolidate_datasets.py
```

Deterministic: the same five source directories produce the same
`Final_Medicine_Dataset.csv`.
