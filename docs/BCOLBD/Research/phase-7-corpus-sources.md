# Phase 7 corpus source and licence note

Accessed: 2026-08-25

## Recommendation

Build the administrative-location pool as two versioned layers:

- `bd_admin_2022`: the registered, reproducible BBS census baseline of 8 divisions,
  64 districts, and 495 upazilas.
- `bd_admin_2026_extension`: the eight upazilas gazetted in May and July 2026.

The combined current gazetted coverage is therefore 503 upazilas. Do not silently replace the
registered 495-unit baseline: retain it and report the eight-unit extension separately. BBS has
not yet published one current national workbook assigning its geocodes to every 2026 addition.

For person names, do not scrape voter lists, staff directories, social networks, news bylines,
patient records, or other lists of real people. Generate fictional full-name combinations from a
small, manually reviewed vocabulary of commonplace Bangla name components. A plausible synthetic
name can coincidentally match a real person, so describe the records as fictional combinations,
not as guaranteed non-existent people.

## Administrative geography

### Primary sources

| Source | What it establishes | Reuse and version caveat |
|---|---|---|
| [BBS Population and Housing Census 2022 reports](https://bbs.gov.bd/pages/static-pages/6922e073933eb65569e27220) | BBS provides Community Reports for all 64 districts. Their geo-code tables identify the census-era Upazila/Thana hierarchy and codes. | Best source for the frozen 2022 baseline, but distributed as district-level PDF/Excel files rather than one clean national dataset. |
| [BBS NSDS example: Dhaka Community Report](https://nsds.bbs.gov.bd/storage/files/1/Publications/PHC_2021%20Community%20Report/DHAKA%20DIVISION/Community%20Report%20Dhaka.pdf) | Demonstrates that the Community Reports contain district and upazila geo-code tables. | Cite the individual report and preserve its hash; do not infer that a later portal spelling has the same 2022 code without checking. |
| [DGHS Shared Health Record location-registry documentation](https://en.info.shr.dghs.gov.bd/technical-support/location-registry/) | DGHS documents the BBS hierarchical code shape and links a BBS upazila workbook. | The attached workbook is an older snapshot. It is useful for code structure, not proof of current coverage. |
| [Bangladesh National Portal upazila list](https://bangladesh.gov.bd/views/upazila-list) | Current government-site links and current Bangla labels grouped under the 64 districts. | It is an HTML portal index, not a controlled BBS download. On the access date it rendered 499 entries and explicitly said the list represents websites in the portal framework. |
| [Bangladesh Government Press, May 2026 gazettes](https://www.dpp.gov.bd/bgpress/index.php/document/extraordinary_gazettes_monthly/2026-05-18) | Official notices create Matamuhuri, Mokamtala, Ruhia, Bhulli, and Chandraganj upazilas. | These five increase the 495 baseline to 500. Use gazette spellings as the authority until BBS issues codes. |
| [Bangladesh Government Press, July 2026 gazettes](https://dpp.gov.bd/bgpress/index.php/document/extraordinary_gazettes_monthly/2026-07-01) | Official notices create Fatikchhari North, Bangra, and South Gafargaon upazilas. | These three increase the gazetted total to 503. Their geo-code status still needs confirmation from BBS. |

### Why official counts disagree

- Older agency material can say 492 because it predates the 2021 creation of Dasar, Eidgaon,
  and Madhyanagar.
- The stable 2022–2025 baseline is 495.
- Five May 2026 gazettes make 500; three July 2026 gazettes make 503.
- The National Portal displayed 499 on 2026-08-25. Its list had four of the May additions,
  omitted Matamuhuri and the three July additions, and is therefore a partially updated portal
  state rather than a reliable national total.

This discrepancy is why every generated manifest should record `source_vintage`, retrieval date,
source URL, source-file SHA-256, and whether an entry has a BBS code or only a gazette reference.

### Reuse caveat

The [National Portal terms](https://bangladesh.gov.bd/pages/static-pages/69a55ba386514399668e4e70)
expressly allow printing displayed information without modification, but do not clearly grant a
database or ML-training redistribution licence. The [Bangladesh Open Data FAQ](https://data.gov.bd/bn/faqs)
says datasets on that portal generally use an Open Government Licence and may allow commercial use,
while also requiring users to check the licence of each dataset. The geography pages above are not
clearly identified as licensed `data.gov.bd` dataset records.

Facts such as administrative names and codes can be transcribed with source attribution, but before
publishing or commercially redistributing the complete derived corpus, obtain written reuse
confirmation from BBS/a2i or legal counsel. Do not redistribute the source PDFs or portal HTML as
part of the training bundle.

## Privacy-safe synthetic Bangladeshi names

There is no need to acquire a database of real people's names. Use deterministic composition:

1. Manually review a compact set of commonplace given-name and family-name components in Bangla.
   Include multiple religious, regional, gender, and ethnic naming traditions without assigning a
   sensitive identity label to any individual synthetic row.
2. Author the Bangla form, a conservative Latin transliteration, and one observed spelling pattern
   as separate fields. The spelling pattern should be a transformation rule, not copied from a
   named person's profile.
3. Combine components with a fixed random seed to produce at least 500 unique full-name forms.
   Keep train/dev/test component pools disjoint where possible, and exclude every identifier in the
   held-out benchmark before generation.
4. Generate phones, NIDs, emails, record numbers, and addresses independently. Never join a
   synthetic name to a real person's other attributes.
5. Store provenance such as `generation_method`, generator commit, seed, and component-pool hash.
   Do not add a visible "synthetic" marker inside training sentences because the model could learn
   that shortcut.
6. Have at least two Bangla-speaking reviewers check plausibility, spelling, accidental insults,
   demographic balance, and suspicious matches to public figures. This is a quality review, not a
   claim that ordinary names belong to those reviewers or sources.

Bangladesh's official law database defines personal data to include a person's name when it relates
to an identifiable person ([Bangladesh Laws, Act 1573](https://bdlaws.minlaw.gov.bd/act-print-1573.html)).
That supports avoiding person-linked source records even when a list is publicly visible. WIPO also
explains that copyright protects original expression rather than underlying ideas or facts
([WIPO copyright overview](https://www.wipo.int/en/web/copyright/protection)); this does not remove
privacy, database-right, contract, trademark, or local-law obligations.

## Model licences and intended role

| Model | First-party evidence | Phase 7 treatment |
|---|---|---|
| `google/muril-base-cased` | The [Google-published model card](https://huggingface.co/google/muril-base-cased/blob/main/README.md) declares Apache-2.0 and says MuRIL was pretrained on 17 Indian languages and their transliterated counterparts. | Deployable candidate, subject to keeping the licence/NOTICE materials and completing normal product legal review. The transliterated pretraining makes it relevant to Banglish, but does not establish clinical safety. |
| `FacebookAI/xlm-roberta-base` | The [model-card metadata](https://huggingface.co/FacebookAI/xlm-roberta-base/blob/main/README.md) declares MIT; the [official fairseq repository](https://github.com/facebookresearch/fairseq) says its MIT licence applies to pretrained models. | Deployable multilingual control, subject to retaining the MIT notice and normal legal review. The Hugging Face card says it was written by Hugging Face rather than the original research team, so retain the fairseq licence evidence too. |
| `csebuetnlp/banglabert` | The [official BUET CSE NLP repository](https://github.com/csebuetnlp/banglabert#license) restricts the repository contents to non-commercial research under CC BY-NC-SA 4.0. | Research comparator only. Do not export or deploy it in a commercial Medora release without separate written permission. |

Pin each downloaded model to a commit revision and archive its model card and licence alongside the
training run. A licence label is permission metadata, not evidence of accuracy, fairness, privacy,
or suitability for clinical deployment.

## Corpus acceptance checklist

- The manifest reports both `bd_admin_2022=495` and `bd_admin_2026_extension=8` rather than a
  context-free claim of "all 495 current upazilas."
- All 8 divisions, 64 districts, 495 baseline upazilas, and 8 gazetted extensions are present.
- At least 500 unique synthetic full-name forms are produced without copying person-linked rows.
- Bangla, English, and romanised frames are separately countable.
- No training/dev row contains an exact held-out identifier.
- Source URLs, retrieval dates, versions, hashes, generator commit, and seed are in the manifest.
- A Bangla-language review and a licence/privacy review are signed off before uploading the corpus
  or weights to Colab or another third party.
