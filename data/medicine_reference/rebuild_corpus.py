#!/usr/bin/env python3
"""Versioned, deterministic medicine-reference rebuild. Never changes a database.

The eleven legacy seed columns are retained; attribution columns are appended.
The full-local profile is a controlled research artifact, NOT a rights clearance.
The mendeley-public profile contains only the attributed CC BY 4.0 source.
The licensed-public profile contains Kaggle S4 (MIT declaration) and
Mendeley S5 (CC BY 4.0); it makes no official-registry or clinical claim.
"""
from __future__ import annotations

import argparse
import collections
import csv
import hashlib
import json
import re
from pathlib import Path

VERSION = 'medicine-reference-v2'
DATA_FIELDS = ['drug_key','generic_name','strength','dosage_form','brand_name','manufacturer',
               'usage_type','country_code','common_uses','medicine_type','common_uses_disclaimer']
FIELDS = DATA_FIELDS + ['record_id','source_refs']
IDENTITY_FIELDS = ('generic_name','strength','dosage_form','brand_name','manufacturer')
SOURCES = {
    'S5': {'file': '5_Medicinal_Products_in_Bangladesh/Medicinal Products in Bangladesh A Dataset of Generic and Brand Names, Dosages, and Manufacturers.csv',
           'url': 'https://data.mendeley.com/datasets/zhtvkny53n/1', 'version': '1',
           'licence': 'CC BY 4.0', 'attribution': 'Md Mahmudur Rahman and Md M KHAN (2024), DOI 10.17632/zhtvkny53n.1'},
    'S1': {'file': '1_Assorted_Medicine_Dataset_of_Bangladesh/medicine.csv',
           'url': 'https://www.kaggle.com/datasets/ahmedshahriarsakib/assorted-medicine-dataset-of-bangladesh',
           'version': 'local bytes identified by SHA-256; historical download version/date unknown', 'licence': 'uploader-declared CC0; upstream MedEx permissions unresolved'},
    'S2': {'file': '2_All_medicine_data(20k)_Bangladesh/all_medicine_and_drug_price_data(20k)_Bangladesh.csv',
           'url': 'https://www.kaggle.com/datasets/toriqulstu/all-medicine-and-drug-price-data20k-bangladesh',
           'version': 'local bytes identified by SHA-256; historical download version/date unknown', 'licence': 'uploader-declared CC0; upstream collection permissions unresolved'},
    'S4': {'file': '4_Drug_Pharma_New_Dataset/Drug_Database_5_Data Concatenation.csv',
           'url': 'https://www.kaggle.com/datasets/shuvokumarbasak2030/drug-pharma-new-dataset',
           'version': 'Kaggle dataset version 1; archive CSV SHA-256 matched to local bytes; official DGDA export version unverified',
           'licence': 'Kaggle publisher-declared MIT; DGDA origin is uploader-reported, not independently authenticated',
           'attribution': 'Shuvo Kumar Basak, Drug Pharma New Dataset (Kaggle version 1)'},
    'S3': {'file': '3_Medicines_Dataset/medicines.csv',
           'url': 'https://www.kaggle.com/datasets/drowsyng/medicines-dataset',
           'version': 'local bytes identified by SHA-256; historical download version/date unknown',
           'licence': 'uploader-declared Apache-2.0; upstream Netmeds permissions unresolved',
           'excluded_reason': 'Indian-market disease/indication dataset is not used to infer Bangladesh identities or clinical indications'},
}
MAPS = {
    'S5': {'generic_name':'genericName','brand_name':'brandName','strength':'strength','dosage_form':'dosageType','manufacturer':'manufacturer'},
    'S1': {'generic_name':'generic','brand_name':'brand name','strength':'strength','dosage_form':'dosage form','manufacturer':'manufacturer','medicine_type':'type'},
    'S2': {'generic_name':'generic_name','brand_name':'medicine_name','strength':'strength','dosage_form':'category_name','manufacturer':'manufacturer_name'},
    'S4': {'brand_name':'Brand Name','dosage_form':'Dosages Description','manufacturer':'Name of the Manufacturer','medicine_type':'Type'},
}


def digest(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(1024*1024), b''):
            h.update(block)
    return h.hexdigest()


