// ABOUTME: Encoding context for parent field references in computed fields
// ABOUTME: Enables nested structs to access parent fields via ../field syntax
// ABOUTME: Supports compression dictionary for back_reference encoding (DNS-style)

use std::collections::HashMap;
use std::rc::Rc;
use std::cell::RefCell;

/// Dynamic field value for parent context.
/// Used to pass parent field values down to nested struct encoders.
#[derive(Debug, Clone)]
pub enum FieldValue {
    U8(u8),
    U16(u16),
    U32(u32),
    U64(u64),
    I8(i8),
    I16(i16),
    I32(i32),
    I64(i64),
    F32(f32),
    F64(f64),
    Bool(bool),
    String(String),
    Bytes(Vec<u8>),
    /// Array of (type_name, encoded_byte_size) pairs.
    /// Used by sum_of_type_sizes to compute total encoded size of elements by type.
    TypeSizes(Vec<(std::string::String, usize)>),
    /// Array of items with their type names and sub-field values.
    /// Used by corresponding<Type> selectors to access sub-fields of correlated items.
    /// Each item is (type_name, field_name_to_value_map).
    Items(Vec<(std::string::String, HashMap<std::string::String, FieldValue>)>),
}

impl FieldValue {
    /// Get the value as a byte slice (for Bytes variant)
    pub fn as_bytes(&self) -> Option<&[u8]> {
        match self {
            FieldValue::Bytes(b) => Some(b),
            _ => None,
        }
    }

    /// Get the value as a string slice (for String variant)
    pub fn as_string(&self) -> Option<&str> {
        match self {
            FieldValue::String(s) => Some(s),
            _ => None,
        }
    }

    /// Get the length of the value (for Bytes, String, TypeSizes, or Items)
    pub fn len(&self) -> usize {
        match self {
            FieldValue::Bytes(b) => b.len(),
            FieldValue::String(s) => s.as_bytes().len(), // UTF-8 byte length
            FieldValue::TypeSizes(entries) => entries.len(), // Number of array items
            FieldValue::Items(items) => items.len(), // Number of array items
            _ => 0,
        }
    }

    /// Sum the encoded sizes of elements matching a given type name.
    /// Valid for TypeSizes and Items variants. Returns 0 for other variants.
    pub fn sum_type_sizes(&self, element_type: &str) -> usize {
        match self {
            FieldValue::TypeSizes(entries) => {
                entries.iter()
                    .filter(|(type_name, _)| type_name == element_type)
                    .map(|(_, size)| size)
                    .sum()
            }
            FieldValue::Items(items) => {
                // Sum encoded sizes from Items — look for "_encoded_size" field
                items.iter()
                    .filter(|(type_name, _)| type_name == element_type)
                    .map(|(_, fields)| {
                        fields.get("_encoded_size")
                            .map(|v| v.length_of_value())
                            .unwrap_or(0)
                    })
                    .sum()
            }
            _ => 0,
        }
    }

    /// Sum all encoded sizes regardless of type.
    /// Valid for TypeSizes and Items variants. Returns 0 for other variants.
    pub fn sum_all_sizes(&self) -> usize {
        match self {
            FieldValue::TypeSizes(entries) => entries.iter().map(|(_, size)| size).sum(),
            FieldValue::Items(items) => {
                items.iter()
                    .map(|(_, fields)| {
                        fields.get("_encoded_size")
                            .map(|v| v.length_of_value())
                            .unwrap_or(0)
                    })
                    .sum()
            }
            _ => 0,
        }
    }

    /// Find the Nth occurrence of a type in an Items list and return a reference to its fields.
    /// Used by corresponding<Type> selectors to access sub-fields of correlated items.
    pub fn get_nth_item_of_type(&self, type_name: &str, n: usize) -> Option<&HashMap<std::string::String, FieldValue>> {
        match self {
            FieldValue::Items(items) => {
                let mut count = 0;
                for (item_type, fields) in items {
                    if item_type == type_name {
                        if count == n {
                            return Some(fields);
                        }
                        count += 1;
                    }
                }
                None
            }
            _ => None,
        }
    }

