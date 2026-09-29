# SoftwareX medicine-reference reconstruction

The final selected public profile is **licensed-public: S4 Kaggle version 1
(publisher-declared MIT) plus S5 Mendeley version 1 (CC BY 4.0)**. See
`PUBLIC_CORPUS_RELEASE_BASIS.md` and
`data/medicine_reference/PUBLIC_SOURCE_NOTICES.md` for source/version links,
rights evidence, limitations and change attribution. No permission email is a
release dependency for these selected publisher-licensed inputs. S1/S2/S3
contributions are excluded by rebuilding from raw S4/S5 inputs only.

| Snapshot | CSV rows | Projected drugs | Projected brands | Search terms |
| --- | ---: | ---: | ---: | ---: |
| Historical deployed application | 71,795 | 7,389 | 67,001 | 74,390 |
| Selected S4/S5 public reconstruction | 44,226 | 4,994 | 44,226 | 49,220 |
| Earlier controlled four-source candidate (not public) | 46,614 | 6,153 | 46,614 | 52,767 |

The public CSV SHA-256 is
`9dcf59f339679f3b0f7256e3cfd76ffc0839601511fbc16255c4c3d54ee9cf66`.
There are 45,135 row-contributor links. The public build directory is
`dist/softwarex-medicine-v2-licensed-public-portable/`; its five core outputs,
raw-input hashes, manifest, quality and change report are packaged by the
selected Code Ocean profile and replayed during its run. The tracked public
CSV/manifest/notice are under `data/medicine_reference/`. The earlier
multi-source candidate stays a controlled local artifact, not the release.

Rebuild and verify without touching the shared database:

```powershell
python data/medicine_reference/rebuild_corpus.py --source-root F:/CODE/System-Project/Medora-Datasets/Medicine --output <new-empty-directory> --profile licensed-public
python tools/softwarex/verify_medicine_build.py <new-empty-directory> --source-root F:/CODE/System-Project/Medora-Datasets/Medicine
```

The deterministic rules retain strengths/forms/manufacturers, normalize
whitespace, merge only matching identities, quarantine ambiguous or
contradictory records, and keep unknown fields unknown. No indication prose or
prices are emitted. Machine verification checks hashes, all row/field links,
counts and projection; it does **not** establish medicine accuracy, current
registration, clinical validity or national completeness. The old historical
CSV's missing lineage is not retroactively reconstructed.

A qualified physician reviewed four candidate source descriptions and
approximately 100 targeted entries on 29 September 2026, with most checked
mappings appearing reasonable and some duplicate/missing-strength concerns.
The limited public note is in
`docs/softwarex/author-evidence/COMPLETED_REVIEW_SUMMARIES.md`. It is not an
itemized population audit. The optional 30-case review packet remains a local
descriptive tool, not a mandatory additional SoftwareX gate for these limited
claims. No doctor is asked to approve thousands of rows.

The live/shared Supabase reference tables still hold historical data; this
public reconstruction has **not** been destructively seeded into them. Any
future deployment migration must preserve existing medication references and
is outside this SoftwareX revision task.