def clean(value):
    return re.sub(r'\s+', ' ', value or '').strip()


def drug_key(generic, strength, form):
    parts = [clean(v).casefold() for v in (generic, strength, form)]
    if any('||' in p for p in parts):
        raise ValueError('Reserved identity delimiter in source value')
    return '||'.join(parts)


def split_strength(value):
    """Only separate an unambiguous trailing single strength; never guess combinations."""
    value = clean(value)
    if '+' in value:
        return None
    match = re.fullmatch(r'(.+?)\s+(\d+(?:\.\d+)?\s*(?:mg|mcg|ug|g|gm|ml|iu|units?|%)(?:\s*/\s*(?:\d+(?:\.\d+)?\s*)?(?:ml|g|gm))?)', value, re.I)
    if not match or re.search(r'\d\s*(?:mg|mcg|ml|iu|%)\b', match[1], re.I):
        return None
    return match[1], match[2]


def json_write(path, value):
    Path(path).write_text(json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True)+'\n', encoding='utf-8')


def csv_write(path, fields, rows):
    with Path(path).open('w', newline='', encoding='utf-8') as stream:
        writer = csv.DictWriter(stream, fieldnames=fields, lineterminator='\n', extrasaction='ignore')
        writer.writeheader()
        writer.writerows(rows)


def transformed(raw, sid, number):
    ref = f'{sid}:{number}'
    values, evidence, flags = {}, {}, []
    for field, original in MAPS[sid].items():
        text = raw[original]
        if text is None:
            raise ValueError(f'{ref}: malformed CSV field {original}')
        value = clean(text)
        changes = ['collapse_whitespace'] if text != value else []
        if field == 'medicine_type':
            types = {'allopathic':'Allopathic','herbal':'Herbal','unani':'Unani','homeopathic':'Homeopathic','ayurvedic':'Ayurvedic'}
            normalized = types.get(value.casefold(), value)
            if normalized != value:
                changes.append('standardize_medicine_type_case')
            value = normalized
        values[field] = value
        evidence[field] = dict(source_ref=ref, source_field=original, original_value=text, changes=changes)
    if sid == 'S4':
        original = raw['Generic Name and Strength']
        parsed = split_strength(original)
        if parsed:
            values['generic_name'], values['strength'] = parsed
            for field in ('generic_name','strength'):
                evidence[field] = dict(source_ref=ref, source_field='Generic Name and Strength', original_value=original, changes=['conservative_trailing_strength_split'])
        else:
            # No invented identity/strength or non-allopathic substitute. Review separately.
            return None, None, ['ambiguous_or_missing_generic_strength']
    for field, value, rule in [('usage_type','common_reference','reference_search_only'),
                              ('country_code','BD','source_market_context_not_regulatory_verification'),
                              ('common_uses','','omit_unvalidated_or_generated_indications'),
                              ('common_uses_disclaimer','','no_indications_emitted')]:
        values[field] = value
        evidence[field] = dict(source_ref=None, source_field=None, original_value=None, changes=[rule])
    if 'medicine_type' not in values:
        values['medicine_type'] = ''
        evidence['medicine_type'] = dict(source_ref=None, source_field=None, original_value=None, changes=['not_supplied_do_not_infer_medicine_type'])
    if not values.get('brand_name') or not values.get('generic_name'):
        return None, None, ['missing_required_identity']
    for field in ('strength','dosage_form','manufacturer'):
        if not values[field]:
            flags.append('missing_'+field)
    if re.search(r'\d\s*(?:mg|mcg|ml|iu|%)\b', values['generic_name'], re.I):
        flags.append('possible_strength_embedded_in_generic')
    try:
        values['drug_key'] = drug_key(values['generic_name'],values['strength'],values['dosage_form'])
    except ValueError:
        return None, None, ['reserved_identity_delimiter']
    evidence['drug_key'] = dict(source_ref=ref, source_field=['generic_name','strength','dosage_form'], original_value=None, changes=['whitespace_clean_casefold_join_preserve_strength_form'])
    return values, evidence, flags