    /// Get the "length_of" value for this field.
    /// For scalar types, returns the value itself (like TypeScript's `typeof x === 'number' ? x : x.length`).
    /// For Bytes/String, returns the byte length.
    /// For TypeSizes, returns the number of array items.
    pub fn length_of_value(&self) -> usize {
        match self {
            FieldValue::U8(v) => *v as usize,
            FieldValue::U16(v) => *v as usize,
            FieldValue::U32(v) => *v as usize,
            FieldValue::U64(v) => *v as usize,
            FieldValue::I8(v) => *v as usize,
            FieldValue::I16(v) => *v as usize,
            FieldValue::I32(v) => *v as usize,
            FieldValue::I64(v) => *v as usize,
            FieldValue::F32(v) => *v as usize,
            FieldValue::F64(v) => *v as usize,
            FieldValue::Bool(v) => if *v { 1 } else { 0 },
            FieldValue::Bytes(b) => b.len(),
            FieldValue::String(s) => s.as_bytes().len(),
            FieldValue::TypeSizes(entries) => entries.len(),
            FieldValue::Items(items) => items.len(),
        }
    }

    /// Check if the value is empty (for Bytes or String)
    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    /// Get the raw bytes of the value (for CRC32 calculation)
    pub fn to_bytes(&self) -> Vec<u8> {
        match self {
            FieldValue::U8(v) => vec![*v],
            FieldValue::U16(v) => v.to_le_bytes().to_vec(),
            FieldValue::U32(v) => v.to_le_bytes().to_vec(),
            FieldValue::U64(v) => v.to_le_bytes().to_vec(),
            FieldValue::I8(v) => vec![*v as u8],
            FieldValue::I16(v) => v.to_le_bytes().to_vec(),
            FieldValue::I32(v) => v.to_le_bytes().to_vec(),
            FieldValue::I64(v) => v.to_le_bytes().to_vec(),
            FieldValue::F32(v) => v.to_le_bytes().to_vec(),
            FieldValue::F64(v) => v.to_le_bytes().to_vec(),
            FieldValue::Bool(v) => vec![if *v { 1 } else { 0 }],
            FieldValue::String(s) => s.as_bytes().to_vec(),
            FieldValue::Bytes(b) => b.clone(),
            FieldValue::TypeSizes(_) => Vec::new(), // Not applicable
            FieldValue::Items(_) => Vec::new(), // Not applicable
        }
    }
}

/// Helper trait for converting types to FieldValue
pub trait IntoFieldValue {
    fn into_field_value(self) -> FieldValue;
}

impl IntoFieldValue for u8 {
    fn into_field_value(self) -> FieldValue { FieldValue::U8(self) }
}
impl IntoFieldValue for u16 {
    fn into_field_value(self) -> FieldValue { FieldValue::U16(self) }
}
impl IntoFieldValue for u32 {
    fn into_field_value(self) -> FieldValue { FieldValue::U32(self) }
}
impl IntoFieldValue for u64 {
    fn into_field_value(self) -> FieldValue { FieldValue::U64(self) }
}
impl IntoFieldValue for i8 {
    fn into_field_value(self) -> FieldValue { FieldValue::I8(self) }
}
impl IntoFieldValue for i16 {
    fn into_field_value(self) -> FieldValue { FieldValue::I16(self) }
}
impl IntoFieldValue for i32 {
    fn into_field_value(self) -> FieldValue { FieldValue::I32(self) }
}
impl IntoFieldValue for i64 {
    fn into_field_value(self) -> FieldValue { FieldValue::I64(self) }
}
impl IntoFieldValue for f32 {
    fn into_field_value(self) -> FieldValue { FieldValue::F32(self) }
}
impl IntoFieldValue for f64 {
    fn into_field_value(self) -> FieldValue { FieldValue::F64(self) }
}
impl IntoFieldValue for bool {
    fn into_field_value(self) -> FieldValue { FieldValue::Bool(self) }
}
impl IntoFieldValue for String {
    fn into_field_value(self) -> FieldValue { FieldValue::String(self) }
}
impl IntoFieldValue for &str {
    fn into_field_value(self) -> FieldValue { FieldValue::String(self.to_string()) }
}
impl IntoFieldValue for Vec<u8> {
    fn into_field_value(self) -> FieldValue { FieldValue::Bytes(self) }
}
impl IntoFieldValue for &[u8] {
    fn into_field_value(self) -> FieldValue { FieldValue::Bytes(self.to_vec()) }
}

