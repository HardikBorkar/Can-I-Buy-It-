"""
Main entry point for Buy or Wait? solution.
Runs the end-to-end pipeline and generates output.csv and evaluation/usage_report.md.
"""
import sys
from pathlib import Path

# Add root and code/ to sys.path
ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))
sys.path.insert(0, str(ROOT_DIR / "code"))

from run_pipeline import run_pipeline

if __name__ == "__main__":
    run_pipeline()
