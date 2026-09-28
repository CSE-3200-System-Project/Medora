"""Regression tests for the revision corpus builder; no private inputs required."""
import csv
import importlib.util
import json
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[3] / 'data/medicine_reference/rebuild_corpus.py'
spec = importlib.util.spec_from_file_location('medicine_rebuild', SCRIPT)
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


def test_combination_is_not_guessed():
    assert builder.split_strength('Drug A 20 mg + Drug B 10 mg') is None
    assert builder.split_strength('Paracetamol 250 mg/5 ml') == ('Paracetamol', '250 mg/5 ml')


def test_key_preserves_strength_and_form():
    assert builder.drug_key('Drug', '5 mg', 'Tablet') != builder.drug_key('Drug', '10 mg', 'Tablet')
    assert builder.drug_key('Drug', '5 mg', 'Tablet') != builder.drug_key('Drug', '5 mg', 'Injection')
    assert builder.clean('Vitamin B12 [Cyanocobalamin]') == 'Vitamin B12 [Cyanocobalamin]'


def test_build_is_deterministic_and_has_field_provenance(tmp_path):
    source = tmp_path / 'raw' / builder.SOURCES['S5']['file']
    source.parent.mkdir(parents=True)
    with source.open('w', newline='', encoding='utf-8') as stream:
        writer = csv.DictWriter(stream, fieldnames=['genericName','brandName','dosageType','strength','manufacturer','packageMark'])
        writer.writeheader()
        writer.writerows([
            dict(genericName=' Drug  A ',brandName='Brand',dosageType='Tablet',strength='5 mg',manufacturer='Maker',packageMark=''),
            dict(genericName='Drug A',brandName='Brand',dosageType='Tablet',strength='5 mg',manufacturer='Maker',packageMark=''),
            dict(genericName='Drug A',brandName='Other',dosageType='Tablet',strength='10 mg',manufacturer='Maker',packageMark=''),
        ])
    a, b = tmp_path / 'a', tmp_path / 'b'
    builder.build(tmp_path/'raw', a, 'mendeley-public')
    builder.build(tmp_path/'raw', b, 'mendeley-public')
    for name in ['Final_Medicine_Dataset.csv','row_provenance.jsonl','build_manifest.json','quality_report.json']:
        assert (a/name).read_bytes() == (b/name).read_bytes()
    rows = list(csv.DictReader((a/'Final_Medicine_Dataset.csv').open(encoding='utf-8')))
    assert len(rows) == 2
    assert all(not row['common_uses'] for row in rows)
    provenance = [json.loads(line) for line in (a/'row_provenance.jsonl').read_text().splitlines()]
    merged = next(p for p in provenance if p['fields']['generic_name']['source_ref'] == 'S5:1')
    assert len(merged['contributors']) == 2
    assert set(merged['fields']) == set(builder.DATA_FIELDS)
    assert 'collapse_whitespace' in merged['fields']['generic_name']['changes']


def test_later_type_attribution_does_not_mutate_original_contributor(tmp_path, monkeypatch):
    root = tmp_path/'raw'
    for sid, headings, values in [
        ('S5',['genericName','brandName','dosageType','strength','manufacturer'],['Drug','Brand','Tablet','5 mg','Maker']),
        ('S1',['generic','brand name','dosage form','strength','manufacturer','type'],['Drug','Brand','Tablet','5 mg','Maker','allopathic']),
        ('S2',['generic_name','medicine_name','category_name','strength','manufacturer_name'],['Drug','Brand','Tablet','5 mg','Maker']),
        ('S4',['Brand Name','Dosages Description','Name of the Manufacturer','Type','Generic Name and Strength','DAR'],['Brand','Tablet','Maker','Allopathic','Drug 5 mg','REG-1']),
        ('S3',['generic_name'],['Unused']),
    ]:
        path=root/builder.SOURCES[sid]['file'];path.parent.mkdir(parents=True,exist_ok=True)
        with path.open('w',encoding='utf-8',newline='') as stream:
            writer=csv.writer(stream);writer.writerow(headings);writer.writerow(values)
    output=tmp_path/'output';builder.build(root,output,'full-local')
    p=json.loads((output/'row_provenance.jsonl').read_text(encoding='utf-8'))
    assert p['fields']['medicine_type']['source_ref']=='S1:1'
    assert p['contributors'][0]['fields']['medicine_type']['source_ref'] is None
    assert p['contributors'][0]['fields']['medicine_type']['source_field'] is None
