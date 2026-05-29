package runtime

import (
	"bytes"
	"compress/flate"
	"compress/gzip"
	"io"
)

// Codec transforms a byte buffer in both directions for `compressed` regions.
//
// A `compressed` field serializes its inner type to a buffer, runs it through a
// named codec, and frames the result. Built-in codecs:
//
//   - "store"   — identity passthrough (no compression).
//   - "deflate" — raw DEFLATE (RFC 1951), via compress/flate.
//   - "gzip"    — gzip container (RFC 1952), via compress/gzip.
//
// Register additional codecs (zstd, lz4, snappy, …) with RegisterCodec.
type Codec interface {
	// Compress transforms the inner-encoded bytes into the wire representation.
	Compress(data []byte) ([]byte, error)
	// Decompress reverses Compress. expectedSize is the decoded
	// uncompressed_size framing field; implementations may use it to
	// pre-allocate the output buffer or ignore it.
	Decompress(data []byte, expectedSize int) ([]byte, error)
}

type storeCodec struct{}

func (storeCodec) Compress(data []byte) ([]byte, error) { return data, nil }
func (storeCodec) Decompress(data []byte, expectedSize int) ([]byte, error) {
	return data, nil
}

type deflateCodec struct{}

func (deflateCodec) Compress(data []byte) ([]byte, error) {
	var buf bytes.Buffer
	w, err := flate.NewWriter(&buf, flate.DefaultCompression)
	if err != nil {
		return nil, err
	}
	if _, err := w.Write(data); err != nil {
		return nil, err
	}
	if err := w.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func (deflateCodec) Decompress(data []byte, expectedSize int) ([]byte, error) {
	r := flate.NewReader(bytes.NewReader(data))
	defer r.Close()
	out := bytes.NewBuffer(make([]byte, 0, expectedSize))
	if _, err := io.Copy(out, r); err != nil {
		return nil, err
	}
	return out.Bytes(), nil
}

type gzipCodec struct{}

func (gzipCodec) Compress(data []byte) ([]byte, error) {
	var buf bytes.Buffer
	w := gzip.NewWriter(&buf)
	if _, err := w.Write(data); err != nil {
		return nil, err
	}
	if err := w.Close(); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

func (gzipCodec) Decompress(data []byte, expectedSize int) ([]byte, error) {
	r, err := gzip.NewReader(bytes.NewReader(data))
	if err != nil {
		return nil, err
	}
	defer r.Close()
	out := bytes.NewBuffer(make([]byte, 0, expectedSize))
	if _, err := io.Copy(out, r); err != nil {
		return nil, err
	}
	return out.Bytes(), nil
}

var codecRegistry = map[string]Codec{
	"store":   storeCodec{},
	"deflate": deflateCodec{},
	"gzip":    gzipCodec{},
}

// RegisterCodec registers (or overrides) a codec by name. Use for codecs that
// aren't built in (e.g. zstd/lz4/snappy) by wrapping the library of your choice.
func RegisterCodec(name string, codec Codec) {
	codecRegistry[name] = codec
}

// ResolveCodec resolves a codec by name. Returns an error if the name isn't a
// built-in and hasn't been registered.
func ResolveCodec(name string) (Codec, error) {
	codec, ok := codecRegistry[name]
	if !ok {
		return nil, NewErrorf(ErrorInvalidEncoding, "no codec registered for '%s' (built-in: store, deflate, gzip)", name)
	}
	return codec, nil
}