def counts(rows):
    drugs = {r['drug_key'] for r in rows}
    brands = {(r['drug_key'],r['brand_name'],r['manufacturer']) for r in rows}
    return dict(rows=len(rows), drugs=len(drugs), brands=len(brands), search_terms=len(drugs)+len(brands),
                generic_names=len({r['generic_name'].casefold() for r in rows}),
                brand_names=len({r['brand_name'].casefold() for r in rows}))


def build(source_root, output, profile, previous=None):
    profiles = {'full-local':['S5','S1','S2','S4','S3'],
                'mendeley-public':['S5'], 'licensed-public':['S5','S4']}
    if profile not in profiles:
        raise ValueError(f'Unknown profile: {profile}')
    source_root, output = Path(source_root).resolve(), Path(output).resolve()
    if output == source_root or output in source_root.parents or output.is_relative_to(source_root):
        raise ValueError('Output must be outside the raw source tree')
    if output.exists() and any(output.iterdir()):
        raise ValueError('Choose an empty output directory; existing evidence is never overwritten')
    output.mkdir(parents=True, exist_ok=True)
    selected = profiles[profile]
    source_manifest, registry, rejected, disposition = {}, {}, [], collections.Counter()
    for sid in selected:
        definition = SOURCES[sid]
        path = source_root / definition['file']
        source_manifest[sid] = {**definition, 'sha256':digest(path), 'size_bytes':path.stat().st_size,
                                'retrieval_date':None, 'locally_recorded_on':'2026-09-28'}
        with path.open(encoding='utf-8-sig', newline='') as stream:
            reader = csv.DictReader(stream, strict=True)
            if sid in MAPS:
                required = set(MAPS[sid].values()) | ({'Generic Name and Strength'} if sid == 'S4' else set())
                if not required.issubset(reader.fieldnames):
                    raise ValueError(f'{sid}: missing columns {required-set(reader.fieldnames)}')
            number = 0
            for number, raw in enumerate(reader, 1):
                if None in raw or any(v is None for v in raw.values()):
                    raise ValueError(f'{sid}:{number}: malformed CSV, not silently skipped')
                if sid == 'S3':
                    disposition[sid+':excluded_market_and_indications'] += 1
                    continue
                row, fields, flags = transformed(raw, sid, number)
                ref = f'{sid}:{number}'
                if row is None:
                    rejected.append(dict(source_ref=ref,reason=';'.join(flags),raw_record=raw))
                    disposition[sid+':quarantined'] += 1
                    continue
                key = tuple(clean(row[f]).casefold() for f in IDENTITY_FIELDS)
                contributor = dict(source_ref=ref, fields=fields, registration_identifier=raw.get('DAR') or None)
                if key not in registry:
                    # Keep contributor evidence immutable when selected-field attribution
                    # is later filled from a different explicit source (e.g. medicine type).
                    registry[key] = dict(row=dict(row),fields=dict(fields),contributors=[],flags=set())
                    disposition[sid+':new_identity'] += 1
                else:
                    disposition[sid+':duplicate_contribution'] += 1
                    existing = registry[key]
                    if not existing['row']['medicine_type'] and row['medicine_type']:
                        existing['row']['medicine_type'] = row['medicine_type']
                        existing['fields']['medicine_type'] = fields['medicine_type']
                    elif row['medicine_type'] and existing['row']['medicine_type'] != row['medicine_type']:
                        existing['flags'].add('conflicting_medicine_type')
                registry[key]['contributors'].append(contributor)
                registry[key]['flags'].update(flags)
            source_manifest[sid]['records'] = number
    provenance, rows = [], []
    brand_mappings = collections.defaultdict(set)
    for entry in registry.values():
        row = entry['row']
        brand_mappings[(row['brand_name'].casefold(),row['manufacturer'].casefold())].add(row['generic_name'].casefold())
    for key, entry in sorted(registry.items()):
        row = entry['row']
        rid = hashlib.sha256(json.dumps(key,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()
        if len(brand_mappings[(row['brand_name'].casefold(),row['manufacturer'].casefold())]) > 1 or 'conflicting_medicine_type' in entry['flags']:
            reason = 'conflicting_medicine_type' if 'conflicting_medicine_type' in entry['flags'] else 'brand_manufacturer_multiple_generic_names'
            rejected.append(dict(record_id=rid,reason=reason,
                                 row=row,contributors=entry['contributors']))
            disposition['merged:conflicting_mapping_quarantined'] += 1
            continue
        row = {**row,'record_id':rid,'source_refs':';'.join(c['source_ref'] for c in entry['contributors'])}
        rows.append(row)
        provenance.append(dict(record_id=rid,output_record_number=len(rows),fields=entry['fields'],
                               contributors=entry['contributors'],flags=sorted(entry['flags'])))
    csv_write(output/'Final_Medicine_Dataset.csv',FIELDS,rows)
    with (output/'row_provenance.jsonl').open('w',encoding='utf-8',newline='\n') as stream:
        for p in provenance:
            stream.write(json.dumps(p,ensure_ascii=False,sort_keys=True,separators=(',',':'))+'\n')
    with (output/'quarantine.jsonl').open('w',encoding='utf-8',newline='\n') as stream:
        for r in rejected:
            stream.write(json.dumps(r,ensure_ascii=False,sort_keys=True)+'\n')
    quality = dict(counts=counts(rows),flags=dict(collections.Counter(flag for p in provenance for flag in p['flags'])),
                   input_disposition=dict(sorted(disposition.items())),
                   duplicate_identity_rows=0,provenance_coverage=len(provenance),
                   indications_emitted=0,clinical_validation=False,regulator_concordance=False,
                   currency='Not established from historical snapshots; absence of an exact current official match is not proof of obsolescence',
                   human_review='Limited physician source review documented separately; not row-by-row validation. Machine flags are not clinical decisions')
    json_write(output/'quality_report.json',quality)
    changes = dict(version=VERSION,profile=profile,
                   rules=['preserve substance/bracket text and manufacturer suffixes',
                          'whitespace normalization only; casefold only for matching keys',
                          'do not collapse distinct strengths, forms or manufacturers',
                          'merge exact normalized identities only; preserve all contributor records',
                          'medicine_type is blank when absent; fill only from an explicit agreeing contributor; quarantine conflicting types',
                          'prefer earlier selected sources for duplicate display values: '+', '.join(selected),
                          'quarantine S4 combinations/unparseable generic-strength strings',
                          'quarantine every contradictory brand/manufacturer-to-generic mapping, rather than choose a winner',
                          'omit all inferred/generative/common-use descriptions and S3 Indian indications',
                          'append stable record_id/source_refs; legacy seed columns preserved',
                          'no price emission, clinical safety inference, or automatic database reseeding'])
    if previous:
        with Path(previous).open(encoding='utf-8-sig',newline='') as stream:
            old = list(csv.DictReader(stream))
        old_keys = {tuple(clean(r.get(f,'')).casefold() for f in IDENTITY_FIELDS) for r in old}
        new_keys = {tuple(clean(r.get(f,'')).casefold() for f in IDENTITY_FIELDS) for r in rows}
        changes['previous'] = dict(sha256=digest(previous),counts=counts(old),
                                   exact_normalized_identities_retained=len(old_keys & new_keys),
                                   identities_only_in_previous=len(old_keys-new_keys),identities_only_in_rebuild=len(new_keys-old_keys),
                                   warning='Set differences are changes, not independently established errors/corrections')
        csv_write(output/'identity_changes.csv',['change','identity_json'],
                  (dict(change=kind,identity_json=json.dumps(k,ensure_ascii=False)) for kind,keys in [('only_in_previous',old_keys-new_keys),('only_in_rebuild',new_keys-old_keys)] for k in sorted(keys)))
    json_write(output/'change_report.json',changes)
    manifest = dict(version=VERSION,profile=profile,schema=FIELDS,source_record_number='one-based CSV data record, excluding header; not physical line number',
                    builder_sha256=digest(__file__),sources=source_manifest,counts=quality['counts'],
                    distribution=('S4 publisher-declared MIT and S5 CC BY 4.0; retain source-specific attribution and notices'
                                  if profile=='licensed-public' else
                                  'CC BY 4.0 with source attribution' if profile=='mendeley-public' else
                                  'controlled local use; source redistribution decisions unresolved'),
                    outputs={name:dict(sha256=digest(output/name),size_bytes=(output/name).stat().st_size) for name in ['Final_Medicine_Dataset.csv','row_provenance.jsonl','quarantine.jsonl','quality_report.json','change_report.json']})
    json_write(output/'build_manifest.json',manifest)
    prepare_review(output, rows, provenance, manifest)
    return manifest


def prepare_review(output, rows, provenance, manifest):
    """30-case descriptive spot-check, not a population correctness estimate."""
    keyed = {r['record_id']:(r,p) for r,p in zip(rows,provenance)}
    selected = []
    # Five risk cases, then balanced source samples; deterministic hash ordering.
    risky = sorted((rid for rid,(r,p) in keyed.items() if p['flags']),key=lambda rid:hashlib.sha256(('risk:'+rid).encode()).hexdigest())
    selected.extend(risky[:5])
    groups = {sid: sorted([rid for rid,(r,p) in keyed.items() if any(c['source_ref'].startswith(sid+':') for c in p['contributors'])],
                           key=lambda rid:hashlib.sha256(('review-v2:'+sid+':'+rid).encode()).hexdigest()) for sid in MAPS}
    while len(selected) < min(30,len(rows)):
        progress = False
        for sid in groups:
            remaining = [rid for rid in groups[sid] if rid not in selected]
            if remaining and len(selected)<30:
                selected.append(remaining[0]); progress=True
        if not progress:
            break
    review = []
    for rid in selected:
        row,p = keyed[rid]
        review.append({**{f:row[f] for f in ['record_id','generic_name','brand_name','strength','dosage_form','manufacturer','medicine_type','source_refs']},
                       'selection':'risk_flag' if rid in risky[:5] else 'source_balanced_hash_sample',
                       'flags':';'.join(p['flags']), 'source_evidence':json.dumps(p['contributors'],ensure_ascii=False),
                       'mapping_strength_form':'','manufacturer_identity':'','current_authoritative_reference_url':'',
                       'currentness_status':'','correction':'','reviewer_notes':''})
    fields = ['record_id','generic_name','brand_name','strength','dosage_form','manufacturer','medicine_type','source_refs','selection','flags','source_evidence','mapping_strength_form','manufacturer_identity','current_authoritative_reference_url','currentness_status','correction','reviewer_notes']
    csv_write(output/'doctor_review.csv',fields,review)
    json_write(output/'doctor_review_bundle.json',dict(corpus_sha256=manifest['outputs']['Final_Medicine_Dataset.csv']['sha256'],
                                                     profile=manifest['profile'],version=VERSION,cases=review))
    json_write(output/'review_protocol.json',dict(corpus_sha256=manifest['outputs']['Final_Medicine_Dataset.csv']['sha256'],sample_records=len(review),
                selection='Five flagged cases (where present), followed by deterministic source-balanced hash selection; no outcomes known at selection',
                purpose='Descriptive mapping/strength/form spot-check and clinical plausibility; not row-by-row approval, completeness or population accuracy validation',
                human_fields=['mapping_strength_form: acceptable / discrepancy / cannot_assess','manufacturer_identity: match / discrepancy / cannot_assess',
                              'currentness_status: current_reference_match / contradictory_reference / not_found / not_checked'],
                author_role='Prepopulate current official product/manufacturer links and reference observations; do not prepopulate clinical verdicts',
                doctor_role='Check medicine identity, generic-brand mapping, strength/form for each selected row against the provided evidence; flag uncertainty, not guess',
                conclusion='Report reviewed N, discrepancies, unresolved cases and source/field scope. No confidence interval or population correctness claim from this risk-enriched sample.',
                suggested_time='30 cases at 1–2 minutes each plus 10 minutes for scope/results note: approximately 40–70 minutes; unresolved cases may take longer'))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-root',required=True,type=Path)
    parser.add_argument('--output',required=True,type=Path)
    parser.add_argument('--profile',choices=['full-local','mendeley-public','licensed-public'],default='full-local')
    parser.add_argument('--previous',type=Path)
    args = parser.parse_args()
    manifest = build(args.source_root,args.output,args.profile,args.previous)
    print(json.dumps({'version':manifest['version'],'profile':manifest['profile'],'counts':manifest['counts'],'corpus_sha256':manifest['outputs']['Final_Medicine_Dataset.csv']['sha256']},indent=2))


if __name__ == '__main__':
    main()
