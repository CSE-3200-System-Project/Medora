#!/usr/bin/env python3
"""Record approved aggregate rebuild evidence and prepare private reviewer files."""
import argparse
import json
import shutil
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]


def record(directory,label):
    generated=ROOT/'docs/softwarex/generated'
    for name in ['build_manifest','quality_report','change_report']:
        # These contain hashes/counts/rules, not source-derived row text.
        value=json.loads((directory/(name+'.json')).read_text(encoding='utf-8'))
        (generated/f'medicine_v2_{label}_{name}.json').write_text(json.dumps(value,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    reviewer=directory/'reviewer';reviewer.mkdir(exist_ok=True)
    for name in ['doctor_review_bundle.json','doctor_review.csv','review_protocol.json']:
        shutil.copy2(directory/name,reviewer/name)
    shutil.copy2(ROOT/'tools/softwarex/medicine_review_app.html',reviewer/'OPEN_ME.html')


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--full',required=True,type=Path);parser.add_argument('--mendeley',required=True,type=Path)
    args=parser.parse_args();record(args.full,'full');record(args.mendeley,'mendeley')
    print('Recorded aggregate manifests; prepared local reviewer/OPEN_ME.html + bundle for both profiles. No row data copied into public docs.')
