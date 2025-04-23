#!/bin/bash
# This script sets up a virtual environment, installs dependencies, builds the package, and uploads it to PyPI.
./venv/bin/pip install -r requirements.txt
./venv/bin/python -m build
./venv/bin/python -m twine upload dist/*