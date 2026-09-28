#!/usr/bin/env python3
"""Prospective PT/ONNX prediction comparison on non-patient synthetic inputs.

This tests conversion/runtime agreement, NOT accuracy on prescriptions, training
lineage or medical performance. Exact original files remain unchanged.
"""
import argparse
import hashlib
import json
import platform
from pathlib import Path


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pt',required=True,type=Path);parser.add_argument('--onnx',required=True,type=Path)
    parser.add_argument('--output',required=True,type=Path)
    args=parser.parse_args()
    import numpy as np
    import onnx
    import onnxruntime as ort
    import torch
    import ultralytics
    from ultralytics import YOLO
    torch.set_num_threads(2)
    # Author-provided checkpoint, hash recorded before framework load.
    pt_sha,onnx_sha=sha(args.pt),sha(args.onnx)
    model=YOLO(str(args.pt)).model.float().cpu().eval()
    model.fuse(verbose=False)
    head=model.model[-1]
    head.export=True;head.format='onnx';head.dynamic=False;head.max_det=300
    session=ort.InferenceSession(str(args.onnx),providers=['CPUExecutionProvider'])
    state=model.state_dict()
    comparisons=[]
    for tensor in onnx.load(str(args.onnx)).graph.initializer:
        if tensor.name not in state:
            continue
        a=state[tensor.name].detach().cpu().numpy();b=onnx.numpy_helper.to_array(tensor)
        comparisons.append(dict(name=tensor.name,shape_match=a.shape==b.shape,
                                allclose=bool(a.shape==b.shape and np.allclose(a,b,rtol=1e-5,atol=1e-6)),
                                max_abs_difference=float(np.max(np.abs(a-b))) if a.shape==b.shape else None))
    rng=np.random.default_rng(26)
    inputs={'zero':np.zeros((1,3,640,640),dtype=np.float32),
            'white':np.ones((1,3,640,640),dtype=np.float32),
            'seeded_noise':rng.random((1,3,640,640),dtype=np.float32)}
    report=dict(scope='Synthetic-input conversion agreement only; no prescription images, detector accuracy or historical training/export identity claim',
                pt_sha256=pt_sha,onnx_sha256=onnx_sha,python=platform.python_version(),torch=torch.__version__,
                ultralytics=ultralytics.__version__,onnxruntime=ort.__version__,numpy=np.__version__,cases=[],
                named_parameter_comparisons=comparisons,matched_parameter_count=len(comparisons),
                matched_parameters_allclose=bool(comparisons and all(c['allclose'] for c in comparisons)),
                parameter_scope='Named ONNX initializers present in the fused supplied PT state dictionary; omitted constants/parameters are not asserted equivalent')
    for name,x in inputs.items():
        with torch.inference_mode():
            pred=model(torch.from_numpy(x))
        if isinstance(pred,tuple):pred=pred[0]
        a=pred.detach().cpu().numpy();b=session.run(None,{session.get_inputs()[0].name:x})[0]
        shape_match=a.shape==b.shape
        case=dict(name=name,input_sha256=hashlib.sha256(x.tobytes()).hexdigest(),pt_shape=list(a.shape),onnx_shape=list(b.shape),
                  finite=bool(np.isfinite(a).all() and np.isfinite(b).all()),shape_match=shape_match)
        if shape_match:
            # Raw rows near top-k ties can reorder; report raw agreement explicitly.
            case.update(raw_max_abs_difference=float(np.max(np.abs(a-b))),raw_allclose=bool(np.allclose(a,b,rtol=1e-3,atol=1e-3)),
                        max_abs_confidence_difference=float(np.max(np.abs(a[:,:,4]-b[:,:,4]))))
        report['cases'].append(case)
    report['raw_agreement']=all(c.get('raw_allclose',False) for c in report['cases'])
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(report,indent=2))


if __name__=='__main__':main()
