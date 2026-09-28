import importlib.util
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[3]


def test_sanitized_notebook_has_no_images_outputs_or_execution_metadata():
    n=json.loads((ROOT/'ai_service/models/Yolo26s/training_recipe.sanitized.ipynb').read_text(encoding='utf-8'))
    assert all(not c.get('outputs') and not c.get('attachments') and c.get('execution_count') is None for c in n['cells'])
    assert 'data:image/' not in json.dumps(n)
    assert 'colab' not in n['metadata']


def test_current_parameter_report_is_bounded_and_honest():
    report=json.loads((ROOT/'docs/softwarex/generated/detector_pair_verification.json').read_text())
    assert report['matched_parameter_count']==204
    assert all(p['max_abs_difference']==0 for p in report['named_parameter_comparisons'])
    assert report['matched_parameters_allclose'] is True
    assert report['raw_agreement'] is False
    assert all(c['finite'] and c['shape_match'] for c in report['cases'])


def test_metadata_unpickler_never_returns_unknown_global():
    spec=importlib.util.spec_from_file_location('inspection',ROOT/'tools/softwarex/inspect_detector_artifacts.py')
    mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
    import io
    reader=mod.MetadataUnpickler(io.BytesIO())
    assert reader.find_class('os','system') is mod.Inert
    assert reader.find_class('builtins','eval') is mod.Inert
