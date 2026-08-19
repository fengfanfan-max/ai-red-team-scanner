"""Builtin dataset loading.

Datasets ship as JSON files under `data/datasets/` (MIT content, part of the
repo) and are loaded at runtime — they are NOT database rows. Custom datasets
live in the DB (see api/datasets.py).
"""

import json
from pathlib import Path

from pydantic import BaseModel, Field

DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "datasets"


class Subcategory(BaseModel):
    name: str
    prompts: list[str] = Field(min_length=1)


class BuiltinDataset(BaseModel):
    name: str
    description: str = ""
    subcategories: list[Subcategory] = Field(min_length=1)


def load_builtin_datasets() -> list[BuiltinDataset]:
    datasets: list[BuiltinDataset] = []
    for path in sorted(DATA_DIR.glob("*.json")):
        datasets.append(BuiltinDataset.model_validate(json.loads(path.read_text("utf-8"))))
    return datasets


def load_builtin_dataset(name: str) -> BuiltinDataset | None:
    for dataset in load_builtin_datasets():
        if dataset.name == name:
            return dataset
    return None
