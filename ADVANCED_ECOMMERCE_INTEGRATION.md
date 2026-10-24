# E-commerce integration

See the maintained [root README](README.md) for setup, authentication and API contracts. `/analyze`, `/ecommerce/analyze-advanced`, and `/api/check-site` share one pipeline; they no longer represent independently maintained basic/advanced scorers.

Scores are heuristic, not calibrated probabilities. Unknown/error/unavailable evidence forces at least Caution. Confirmed threat-provider matches set a Critical floor. Business, merchant and visual identity verification remain unknown until independent evidence is implemented. Stored ordinary feedback is unverified and excluded from the risk signal; only manually reviewed proof submissions contribute.

The repository's regression suite covers these rules. Real-world precision, recall, calibration and load still need evaluation before production claims can be made.
