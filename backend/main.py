"""Stateless JSON validation and formatting API."""

import json
import math
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

app = FastAPI(title="JSON Inspector API")


class JsonRequest(BaseModel):
    text: str = Field(max_length=1_000_000)
    indent: int = Field(default=2, ge=1, le=8)


class JsonProblem(Exception):
    def __init__(self, message: str, line: int | None = None, column: int | None = None):
        self.detail = {"message": message, "line": line, "column": column}


def reject_constant(value: str) -> Any:
    raise JsonProblem(f"{value} is not a valid JSON value.")


def check_values(value: Any, depth: int = 0) -> None:
    if depth > 100:
        raise JsonProblem("JSON nesting cannot exceed 100 levels.")
    if isinstance(value, float) and not math.isfinite(value):
        raise JsonProblem("Number is outside the supported finite range.")
    if isinstance(value, dict):
        for child in value.values():
            check_values(child, depth + 1)
    elif isinstance(value, list):
        for child in value:
            check_values(child, depth + 1)


def parse_json(text: str) -> Any:
    if not text.strip():
        raise JsonProblem("Please enter JSON.")
    try:
        value = json.loads(text, parse_constant=reject_constant)
        check_values(value)
        return value
    except json.JSONDecodeError as exc:
        raise JsonProblem(exc.msg, exc.lineno, exc.colno) from exc
    except (RecursionError, ValueError) as exc:
        raise JsonProblem("JSON is too deeply nested or contains an unsupported number.") from exc


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/validate")
def validate(payload: JsonRequest):
    try:
        parse_json(payload.text)
    except JsonProblem as exc:
        return {"valid": False, "error": exc.detail}
    return {"valid": True, "error": None}


@app.post("/api/format")
def format_json(payload: JsonRequest):
    try:
        value = parse_json(payload.text)
        # ASCII escaping also allows lone surrogate escapes to be returned safely.
        formatted = json.dumps(value, indent=payload.indent, ensure_ascii=True, allow_nan=False)
        return {"formatted": formatted}
    except JsonProblem as exc:
        raise HTTPException(status_code=400, detail=exc.detail) from exc
