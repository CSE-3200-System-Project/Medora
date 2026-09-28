#!/usr/bin/env python3
"""Bind a real clinician export to the frozen sample; never manufactures verdicts."""
import argparse
import collections
import json
from pathlib import Path


def summarize(bundle,review):
    if review['corpus_sha256']!=bundle['corpus_sha256'] or review['profile']!=bundle['profile']:
        raise ValueError('Review is for a different corpus/profile')
    cases={c['record_id']:c for c in bundle['cases']};answers=review['answers']
    if not set(answers)<=set(cases):raise ValueError('Unselected case in review')
    for rid,a in answers.items():
        if a.get('record_id')!=rid or a.get('mapping_strength_form') not in ('acceptable','discrepancy','cannot_assess'):
            raise ValueError('Invalid review verdict')
        if a['mapping_strength_form']!='acceptable' and not a.get('notes','').strip():
            raise ValueError('Discrepancy/uncertainty must have a reason')
        if not a.get('reviewed_at'):raise ValueError('Missing review timestamp')
    return dict(corpus_sha256=bundle['corpus_sha256'],profile=bundle['profile'],selected_records=len(cases),
                reviewed_records=len(answers),missing_records=sorted(set(cases)-set(answers)),
                mapping_strength_form=dict(collections.Counter(a['mapping_strength_form'] for a in answers.values())),
                currentness=dict(collections.Counter(a.get('currentness_status','not_checked') for a in answers.values())),
                discrepancies=[{'record_id':rid,'notes':a['notes'],'reference_url':a.get('reference_url','')} for rid,a in answers.items() if a['mapping_strength_form']!='acceptable'],
                interpretation='Descriptive source/risk spot-check only. No whole-corpus correctness, currentness or regulator approval inference. Reviewer qualification/date/scope confirmation must be recorded separately.')


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('bundle',type=Path);parser.add_argument('review',type=Path);parser.add_argument('--output',required=True,type=Path)
    args=parser.parse_args();report=summarize(json.loads(args.bundle.read_text(encoding='utf-8')),json.loads(args.review.read_text(encoding='utf-8')))
    args.output.write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    print(f"Recorded {report['reviewed_records']}/{report['selected_records']} actual reviewer verdicts; no population estimate.")
