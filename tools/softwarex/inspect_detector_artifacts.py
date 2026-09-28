#!/usr/bin/env python3
"""Inspect trusted-author artifact metadata without executing PyTorch pickle globals.

Tensor values are not loaded. Every non-whitelisted pickle global becomes inert.
This establishes metadata observations, not training history or numerical equivalence.
"""
import argparse
import collections
import hashlib
import io
import json
import pickle
import zipfile
from pathlib import Path


class Inert:
    def __new__(cls,*args,**kwargs):
        return object.__new__(cls)

    def __init__(self,*args,**kwargs):
        pass

    def __setstate__(self,state):
        if isinstance(state,dict):
            self.__dict__.update(state)
        elif isinstance(state,tuple):
            for item in state:
                if isinstance(item,dict):
                    self.__dict__.update(item)


class MetadataUnpickler(pickle.Unpickler):
    def find_class(self,module,name):
        if (module,name)==('collections','OrderedDict'):
            return collections.OrderedDict
        if module in ('builtins','__builtin__') and name=='set':
            return set
        return Inert

    def persistent_load(self,pid):
        return Inert()


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def inspect(pt,onnx):
    import onnxruntime as ort
    with zipfile.ZipFile(pt) as archive:
        names=[name for name in archive.namelist() if name.endswith('/data.pkl')]
        if len(names)!=1:
            raise ValueError('Expected one PyTorch metadata pickle')
        checkpoint=MetadataUnpickler(io.BytesIO(archive.read(names[0]))).load()
    model=checkpoint.get('model')
    session=ort.InferenceSession(str(onnx),providers=['CPUExecutionProvider'])
    return dict(method='Inert pickle metadata inspection + ONNX Runtime metadata; no pickle globals executed, no tensor equivalence asserted',
                pt=dict(sha256=sha(pt),date=checkpoint.get('date'),version=checkpoint.get('version'),licence=checkpoint.get('license'),
                        epoch=checkpoint.get('epoch'),train_args=checkpoint.get('train_args'),train_metrics=checkpoint.get('train_metrics'),
                        names=getattr(model,'names',None)),
                onnx=dict(sha256=sha(onnx),metadata=session.get_modelmeta().custom_metadata_map,
                          inputs=[dict(name=i.name,shape=i.shape,type=i.type) for i in session.get_inputs()],
                          outputs=[dict(name=i.name,shape=i.shape,type=i.type) for i in session.get_outputs()]))


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pt',required=True,type=Path);parser.add_argument('--onnx',required=True,type=Path);parser.add_argument('--output',required=True,type=Path)
    args=parser.parse_args();report=inspect(args.pt,args.onnx)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
    print(json.dumps({'pt_version':report['pt']['version'],'pt_date':report['pt']['date'],'pt_metrics':report['pt']['train_metrics'],
                      'onnx_version':report['onnx']['metadata'].get('version'),'onnx_date':report['onnx']['metadata'].get('date')},indent=2))
