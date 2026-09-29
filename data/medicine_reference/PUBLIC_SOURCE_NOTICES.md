# Public medicine-reference inputs and changes

This `licensed-public` reconstruction uses only S4 and S5. It is an identity/search
reference, not a current DGDA register, prescribing guide or clinical validation.
The final CSV contains no prices, indication prose or prescription images. Its
`source_refs` values and the capsule's `row_provenance.jsonl` trace each output
row and field to a numbered input record. The historical deployed database was
not reseeded.

## S4 — publisher-declared MIT

*Drug Pharma New Dataset*, Shuvo Kumar Basak-4004.o, Kaggle version 1,
28 February 2025:
https://www.kaggle.com/datasets/shuvokumarbasak2030/drug-pharma-new-dataset.
The Kaggle publisher declares MIT. The exact local CSV SHA-256 is
`81e3257da9e3735fefbb39ee0c12dbb516826e9b6dc4866d0d14e567acbc4613`;
a fresh version-1 archive download matched these bytes. The archive supplied no
separate copyright or licence file, so no original copyright holder/year is
invented here. The uploader describes DGDA origin, which we have not verified
against an official export.

MIT permission and disclaimer as declared by the publisher:

> Permission is hereby granted, free of charge, to any person obtaining a copy
> of this software and associated documentation files (the "Software"), to deal
> in the Software without restriction, including without limitation the rights
> to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all
> copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
> FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
> AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
> OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
> SOFTWARE.

## S5 — CC BY 4.0

Md Mahmudur Rahman and Md M KHAN (2024), *Medicinal Products in Bangladesh: A
Dataset of Generic and Brand Names, Dosages, and Manufacturers*, Mendeley Data
version 1, DOI https://doi.org/10.17632/zhtvkny53n.1. Licence:
https://creativecommons.org/licenses/by/4.0/. Local CSV SHA-256:
`293036d5c24268c6526df4ae9ba59e3d80f40380b79bdf40859c83419b52a8fd`.
The authors do not endorse Medora or this reconstruction.

## Changes to the inputs

The builder normalizes whitespace, conservatively splits S4 trailing strengths,
keeps distinct strengths/forms/manufacturers, merges only exact normalized
identities while retaining contributors, quarantines ambiguous or conflicting
records, leaves missing fields unknown, and adds stable row IDs and attribution.
No pricing or inferred clinical-use fields are copied. See `change_report.json`,
`quality_report.json`, `build_manifest.json`, and the capsule's complete
provenance/quarantine files. S1/S2/S3 contributions were not used in this public
reconstruction. The project code's combined-distribution licence does not
erase these distinct third-party input licences.
