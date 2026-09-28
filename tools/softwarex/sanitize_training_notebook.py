#!/usr/bin/env python3
"""Publish a code/markdown-only recipe; never copy embedded prescription images."""
import argparse
import hashlib
import json
import re
from pathlib import Path


def sanitize(document):
    cells=[]
    for original in document['cells']:
        source=''.join(original.get('source',[]))
        if 'data:image/' in source or 'attachment:' in source:
            source='[Embedded attachment excluded: prescription imagery remains private.]\n'
        # Fail closed if a literal secret is present; do not publish original text.
        if re.search(r'(?:api_key|password|access_token|secret)\s*=\s*[\"\'][^\"\']+[\"\']',source,re.I):
            raise ValueError('Literal credential in notebook source; sanitize this cell privately before publishing')
        cell=dict(cell_type=original['cell_type'],metadata={},source=source.splitlines(keepends=True))
        if cell['cell_type']=='code':cell.update(outputs=[],execution_count=None)
        cells.append(cell)
    cells.insert(0,dict(cell_type='markdown',metadata={},source=[
        '# Output-free author training recipe\n',
        'Derived from the corrected `train_yolo26s_object_detection_on_custom_dataset2.ipynb`. All outputs, execution counts, attachments and Colab metadata are removed. No prescription images or patient records are included.\n',
        'Historical recipe only: dataset-version linkage to the released checkpoint is author-reported, not proven by this notebook. Use private, authorized dataset access. Training reruns are not claimed byte-identical. Pin Ultralytics 8.4.21 to match the logged training environment before running the historical cells.\n',
        'See MODEL_CARD.md, AUTHOR_DISTRIBUTION_DECISION.md and ARTIFACT_MANIFEST.json for current artifact identity, licences and verification scope.\n']))
    return dict(cells=cells,metadata={'kernelspec':{'display_name':'Python 3','language':'python','name':'python3'},'language_info':{'name':'python'}},nbformat=4,nbformat_minor=5)


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('input',type=Path);parser.add_argument('output',type=Path)
    args=parser.parse_args();raw=args.input.read_bytes();doc=json.loads(raw);result=sanitize(doc)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'input_sha256':hashlib.sha256(raw).hexdigest(),'output_sha256':hashlib.sha256(args.output.read_bytes()).hexdigest(),
                      'removed_output_cells':sum(bool(c.get('outputs')) for c in doc['cells']),'remaining_outputs':0,'remaining_attachments':0}))
