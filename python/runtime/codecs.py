"""Codec registry for ``compressed`` regions.

A ``compressed`` field serializes its inner type to a buffer, runs it through a
named codec, and frames the result. Built-in codecs:

  - ``store``   - identity passthrough (no compression).
  - ``deflate`` - raw DEFLATE (RFC 1951), via :mod:`zlib` with ``wbits=-15``.
  - ``gzip``    - gzip container (RFC 1952), via :mod:`gzip`.

The registry is pluggable: register additional codecs (zstd, lz4, snappy, ...)
with :func:`register_codec` before encoding/decoding. Generated code calls
:func:`resolve_codec`; an unknown name raises a :class:`BinSchemaError` so the
failure is loud rather than silently producing wrong bytes.
"""

from __future__ import annotations

import gzip
import zlib
from abc import ABC, abstractmethod

from .errors import BinSchemaError, ErrorCode


class Codec(ABC):
    """A codec transforms a byte buffer in both directions."""

    @abstractmethod
    def compress(self, data: bytes) -> bytes:
        """Transform inner-encoded bytes into the wire representation."""

    @abstractmethod
    def decompress(self, data: bytes, expected_size: int) -> bytes:
        """Reverse :meth:`compress`.

        ``expected_size`` is the decoded ``uncompressed_size`` framing field;
        implementations may use it to pre-allocate or ignore it.
        """


class StoreCodec(Codec):
    def compress(self, data: bytes) -> bytes:
        return bytes(data)

    def decompress(self, data: bytes, expected_size: int) -> bytes:
        return bytes(data)


class DeflateCodec(Codec):
    def compress(self, data: bytes) -> bytes:
        # Raw DEFLATE (RFC 1951): wbits=-15 strips the zlib header/checksum so
        # the output matches Go's compress/flate and Rust's flate2 raw deflate.
        compressor = zlib.compressobj(level=zlib.Z_DEFAULT_COMPRESSION, wbits=-15)
        out = compressor.compress(bytes(data))
        out += compressor.flush()
        return out

    def decompress(self, data: bytes, expected_size: int) -> bytes:
        decompressor = zlib.decompressobj(wbits=-15)
        out = decompressor.decompress(bytes(data))
        out += decompressor.flush()
        return out


class GzipCodec(Codec):
    def compress(self, data: bytes) -> bytes:
        return gzip.compress(bytes(data))

    def decompress(self, data: bytes, expected_size: int) -> bytes:
        return gzip.decompress(bytes(data))


_REGISTRY: dict[str, Codec] = {
    "store": StoreCodec(),
    "deflate": DeflateCodec(),
    "gzip": GzipCodec(),
}


def register_codec(name: str, codec: Codec) -> None:
    """Register (or override) a codec by name.

    Use for codecs that aren't built in (zstd/lz4/snappy/...) by wrapping the
    library of your choice in a :class:`Codec`.
    """
    _REGISTRY[name] = codec


def resolve_codec(name: str) -> Codec:
    """Resolve a codec by name.

    Raises :class:`BinSchemaError` if the name isn't a built-in and hasn't been
    registered.
    """
    codec = _REGISTRY.get(name)
    if codec is None:
        raise BinSchemaError(
            ErrorCode.INVALID_ENCODING,
            f"no codec registered for '{name}' (built-in: store, deflate, gzip)",
        )
    return codec
