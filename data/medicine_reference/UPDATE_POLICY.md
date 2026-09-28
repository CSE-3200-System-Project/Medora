# Medicine-reference version and update policy

The bundled medicine reference is a versioned research artifact, not a live regulatory
register. It must not be silently refreshed in an application deployment.

## Release rule

Each published Medora release fixes one CSV output, its build script, the source-role
description in PROVENANCE.md, and a SHA-256 value in the release checksum artifact. A change
to any of these requires a new corpus version and a new software release record.

## Required review before accepting an update

1. Preserve the downloaded source files, retrieval date, source URL, licence record, and
   input SHA-256 values.
2. Run the deterministic consolidation script and publish a row-count and output-hash diff.
3. Record additions, removals, changed generic/strength/form identities, changed
   brand/manufacturer mappings, and duplicate/conflict candidates.
4. The v2 build excludes source 3 indication text and does not infer common uses. Preserve
   this exclusion unless an explicitly reviewed, justified change is accepted.
5. Obtain an authoritative or qualified pharmacological review before claiming DGDA
   alignment, currentness, clinical correctness, or conflict resolution.

## What this policy does not establish

The historical CSV is not asserted reproducible by the old mismatched builder. The new
v2 build has structural/provenance verification but not the authoritative content review
in step 5. Accordingly, the v2 candidate is a traceable consolidation for search, not a validated
drug dictionary, prescribing reference, interaction checker, or regulatory register.