/// Encoding context for parent field references.
/// Enables nested structs to access parent fields via ../field syntax.
///
/// When encoding a struct that contains nested structs with computed fields
/// that reference parent fields (e.g., `length_of("../data")`), the parent
/// struct builds a context with its field values and passes it to the nested
/// struct's encoder.
#[derive(Debug, Clone, Default)]
pub struct EncodeContext {
    /// Stack of parent field maps. Last element is immediate parent.
    /// Each map contains field name -> field value mappings.
    parents: Vec<HashMap<String, FieldValue>>,

    /// Position tracking for first/last/corresponding selectors.
    /// Key format: "{array_name}_{type_name}" -> Vec of byte positions
    positions: HashMap<String, Vec<usize>>,

    /// Array iteration context for corresponding<Type> correlation.
    /// Key: array field name -> current iteration index
    array_iterations: HashMap<String, usize>,

    /// Type occurrence counters for corresponding<Type> correlation.
    /// Key: "{array_name}_{type_name}" -> count of occurrences seen so far
    type_indices: HashMap<String, usize>,

    /// The most recently set array iteration name, for cross-array correlation.
    current_array: Option<String>,

    /// Shared compression dictionary for back_reference encoding (DNS-style compression).
    /// Maps encoded target bytes to their absolute byte offset in the output stream.
    /// Uses Rc<RefCell> for shared mutable access across nested encoders.
    compression_dict: Option<Rc<RefCell<HashMap<Vec<u8>, usize>>>>,

    /// Base byte offset from the start of the message/output.
    /// Used to compute absolute offsets for compression dictionary entries.
    /// Each nested encoder accumulates the parent's base_offset + the parent's current position.
    base_offset: usize,
}

impl EncodeContext {
    /// Create a new empty context
    pub fn new() -> Self {
        Self {
            parents: Vec::new(),
            positions: HashMap::new(),
            array_iterations: HashMap::new(),
            type_indices: HashMap::new(),
            current_array: None,
            compression_dict: None,
            base_offset: 0,
        }
    }

    /// Create a new context with an additional parent added.
    /// The new parent becomes the immediate parent (innermost).
    /// Position tracking data is preserved and carried forward.
    pub fn extend_with_parent(&self, parent: HashMap<String, FieldValue>) -> Self {
        let mut new_parents = self.parents.clone();
        new_parents.push(parent);
        Self {
            parents: new_parents,
            positions: self.positions.clone(),
            array_iterations: self.array_iterations.clone(),
            type_indices: self.type_indices.clone(),
            current_array: self.current_array.clone(),
            compression_dict: self.compression_dict.clone(),
            base_offset: self.base_offset,
        }
    }

    /// Get a parent field value at N levels up.
    /// - levels_up=1 means immediate parent
    /// - levels_up=2 means grandparent
    /// - etc.
    ///
    /// Returns None if the level is out of bounds or the field doesn't exist.
    pub fn get_parent_field(&self, levels_up: usize, field_name: &str) -> Option<&FieldValue> {
        if levels_up == 0 || levels_up > self.parents.len() {
            return None;
        }
        let idx = self.parents.len() - levels_up;
        self.parents.get(idx)?.get(field_name)
    }

