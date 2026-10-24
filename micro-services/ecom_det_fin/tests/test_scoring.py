import importlib
import pytest
to_badge = importlib.import_module("micro-services.ecom_det_fin.app.services.scoring").to_badge

@pytest.mark.parametrize("score,expected", [(0,"Low Risk"),(24.9,"Low Risk"),(25,"Caution"),(44.9,"Caution"),(45,"High Risk"),(69.9,"High Risk"),(70,"Critical"),(100,"Critical")])
def test_badge_ranges(score, expected):
    assert to_badge(score) == expected
