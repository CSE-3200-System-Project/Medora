from __future__ import annotations

import numpy as np
import pytest

from app.local_ocr import _v3_lines


pytestmark = pytest.mark.ai_service


class _PaddleResult:
    @property
    def json(self):
        return {
            "res": {
                "rec_texts": [" Napa 500 mg ", ""],
                "rec_scores": np.array([0.9342, 0.1]),
                "rec_polys": np.array(
                    [
                        [[10, 20], [110, 20], [110, 44], [10, 44]],
                        [[0, 0], [1, 0], [1, 1], [0, 1]],
                    ]
                ),
            }
        }


def test_paddle_v3_result_is_converted_to_ocr_lines() -> None:
    lines = _v3_lines([_PaddleResult()])

    assert len(lines) == 1
    assert lines[0].text == "Napa 500 mg"
    assert lines[0].confidence == 0.934
    assert lines[0].bbox.model_dump() == {
        "x_min": 10.0,
        "y_min": 20.0,
        "x_max": 110.0,
        "y_max": 44.0,
    }
