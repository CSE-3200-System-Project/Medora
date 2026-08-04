# Prescription image data-use notice

The 105 prescription images in this directory are **identifiable research material**.
They retain patient and clinician names, registration numbers, clinic details, and dates.

## Provenance

The corpus is of **mixed provenance**. All 105 records were classified on 2026-08-04:

1. **Directly collected — 35 records** (`RX-0001..RX-0010`, `RX-0041..RX-0053`,
   `RX-0072..RX-0083`). Prescriptions belonging to the authors, their family members,
   and neighbours who agreed to their use for this study. Consent was obtained directly
   by the authors from the individuals concerned and was **verbal**, not written.
2. **Publicly released dataset — 70 records** (`RX-0011..RX-0040`, `RX-0054..RX-0071`,
   `RX-0084..RX-0105`). Obtained from the *Prescription Computer Vision Dataset* by
   Jannat, published on Roboflow Universe as `jannat-nmkds/prescription-3xf5s` v1
   (213 images) under **CC BY 4.0**, and reached this project through the derivative
   export `sarwad/prescription-oeiss-f5hvb` v1.

Per-record provenance is recorded in
`tests/benchmarks/datasets/ocr_corpus_manifest.json`, together with the classification
method. Records not individually classified carry `provenance_reviewed: false` and block
the corpus freeze, so the split between the two sources cannot be left unstated at
release.

**How the split was determined.** The Roboflow export pipeline resizes every image to
exactly 640×640 with white edge fill. The 70 records at that resolution were classified
as dataset-sourced; the remaining 35 carry native camera dimensions (4624×3468,
960×1280, 4000×3000). The two sets fall in contiguous ingestion-order blocks, which
corroborates the split independently of pixel size. The discriminator identifies images
that passed through a Roboflow export rather than their ultimate origin: an
author-collected photograph routed through the same workspace would be classified as
dataset-sourced. That is the conservative direction of error, because it declines to
assert patient consent for a record rather than assuming it.

## Attribution required for the dataset-sourced subset

CC BY 4.0 obliges attribution. Any use or redistribution of `RX-0011..RX-0040`,
`RX-0054..RX-0071`, or `RX-0084..RX-0105`, or of annotations derived from them, must
credit:

> *Prescription Computer Vision Dataset* by Jannat, Roboflow Universe,
> `jannat-nmkds/prescription-3xf5s` v1, licensed under CC BY 4.0.
> <https://universe.roboflow.com/jannat-nmkds/prescription-3xf5s>

A licence is a copyright permission, not a consent basis. CC BY 4.0 authorises
redistribution of these images; it carries no evidence that the depicted patients agreed
to any use. For that subset the authors are relying on an upstream publisher's licence
and have no direct relationship with the data subjects. This is a limitation of the
corpus and is stated as such in the manuscript.

## Approval basis

**No institutional review board or research ethics committee reviewed this collection.**
The work was carried out as an undergraduate software project, and the consent basis is
direct personal agreement, not an institutional approval reference. This is stated
plainly rather than phrased in a way that would imply formal oversight.

## Redistribution is an open decision

Consent given for use in a student project is **not** equivalent to informed consent for
permanent, worldwide, irrevocable publication of a person's medical prescription.
Redistribution scope is therefore not treated as settled by the consent already
obtained. Before any public deposit, one of the following must hold:

- explicit, documented consent from each depicted individual covering permanent public
  archiving; or
- the deposit is limited to de-identified Rx-region crops and derived annotations, with
  the full images withheld; or
- the images are placed under controlled access rather than open download.

For the publicly sourced subset, the originating dataset's licence governs
redistribution and must be recorded and honoured separately.

## Scope of permitted use

These images are **not** covered by Medora's MIT software license or by the open license
applied to release-reviewed annotations and aggregate benchmark results. Raw OCR or
provider responses, prelabels, crops, bounding boxes, and other derived artifacts that
reproduce or reveal identifiers are governed by this same notice.

Access does not grant permission to re-identify, contact, profile, discriminate against,
or otherwise harm a depicted or named person. Users must not combine the images with
other data for re-identification. Secondary use must remain within applicable law,
ethics requirements, and the scope of the underlying consent.

Report suspected misuse or accidental exposure through the support contact in
`CITATION.cff`. Public availability cannot guarantee downstream deletion after a
download; this limitation must be explained to data subjects and archive users.
