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
    Sequence { sequence: Vec<Field> },
    Direct {
        #[serde(rename = "type")]
        type_name: String,
        #[serde(default)]
        kind: Option<String>,
        #[serde(default)]
        encoding: Option<String>,
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
    pub align_to: Option<u32>,  // For padding fields
    #[serde(default)]
    pub r#const: Option<serde_json::Value>,  // For const fields
    #[serde(default)]
    pub size: Option<u32>,  // For bit/bitfield fields
    #[serde(default)]
    pub fields: Option<Vec<BitfieldSubfield>>,  // For bitfield sub-fields
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct BitfieldSubfield {
    pub name: String,
    pub offset: u32,
    pub size: u32,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct TestCase {
    pub description: String,
    pub value: serde_json::Value,
    #[serde(default)]
    pub bytes: Option<Vec<u8>>,  // Optional - some tests only validate bits
    #[serde(default)]
    pub bits: Option<Vec<u8>>,
    #[serde(default)]
    pub error: Option<String>,
}
