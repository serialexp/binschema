// ABOUTME: Test schema types for loading JSON5 test suites
// ABOUTME: Mirrors TypeScript test schema structure for cross-language compatibility

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct TestSuite {
    pub name: String,
    pub description: String,
    pub schema: Schema,
    pub test_type: String,
    pub test_cases: Vec<TestCase>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct Schema {
    #[serde(default)]
    pub config: Option<SchemaConfig>,
    pub types: HashMap<String, TypeDef>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct SchemaConfig {
    #[serde(default)]
    pub endianness: Option<String>,
    #[serde(default)]
    pub bit_order: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(untagged)]
pub enum TypeDef {
    Sequence {
        sequence: Vec<Field>,
        #[serde(default)]
        instances: Option<Vec<Instance>>,
        #[serde(default)]
        description: Option<String>,
    },
    DiscriminatedUnion {
        #[serde(rename = "type")]
        type_name: String,  // Should be "discriminated_union"
        discriminator: serde_json::Value,
        variants: Vec<UnionVariant>,
        #[serde(default)]
        description: Option<String>,
    },
    BackReference {
        #[serde(rename = "type")]
        type_name: String,  // Should be "back_reference"
        storage: String,
        #[serde(default)]
        offset_mask: Option<String>,
        #[serde(default)]
        offset_from: Option<String>,
        target_type: String,
        #[serde(default)]
        endianness: Option<String>,
        #[serde(default)]
        description: Option<String>,
    },
    Array {
        #[serde(rename = "type")]
        type_name: String,  // Should be "array"
        kind: String,
        items: Box<Field>,
        #[serde(default)]
        terminal_variants: Option<Vec<String>>,
        #[serde(default)]
        description: Option<String>,
    },
    Direct {
        #[serde(rename = "type")]
        type_name: String,
        #[serde(default)]
        kind: Option<String>,
        #[serde(default)]
        encoding: Option<String>,
        #[serde(default)]
        length: Option<u32>,
        #[serde(default)]
        length_type: Option<String>,
        #[serde(default)]
        description: Option<String>,
    },
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct Field {
    #[serde(default)]
    pub name: Option<String>,  // Optional because array items don't have names
    #[serde(rename = "type")]
    pub field_type: String,
    #[serde(default)]
    pub kind: Option<String>,
    #[serde(default)]
    pub length: Option<serde_json::Value>,
    #[serde(default)]
    pub length_type: Option<String>,
    #[serde(default)]
    pub item_length_type: Option<String>,  // For length_prefixed_items arrays
    #[serde(default)]
    pub length_field: Option<String>,  // For field_referenced arrays
    #[serde(default)]
    pub items: Option<Box<Field>>,
    #[serde(default)]
    pub encoding: Option<String>,
    #[serde(default)]
    pub conditional: Option<String>,
    #[serde(default)]
    pub endianness: Option<String>,
    #[serde(default)]
    pub value_type: Option<String>,  // For optional fields
    #[serde(default)]
    pub presence_type: Option<String>,  // For optional fields: "uint8" or "bit"
    #[serde(default)]
    pub align_to: Option<u32>,  // For padding fields
    #[serde(default)]
    pub r#const: Option<serde_json::Value>,  // For const fields
    #[serde(default)]
    pub size: Option<u32>,  // For bit/bitfield fields
    #[serde(default)]
    pub fields: Option<Vec<BitfieldSubfield>>,  // For bitfield sub-fields
    #[serde(default)]
    pub choices: Option<Vec<ChoiceVariant>>,  // For choice types
    #[serde(default)]
    pub variants: Option<Vec<UnionVariant>>,  // For discriminated_union types
    #[serde(default)]
    pub discriminator: Option<serde_json::Value>,  // For discriminated unions
    #[serde(default)]
    pub computed: Option<serde_json::Value>,  // For computed fields
    #[serde(default)]
    pub length_encoding: Option<String>,  // For byte_length_prefixed arrays
    #[serde(default)]
    pub terminator_value: Option<serde_json::Value>,  // For signature_terminated arrays
    #[serde(default)]
    pub terminator_type: Option<String>,  // For signature_terminated arrays
    #[serde(default)]
    pub terminator_endianness: Option<String>,  // For signature_terminated arrays
    #[serde(default)]
    pub terminal_variants: Option<Vec<String>>,  // For variant_terminated arrays
    #[serde(default)]
    pub count_expr: Option<String>,  // For computed_count arrays
    #[serde(default)]
    pub bit_order: Option<String>,  // For bit fields
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct Instance {
    pub name: String,
    #[serde(rename = "type")]
    pub instance_type: serde_json::Value,  // Can be a string or inline union definition
    #[serde(default)]
    pub position: Option<String>,
    #[serde(default)]
    pub size: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct BitfieldSubfield {
    pub name: String,
    pub offset: u32,
    pub size: u32,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ChoiceVariant {
    #[serde(rename = "type")]
    pub type_name: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct UnionVariant {
    #[serde(rename = "type")]
    pub type_name: String,
    #[serde(default)]
    pub when: Option<String>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct TestCase {
    pub description: String,
    pub value: serde_json::Value,
    #[serde(default)]
    pub decoded_value: Option<serde_json::Value>,  // For decode comparison (includes computed fields)
    #[serde(default)]
    pub bytes: Option<Vec<u8>>,  // Optional - some tests only validate bits
    #[serde(default)]
    pub bits: Option<Vec<u8>>,
    #[serde(default)]
    pub error: Option<String>,
    #[serde(default)]
    pub should_error_on_encode: Option<bool>,
    #[serde(default)]
    pub should_error_on_decode: Option<bool>,
}
