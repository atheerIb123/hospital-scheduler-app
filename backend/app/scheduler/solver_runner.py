"""
Standalone script: reads input JSON from a file, writes output JSON to another file.
Usage: python solver_runner.py <input_file> <output_file>
Run as a subprocess so a native ortools crash cannot kill the Flask process.
"""

import sys
import os
import json

# Add backend/ directory to sys.path so package imports work
_backend_dir = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
)
sys.path.insert(0, _backend_dir)

from app.scheduler.solver import generate_schedule  # noqa: E402

if __name__ == "__main__":
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    try:
        with open(input_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        result = generate_schedule(
            data["employees"],
            data["shift_types"],
            data["rules"],
            data["month"],
            data["year"],
        )
        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(result, f)
    except Exception as e:
        import traceback

        with open(output_file, "w", encoding="utf-8") as f:
            json.dump(
                {
                    "status": "failed",
                    "reason": str(e),
                    "traceback": traceback.format_exc(),
                },
                f,
            )
        sys.exit(1)
