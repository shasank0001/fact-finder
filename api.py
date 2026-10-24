"""Canonical entry point: uvicorn api:app."""
from importlib import import_module
app = import_module("micro-services.main").app
