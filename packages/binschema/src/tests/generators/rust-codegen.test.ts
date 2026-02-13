// ABOUTME: Tests for the Rust code generator
// ABOUTME: Verifies that generated Rust code has correct syntax and structure

import { generateRust } from "../../generators/rust.js";
import type { BinarySchema } from "../../schema/binary-schema.js";

interface TestCheck {
  description: string;
  passed: boolean;
  message?: string;
}

export function runRustGeneratorTests(): { passed: number; failed: number; checks: TestCheck[] } {
  let passed = 0;
  let failed = 0;
  const checks: TestCheck[] = [];

  // Test 1: Simple struct with primitives
  try {
    const schema: BinarySchema = {
      config: { endianness: "big_endian" },
      types: {
        SimpleStruct: {
          sequence: [
            { name: "id", type: "uint8" },
            { name: "value", type: "uint32" },
          ]
        }
      }
    };

    const result = generateRust(schema, "SimpleStruct");

    const hasStruct = result.code.includes("pub struct SimpleStruct");
    const hasEncodeMethod = result.code.includes("pub fn encode(&self)");
    const hasDecodeMethod = result.code.includes("pub fn decode(bytes: &[u8])");
    const hasFields = result.code.includes("pub id: u8") && result.code.includes("pub value: u32");

    if (hasStruct && hasEncodeMethod && hasDecodeMethod && hasFields) {
      passed++;
      checks.push({ description: "Simple struct with primitives", passed: true });
    } else {
      failed++;
      checks.push({
        description: "Simple struct with primitives",
        passed: false,
        message: `Missing expected content: struct=${hasStruct}, encode=${hasEncodeMethod}, decode=${hasDecodeMethod}, fields=${hasFields}`
      });
    }
  } catch (error: any) {
    failed++;
    checks.push({
      description: "Simple struct with primitives",
      passed: false,
      message: `Exception: ${error.message}`
    });
  }

  // Test 2: Nested struct
  try {
    const schema: BinarySchema = {
      config: { endianness: "big_endian" },
      types: {
        Header: {
          sequence: [
            { name: "magic", type: "uint32" },
          ]
        },
        File: {
          sequence: [
            { name: "header", type: "Header" },
            { name: "size", type: "uint32" },
          ]
        }
      }
    };

    const result = generateRust(schema, "File");

    const hasHeaderStruct = result.code.includes("pub struct Header");
    const hasFileStruct = result.code.includes("pub struct File");
    const hasNestedField = result.code.includes("pub header: Header");
    const callsNestedEncode = result.code.includes("self.header.encode()");
    const callsNestedDecode = result.code.includes("HeaderOutput::decode_with_decoder(decoder)");

    if (hasHeaderStruct && hasFileStruct && hasNestedField && callsNestedEncode && callsNestedDecode) {
      passed++;
      checks.push({ description: "Nested struct generation", passed: true });
    } else {
      failed++;
      checks.push({
        description: "Nested struct generation",
        passed: false,
        message: `Missing content: Header=${hasHeaderStruct}, File=${hasFileStruct}, field=${hasNestedField}, encode=${callsNestedEncode}, decode=${callsNestedDecode}`
      });
    }
  } catch (error: any) {
    failed++;
    checks.push({
      description: "Nested struct generation",
      passed: false,
      message: `Exception: ${error.message}`
    });
  }

  // Test 3: Bit fields
  try {
    const schema: BinarySchema = {
      config: { endianness: "big_endian", bit_order: "msb_first" },
      types: {
        Flags: {
          sequence: [
            { name: "reserved", type: "bit", size: 4 },
            { name: "enabled", type: "bit", size: 1 },
            { name: "mode", type: "bit", size: 3 },
          ]
        }
      }
    };

    const result = generateRust(schema, "Flags");

    const hasBitWrite = result.code.includes("encoder.write_bits(");
    const hasBitRead = result.code.includes("decoder.read_bits(");
    const hasCorrectSizes = result.code.includes("write_bits(self.reserved as u64, 4)") &&
                            result.code.includes("write_bits(self.enabled as u64, 1)") &&
                            result.code.includes("write_bits(self.mode as u64, 3)");

    if (hasBitWrite && hasBitRead && hasCorrectSizes) {
      passed++;
      checks.push({ description: "Bit field generation", passed: true });
    } else {
      failed++;
      checks.push({
        description: "Bit field generation",
        passed: false,
        message: `Missing bit operations: write=${hasBitWrite}, read=${hasBitRead}, sizes=${hasCorrectSizes}`
      });
    }
  } catch (error: any) {
    failed++;
    checks.push({
      description: "Bit field generation",
      passed: false,
      message: `Exception: ${error.message}`
    });
  }

  // Test 4: Fixed array
  try {
    const schema: BinarySchema = {
      config: { endianness: "big_endian" },
      types: {
        MagicHeader: {
          sequence: [
            { name: "magic", type: "array", kind: "fixed", length: 4, items: { type: "uint8" } },
          ]
        }
      }
    };

    const result = generateRust(schema, "MagicHeader");

    const hasVecType = result.code.includes("pub magic: Vec<u8>");
    const hasLoopEncode = result.code.includes("for item in &self.magic");
    const hasCapacity = result.code.includes("Vec::with_capacity(4)");

    if (hasVecType && hasLoopEncode && hasCapacity) {
      passed++;
      checks.push({ description: "Fixed array generation", passed: true });
    } else {
      failed++;
      checks.push({
        description: "Fixed array generation",
        passed: false,
        message: `Missing array handling: vec=${hasVecType}, loop=${hasLoopEncode}, capacity=${hasCapacity}`
      });
    }
  } catch (error: any) {
    failed++;
    checks.push({
      description: "Fixed array generation",
      passed: false,
      message: `Exception: ${error.message}`
    });
  }

  // Test 5: Length-prefixed string
  try {
    const schema: BinarySchema = {
      config: { endianness: "big_endian" },
      types: {
        Message: {
          sequence: [
            { name: "text", type: "string", kind: "length_prefixed", length_type: "uint8" },
          ]
        }
      }
    };

    const result = generateRust(schema, "Message");

    const hasStringType = result.code.includes("pub text: std::string::String");
    const writesLength = result.code.includes("encoder.write_uint8(self.text.len() as u8)");
    const readsLength = result.code.includes("let length = decoder.read_uint8()? as usize");
    const handlesUtf8 = result.code.includes("String::from_utf8");

    if (hasStringType && writesLength && readsLength && handlesUtf8) {
      passed++;
      checks.push({ description: "Length-prefixed string generation", passed: true });
    } else {
      failed++;
      checks.push({
        description: "Length-prefixed string generation",
        passed: false,
        message: `Missing string handling: type=${hasStringType}, writeLen=${writesLength}, readLen=${readsLength}, utf8=${handlesUtf8}`
      });
    }
  } catch (error: any) {
    failed++;
    checks.push({
      description: "Length-prefixed string generation",
      passed: false,
      message: `Exception: ${error.message}`
    });
  }

  // Test 6: Little endian
  try {
    const schema: BinarySchema = {
      config: { endianness: "little_endian" },
      types: {
        LittleEndianStruct: {
          sequence: [
            { name: "value", type: "uint32" },
          ]
        }
      }
    };

    const result = generateRust(schema, "LittleEndianStruct");

    const usesLittleEndian = result.code.includes("Endianness::LittleEndian");

    if (usesLittleEndian) {
      passed++;
      checks.push({ description: "Little endian support", passed: true });
    } else {
      failed++;
      checks.push({
        description: "Little endian support",
        passed: false,
        message: "Expected Endianness::LittleEndian in generated code"
      });
    }
  } catch (error: any) {
    failed++;
    checks.push({
      description: "Little endian support",
      passed: false,
      message: `Exception: ${error.message}`
    });
  }

  // Test 7: Field-level endianness override
  try {
    const schema: BinarySchema = {
      config: { endianness: "big_endian" },
      types: {
        MixedEndian: {
          sequence: [
            { name: "big_value", type: "uint16" },
            { name: "little_value", type: "uint16", endianness: "little_endian" },
          ]
        }
      }
    };

    const result = generateRust(schema, "MixedEndian");

    const hasBigEndian = result.code.includes("Endianness::BigEndian");
    const hasLittleEndian = result.code.includes("Endianness::LittleEndian");

    if (hasBigEndian && hasLittleEndian) {
      passed++;
      checks.push({ description: "Field-level endianness override", passed: true });
    } else {
      failed++;
      checks.push({
        description: "Field-level endianness override",
        passed: false,
        message: `Missing endianness: big=${hasBigEndian}, little=${hasLittleEndian}`
      });
    }
  } catch (error: any) {
    failed++;
    checks.push({
      description: "Field-level endianness override",
      passed: false,
      message: `Exception: ${error.message}`
    });
  }

  // Test 8: All primitive types
  try {
    const schema: BinarySchema = {
      config: { endianness: "big_endian" },
      types: {
        AllPrimitives: {
          sequence: [
            { name: "u8_val", type: "uint8" },
            { name: "u16_val", type: "uint16" },
            { name: "u32_val", type: "uint32" },
            { name: "u64_val", type: "uint64" },
            { name: "i8_val", type: "int8" },
            { name: "i16_val", type: "int16" },
            { name: "i32_val", type: "int32" },
            { name: "i64_val", type: "int64" },
            { name: "f32_val", type: "float32" },
            { name: "f64_val", type: "float64" },
          ]
        }
      }
    };

    const result = generateRust(schema, "AllPrimitives");

    const hasAllTypes =
      result.code.includes("pub u8_val: u8") &&
      result.code.includes("pub u16_val: u16") &&
      result.code.includes("pub u32_val: u32") &&
      result.code.includes("pub u64_val: u64") &&
      result.code.includes("pub i8_val: i8") &&
      result.code.includes("pub i16_val: i16") &&
      result.code.includes("pub i32_val: i32") &&
      result.code.includes("pub i64_val: i64") &&
      result.code.includes("pub f32_val: f32") &&
      result.code.includes("pub f64_val: f64");

    if (hasAllTypes) {
      passed++;
      checks.push({ description: "All primitive types", passed: true });
    } else {
      failed++;
      checks.push({
        description: "All primitive types",
        passed: false,
        message: "Not all primitive type mappings are correct"
      });
    }
  } catch (error: any) {
    failed++;
    checks.push({
      description: "All primitive types",
      passed: false,
      message: `Exception: ${error.message}`
    });
  }

  return { passed, failed, checks };
}
