"""Fail closed when a Code Ocean transport input or declared model is altered."""

import hashlib
import json
from pathlib import Path

import pytest

from tools.release.package_softwarex_capsule import environment_postinstall
from tools.release.run_capsule_models import require_profile_assets, verify_package


def test_package_verifies_commit_and_every_declared_byte(tmp_path):
    code = tmp_path / "code"
    code.mkdir()
    (code / "CAPSULE_SOURCE_COMMIT").write_text("a" * 40 + "\n")
    (code / "input.txt").write_text("fixed")
    (code / "docs/softwarex").mkdir(parents=True)
    (code / "docs/softwarex/release_metadata.json").write_text('{"version":"v1.0.3"}')
    manifest = {
        "source_commit": "a" * 40,
        "source_tree": "b" * 40,
        "release_version": "v1.0.3",
        "profiles": {"detector": False, "phi_inference": False},
        "included_source_files": {"input.txt": {"sha256": hashlib.sha256(b"fixed").hexdigest(), "bytes": 5}},
        "additional_data_assets": {},
    }
    (code / "CAPSULE_SOURCE_MANIFEST.json").write_text(json.dumps(manifest))
    assert verify_package(code)["release_version"] == "v1.0.3"
    (code / "docs/softwarex/release_metadata.json").write_text('{"version":"v1.0.4"}')
    with pytest.raises(SystemExit, match="version disagree"):
        verify_package(code)
    (code / "docs/softwarex/release_metadata.json").write_text('{"version":"v1.0.3"}')
    (code / "input.txt").write_text("wrong")
    with pytest.raises(SystemExit, match="differs"):
        verify_package(code)


def test_declared_model_cannot_silently_fall_back_to_archival(tmp_path):
    with pytest.raises(SystemExit, match="missing assets"):
        require_profile_assets(tmp_path, {"detector": True, "phi_inference": False})
    model = tmp_path / "ai_service/models/Yolo26s/Yolo26s-prescription-5.pt"
    model.parent.mkdir(parents=True)
    model.write_bytes(b"unlisted")
    with pytest.raises(SystemExit, match="outside the declared"):
        require_profile_assets(tmp_path, {"detector": False, "phi_inference": False})


def test_environment_script_embeds_pins_without_referring_to_code_at_build_time():
    files = [("code/backend/requirements-release.txt", b"fastapi==0.126.0\n", 0o644),
             ("code/tests/requirements-release.txt", b"pytest==9.0.2\n", 0o644),
             ("code/tools/softwarex/requirements-detector-verification.txt", b"torch==2.10.0\n", 0o644)]
    script = environment_postinstall(files, detector=True).decode()
    assert "fastapi==0.126.0" in script and "pytest==9.0.2" in script
    assert "torch==2.10.0+cpu" in script
    assert "/code/" not in script and "/data/" not in script
    assert "postgresql-16" in script
    assert "ppa:deadsnakes/ppa" in script
    assert "software-properties-common" in script
    assert "libxcb1" in script
    assert "--no-cache-dir" in script
