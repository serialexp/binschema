package runtime

import "fmt"

// Error codes for cross-language compatibility.
// These match the TypeScript and Rust implementations exactly.
const (
	// ErrorIncompleteData indicates not enough bytes in buffer (need more network data).
	// Streaming layers use this code as the retry signal: pull another chunk and try again.
	ErrorIncompleteData = "INCOMPLETE_DATA"

	// ErrorInvalidValue indicates a value out of range or invalid for its declared type
	// (e.g. requesting 65-bit read from readBits, or a negative count).
	ErrorInvalidValue = "INVALID_VALUE"

	// ErrorInvalidEncoding indicates a wire-format invariant was violated
	// (e.g. DER indefinite-length, LEB128 overflow, malformed varint).
	ErrorInvalidEncoding = "INVALID_ENCODING"

	// ErrorInvalidUTF8 indicates a length-prefixed string was not valid UTF-8.
	ErrorInvalidUTF8 = "INVALID_UTF8"

	// ErrorInvalidVariant indicates a discriminated-union discriminator didn't
	// match any declared arm in the schema.
	ErrorInvalidVariant = "INVALID_VARIANT"

	// ErrorAlignmentRequired indicates a byte-aligned read was attempted at a
	// non-zero bit offset (e.g. ReadBytesSlice while mid-byte).
	ErrorAlignmentRequired = "ALIGNMENT_REQUIRED"

	// ErrorOutOfBounds indicates a seek or peek operation referenced a position
	// outside the buffer.
	ErrorOutOfBounds = "OUT_OF_BOUNDS"

	// ErrorStackOverflow indicates pointer / position-stack recursion exceeded
	// the configured limit (DoS guard).
	ErrorStackOverflow = "STACK_OVERFLOW"

	// ErrorSchemaMismatch indicates data doesn't match schema expectations.
	ErrorSchemaMismatch = "SCHEMA_MISMATCH"

	// ErrorCircularReference indicates an infinite loop in pointer structures.
	ErrorCircularReference = "CIRCULAR_REFERENCE"
)

// NoPosition signals "no relevant byte offset" when constructing a BinSchemaError.
const NoPosition = -1

// BinSchemaError is the cross-language error type returned by the runtime.
// Its Code field aligns 1:1 with the TypeScript ErrorCode union and the Rust
// BinSchemaError variants.
//
// Callers can pattern-match on Code to decide between retry (INCOMPLETE_DATA),
// fatal propagation, and protocol-level recovery:
//
//	if be, ok := err.(*BinSchemaError); ok && be.Code == ErrorIncompleteData {
//	    // pull another chunk and retry
//	}
type BinSchemaError struct {
	Code     string
	Message  string
	Position int    // byte offset where the error was detected; NoPosition if unknown
	Context  string // optional caller-attached context, e.g. "item 3/100"
}

// Error implements the error interface. Includes the code and (if set) the position.
func (e *BinSchemaError) Error() string {
	if e.Position >= 0 {
		return fmt.Sprintf("[%s] %s (at byte %d)", e.Code, e.Message, e.Position)
	}
	return fmt.Sprintf("[%s] %s", e.Code, e.Message)
}

// NewError constructs a BinSchemaError with no positional information.
func NewError(code, message string) *BinSchemaError {
	return &BinSchemaError{Code: code, Message: message, Position: NoPosition}
}

// NewErrorAt constructs a BinSchemaError tagged with a byte position.
func NewErrorAt(code, message string, position int) *BinSchemaError {
	return &BinSchemaError{Code: code, Message: message, Position: position}
}

// NewErrorf is the printf-style variant of NewError.
func NewErrorf(code, format string, args ...any) *BinSchemaError {
	return &BinSchemaError{Code: code, Message: fmt.Sprintf(format, args...), Position: NoPosition}
}