    /// Search through all parents to find a field by name.
    /// Searches from outermost (root) to innermost (immediate parent), matching Go's FindParentField.
    pub fn find_parent_field(&self, field_name: &str) -> Option<&FieldValue> {
        for parent in &self.parents {
            if let Some(val) = parent.get(field_name) {
                return Some(val);
            }
        }
        None
    }

    /// Check if the context has any parents
    pub fn has_parents(&self) -> bool {
        !self.parents.is_empty()
    }

    /// Get the number of parent levels
    pub fn parent_count(&self) -> usize {
        self.parents.len()
    }

    // === Position tracking for first/last/corresponding selectors ===

    /// Record a position for a given key (format: "{array_name}_{type_name}")
    pub fn track_position(&mut self, key: &str, position: usize) {
        self.positions.entry(key.to_string()).or_default().push(position);
    }

    /// Get the first tracked position for a key
    pub fn get_first_position(&self, key: &str) -> Option<usize> {
        self.positions.get(key).and_then(|v| v.first().copied())
    }

    /// Get the last tracked position for a key
    pub fn get_last_position(&self, key: &str) -> Option<usize> {
        self.positions.get(key).and_then(|v| v.last().copied())
    }

    /// Get the Nth tracked position for a key
    pub fn get_position(&self, key: &str, index: usize) -> Option<usize> {
        self.positions.get(key).and_then(|v| v.get(index).copied())
    }

    // === Array iteration tracking for corresponding<Type> ===

    /// Set the current array iteration index
    pub fn set_array_iteration(&mut self, array_name: &str, index: usize) {
        self.array_iterations.insert(array_name.to_string(), index);
        self.current_array = Some(array_name.to_string());
    }

    /// Get the current array iteration index
    pub fn get_array_iteration(&self, array_name: &str) -> Option<usize> {
        self.array_iterations.get(array_name).copied()
    }

    /// Check if we are currently iterating a specific array.
    /// Returns true only if the given array is the CURRENT array being iterated,
    /// not just any array that was previously iterated.
    pub fn is_current_array(&self, array_name: &str) -> bool {
        self.current_array.as_deref() == Some(array_name)
    }

    /// Get the current (most recently set) array iteration for cross-array correlation.
    /// Used when a type in one array references items in a sibling array.
    pub fn get_any_array_iteration(&self) -> Option<(&str, usize)> {
        // Prefer the most recently set array (current_array)
        if let Some(ref current) = self.current_array {
            if let Some(idx) = self.array_iterations.get(current) {
                return Some((current.as_str(), *idx));
            }
        }
        // Fallback to any entry
        self.array_iterations.iter().next().map(|(k, v)| (k.as_str(), *v))
    }

    /// Increment the type occurrence counter and return the new count
    pub fn increment_type_index(&mut self, key: &str) -> usize {
        let counter = self.type_indices.entry(key.to_string()).or_insert(0);
        *counter += 1;
        *counter
    }

    /// Get the current type occurrence count
    pub fn get_type_index(&self, key: &str) -> usize {
        self.type_indices.get(key).copied().unwrap_or(0)
    }

    // === Compression dictionary for back_reference encoding ===

    /// Ensure the compression dictionary exists (creates if None).
    pub fn ensure_compression_dict(&mut self) {
        if self.compression_dict.is_none() {
            self.compression_dict = Some(Rc::new(RefCell::new(HashMap::new())));
        }
    }

    /// Get a reference to the compression dictionary (if it exists).
    pub fn compression_dict(&self) -> Option<&Rc<RefCell<HashMap<Vec<u8>, usize>>>> {
        self.compression_dict.as_ref()
    }

    /// Get the base byte offset for absolute position calculation.
    pub fn base_offset(&self) -> usize {
        self.base_offset
    }

