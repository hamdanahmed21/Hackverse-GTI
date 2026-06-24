"""
Evaluates LLM outputs for quality, accuracy, and format compliance.
Use during development to catch bad responses early.
"""


def evaluate_response(response: str, expected_keys: list = []) -> dict:
    issues = []
    if not response or len(response.strip()) < 10:
        issues.append("Response too short or empty")
    if expected_keys:
        for key in expected_keys:
            if key.lower() not in response.lower():
                issues.append(f"Missing expected content: '{key}'")
    return {
        "passed": len(issues) == 0,
        "issues": issues,
        "length": len(response),
    }
