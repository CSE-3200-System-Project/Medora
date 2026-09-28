#!/usr/bin/env python3
"""Verify corpus, manifest, all row/source links and seed projection without a DB."""
import argparse
import csv
import hashlib
import importlib.util
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('medicine_builder',ROOT/'data/medicine_reference/rebuild_corpus.py')
builder=importlib.util.module_from_spec(spec);spec.loader.exec_module(builder)


def verify(directory,source_root):
    manifest=json.loads((directory/'build_manifest.json').read_text(encoding='utf-8'))
    if manifest['builder_sha256']!=builder.digest(builder.__file__):raise ValueError('Builder changed after this build')
    for name,info in manifest['outputs'].items():
        if builder.digest(directory/name)!=info['sha256']:raise ValueError('Output hash mismatch: '+name)
    raw={}
    for sid,info in manifest['sources'].items():
        path=source_root/info['file']
        if builder.digest(path)!=info['sha256']:raise ValueError('Source hash mismatch: '+sid)
        if sid=='S3':continue
        with path.open(encoding='utf-8-sig',newline='') as stream:
            for number,row in enumerate(csv.DictReader(stream,strict=True),1):raw[f'{sid}:{number}']=row
    with (directory/'Final_Medicine_Dataset.csv').open(encoding='utf-8',newline='') as stream:
        reader=csv.DictReader(stream);assert reader.fieldnames==builder.FIELDS;rows=list(reader)
    seen=set();links=0
    with (directory/'row_provenance.jsonl').open(encoding='utf-8') as stream:
        for index,line in enumerate(stream):
            p=json.loads(line);row=rows[index]
            assert p['record_id']==row['record_id'] and p['output_record_number']==index+1
            assert row['record_id'] not in seen;seen.add(row['record_id'])
            assert row['drug_key']==builder.drug_key(row['generic_name'],row['strength'],row['dosage_form'])
            assert set(p['fields'])==set(builder.DATA_FIELDS)
            assert row['source_refs']==';'.join(c['source_ref'] for c in p['contributors'])
            for c in p['contributors']:
                original=raw[c['source_ref']];links+=1
                for field in c['fields'].values():
                    if field['source_ref'] and isinstance(field['source_field'],str):
                        assert original[field['source_field']]==field['original_value']
            for field in p['fields'].values():
                if field['source_ref'] and isinstance(field['source_field'],str):
                    assert raw[field['source_ref']][field['source_field']]==field['original_value']
            assert not row['common_uses'] and not row['common_uses_disclaimer']
    assert len(seen)==len(rows)
    assert builder.counts(rows)==manifest['counts']
    report=dict(status='pass',profile=manifest['profile'],corpus_sha256=manifest['outputs']['Final_Medicine_Dataset.csv']['sha256'],
                rows_verified=len(rows),source_contributor_links_verified=links,projected_seed_counts=builder.counts(rows),
                scope='Structural/provenance checks only; no database writes, clinical correctness, completeness or currentness attestation')
    return report


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('directory',type=Path)
    parser.add_argument('--source-root',required=True,type=Path);parser.add_argument('--output',type=Path)
    args=parser.parse_args();report=verify(args.directory,args.source_root)
    if args.output:builder.json_write(args.output,report)
    print(json.dumps(report,indent=2))