    /// Create a new context with an updated base_offset.
    /// The compression dictionary is shared (Rc clone is cheap).
    /// All other fields are preserved.
    pub fn with_base_offset(&self, offset: usize) -> Self {
        Self {
            parents: self.parents.clone(),
            positions: self.positions.clone(),
            array_iterations: self.array_iterations.clone(),
            type_indices: self.type_indices.clone(),
            current_array: self.current_array.clone(),
            compression_dict: self.compression_dict.clone(),
            base_offset: offset,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encode_context_basic() {
        let ctx = EncodeContext::new();
        assert!(!ctx.has_parents());
        assert_eq!(ctx.parent_count(), 0);
        assert!(ctx.get_parent_field(1, "foo").is_none());
    }

    #[test]
    fn test_encode_context_single_parent() {
        let ctx = EncodeContext::new();

        let mut parent_fields = HashMap::new();
        parent_fields.insert("data".to_string(), FieldValue::Bytes(vec![1, 2, 3, 4]));
        parent_fields.insert("name".to_string(), FieldValue::String("test".to_string()));

        let child_ctx = ctx.extend_with_parent(parent_fields);

        assert!(child_ctx.has_parents());
        assert_eq!(child_ctx.parent_count(), 1);

        // Access parent field
        let data = child_ctx.get_parent_field(1, "data").unwrap();
        assert_eq!(data.len(), 4);
        assert_eq!(data.as_bytes().unwrap(), &[1, 2, 3, 4]);

        let name = child_ctx.get_parent_field(1, "name").unwrap();
        assert_eq!(name.as_string().unwrap(), "test");

        // Non-existent field
        assert!(child_ctx.get_parent_field(1, "nonexistent").is_none());

        // Out of bounds level
        assert!(child_ctx.get_parent_field(2, "data").is_none());
    }

    #[test]
    fn test_encode_context_grandparent() {
        let ctx = EncodeContext::new();

        // Grandparent (root) context
        let mut grandparent_fields = HashMap::new();
        grandparent_fields.insert("payload".to_string(), FieldValue::Bytes(vec![0xDE, 0xAD, 0xBE, 0xEF]));
        let parent_ctx = ctx.extend_with_parent(grandparent_fields);

        // Parent context
        let mut parent_fields = HashMap::new();
        parent_fields.insert("header_value".to_string(), FieldValue::U32(42));
        let child_ctx = parent_ctx.extend_with_parent(parent_fields);

        assert_eq!(child_ctx.parent_count(), 2);

        // Access immediate parent (1 level up)
        let header = child_ctx.get_parent_field(1, "header_value").unwrap();
        match header {
            FieldValue::U32(v) => assert_eq!(*v, 42),
            _ => panic!("Expected U32"),
        }

        // Access grandparent (2 levels up)
        let payload = child_ctx.get_parent_field(2, "payload").unwrap();
        assert_eq!(payload.len(), 4);
    }

    #[test]
    fn test_field_value_len() {
        assert_eq!(FieldValue::Bytes(vec![1, 2, 3]).len(), 3);
        assert_eq!(FieldValue::String("hello".to_string()).len(), 5);
        assert_eq!(FieldValue::String("📄".to_string()).len(), 4); // UTF-8 bytes
        assert_eq!(FieldValue::U32(42).len(), 0); // Non-sequence types return 0
    }

    #[test]
    fn test_field_value_to_bytes() {
        assert_eq!(FieldValue::U8(0x42).to_bytes(), vec![0x42]);
        assert_eq!(FieldValue::U16(0x1234).to_bytes(), vec![0x34, 0x12]); // Little-endian
        assert_eq!(FieldValue::Bytes(vec![1, 2, 3]).to_bytes(), vec![1, 2, 3]);
        assert_eq!(FieldValue::String("AB".to_string()).to_bytes(), vec![0x41, 0x42]);
    }
}
