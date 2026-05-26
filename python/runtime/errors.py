"""
BinSchemaError + ErrorCode constants for the Python runtime.

The string values in ``ErrorCode`` are part of the cross-language wire
contract — code in TypeScript, Go, Rust, and Python can compare an
exception's ``.code`` attribute against the same string constants and get a
deterministic answer for retry / propagate decisions.

A consumer wanting to handle streaming retries would write::

    try:
        decoder.decode_message()
    except BinSchemaError as e:
        if e.code == ErrorCode.INCOMPLETE_DATA:
            # pull another chunk and retry
        else:
            raise

This module is a direct port of ``src/runtime/errors.ts``.
"""

from __future__ import annotations
from typing import Optional


class ErrorCode:
    """Canonical error codes shared with the TypeScript, Go, and Rust runtimes.

    These string values are stable wire-format-level identifiers — change
    them in lockstep across all four runtimes or the cross-language tests
    will diverge.
    """

    # Buffer exhausted before all required bytes were available. Streaming
    # consumers treat this as the "pull another chunk and retry" signal.
    INCOMPLETE_DATA = "INCOMPLETE_DATA"
    # Value out of range for its declared type (negative count, bit-width
    # over 64, etc.).
    INVALID_VALUE = "INVALID_VALUE"
    # Wire-format invariant violated (DER indefinite length, LEB128
    # overflow, EBML missing marker bit, ...).
    INVALID_ENCODING = "INVALID_ENCODING"
    # A length-prefixed string was not valid UTF-8.
    INVALID_UTF8 = "INVALID_UTF8"
    # A discriminated-union discriminator didn't match any declared arm.
    INVALID_VARIANT = "INVALID_VARIANT"
    # Byte-aligned operation attempted at a non-zero bit offset.
    ALIGNMENT_REQUIRED = "ALIGNMENT_REQUIRED"
    # Seek / peek referenced a byte position outside the buffer.
    OUT_OF_BOUNDS = "OUT_OF_BOUNDS"
    # Pointer / position-stack recursion exceeded the configured limit.
    STACK_OVERFLOW = "STACK_OVERFLOW"
    # Data doesn't match schema expectations (missing required field, etc.).
    SCHEMA_MISMATCH = "SCHEMA_MISMATCH"
    # Pointer graph contained an infinite loop.
    CIRCULAR_REFERENCE = "CIRCULAR_REFERENCE"


class BinSchemaError(Exception):
    """Cross-language error type raised by the BinSchema Python runtime.

    Attributes
    ----------
    code
        One of the string constants in :class:`ErrorCode`. Stable across
        language runtimes.
    message
        Human-readable description (same as ``str(self)``).
    position
        Byte offset where the error was detected, or ``None`` if not
        applicable.
    context
        Optional caller-attached context string (e.g. ``"item 3/100"``).
    """

    __slots__ = ("code", "position", "context")

    def __init__(
        self,
        code: str,
        message: str,
        *,
        position: Optional[int] = None,
        context: Optional[str] = None,
    ) -> None:
        # Compose the formatted message ourselves so str(e) is consistent
        # across all four runtimes — the format mirrors the Go and Rust
        # display impls: "[CODE] message (at byte N)" with optional bits.
        formatted = f"[{code}] {message}"
        if position is not None:
            formatted += f" (at byte {position})"
        super().__init__(formatted)
        self.code = code
        self.position = position
        self.context = context

    def __repr__(self) -> str:  # pragma: no cover - convenience
        return (
            f"BinSchemaError(code={self.code!r}, "
            f"message={self.args[0]!r}, position={self.position!r}, "
            f"context={self.context!r})"
        )
