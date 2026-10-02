#!/usr/bin/env python3
"""Prepare the approved detector + corresponding working application source locally.

Not a final immutable release or a public upload. Private images, raw notebooks,
medicine datasets, credentials and review correspondence are excluded.
"""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path
from zipfile import ZIP_DEFLATED,ZipFile

ROOT=Path(__file__).resolve().parents[2]
MODEL='ai_service/models/Yolo26s/'
INCLUDE=('backend/','frontend/','ai_service/','tools/','codeocean/')
SUFFIXES={'.py','.ts','.tsx','.js','.jsx','.cjs','.mjs','.css','.scss','.html','.sh','.json','.yaml','.yml','.toml','.ini','.txt','.sql','.mako','.md','.lock'}
ROOT_FILES={'LICENSE.txt','THIRD_PARTY_NOTICES.md','README.md','CITATION.cff','codemeta.json','docker-compose.yml','docker-compose.screenshots.yml','pyproject.toml','pytest.ini','pytest.backend.ini','pytest.ai.ini','run'}


def allowed(path):
    p=Path(path)
    if path.startswith(MODEL):
        return p.name in {'Yolo26s-prescription-5.pt','Yolo26s-prescription-5.onnx','training_recipe.sanitized.ipynb','MODEL_CARD.md','AUTHOR_DISTRIBUTION_DECISION.md','DISTRIBUTION.md','COPYING.AGPL-3.0'}
    if path.startswith('frontend/public/icons/') and p.name.startswith('icon-') and p.suffix=='.png':return True
    if path in ROOT_FILES:return True
    if not path.startswith(INCLUDE):return False
    if any(part in ('venv','node_modules','.next','__pycache__','workspace','dist') for part in p.parts):return False
    if p.name.startswith('.env') and p.name!='.env.example':return False
    return p.suffix in SUFFIXES or p.name in ('Dockerfile','.dockerignore','.env.example')


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--output',required=True,type=Path)
    parser.add_argument('--upstream-source-dir',type=Path)
    args=parser.parse_args()
    if args.output.exists():raise ValueError('Existing bundle will not be overwritten')
    required=[MODEL+n for n in ['Yolo26s-prescription-5.pt','Yolo26s-prescription-5.onnx','training_recipe.sanitized.ipynb','MODEL_CARD.md','AUTHOR_DISTRIBUTION_DECISION.md','DISTRIBUTION.md','COPYING.AGPL-3.0']]
    for p in required:
        if not (ROOT/p).is_file():raise ValueError('Missing model source/notice: '+p)
    notebook=json.loads((ROOT/MODEL/'training_recipe.sanitized.ipynb').read_text(encoding='utf-8'))
    assert all(not c.get('outputs') and not c.get('attachments') for c in notebook['cells'])
    paths=subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard'],cwd=ROOT,text=True).splitlines()
    contents={p:(ROOT/p).read_bytes() for p in sorted(set(paths)|set(required)) if allowed(p) and (ROOT/p).is_file()}
    for name in ['detector_metadata_inspection.json','detector_pair_verification.json']:
        p='docs/softwarex/generated/'+name;contents[p]=(ROOT/p).read_bytes()
    if args.upstream_source_dir:
        for version in ['8.4.21','8.4.19']:
            p=args.upstream_source_dir/f'ultralytics-v{version}.tar.gz'
            if not p.is_file():raise ValueError('Missing pinned upstream source archive: '+str(p))
            contents['upstream-source/'+p.name]=p.read_bytes()
    manifest=dict(status='working-source preparation, not final release',source_commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),
                  working_tree_changes_present=bool(subprocess.check_output(['git','status','--porcelain'],cwd=ROOT,text=True).strip()),
                  combined_distribution_licence='AGPL-3.0-only; retain third-party notices',
                  excluded=['private prescription images/exports','original image-bearing notebook','medicine records','credentials','review correspondence'],
                  files={p:dict(sha256=hashlib.sha256(b).hexdigest(),size_bytes=len(b)) for p,b in contents.items()})
    contents['ARTIFACT_MANIFEST.json']=(json.dumps(manifest,indent=2)+'\n').encode()
    contents['README_DISTRIBUTION.md']=b'# Prepared Medora + detector distribution\n\nDistribution licence: AGPL-3.0-only. Preserve third-party notices. Full corresponding working application source, sanitized training recipe and verification reports are included. No private prescription images or raw notebook outputs. This is not the final tagged release: bind one frozen source commit and repeat the final release checks before publication. See ai_service/models/Yolo26s/MODEL_CARD.md and DISTRIBUTION.md.\n'
    args.output.parent.mkdir(parents=True,exist_ok=True)
    with ZipFile(args.output,'x',compression=ZIP_DEFLATED,compresslevel=6) as archive:
        for p,b in contents.items():archive.writestr(p,b)
    print(json.dumps({'bundle':str(args.output),'sha256':hashlib.sha256(args.output.read_bytes()).hexdigest(),'files':len(contents),'private_images':0},indent=2))


if __name__=='__main__':main()
