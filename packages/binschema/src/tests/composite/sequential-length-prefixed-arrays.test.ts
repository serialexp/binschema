// ABOUTME: Regression test for two (or more) length-prefixed arrays appearing in
// ABOUTME: sequence within a single struct. Isolates a Go-generator bug, independent
// ABOUTME: of any union/discriminator feature.
//
// Bug: the Go generator emitted `length, err := decoder.ReadUintN()` for every
// length-prefixed array decode using the hardcoded name `length`. A struct with two
// such arrays back-to-back therefore produced `length, err :=` twice, and the second
// failed to compile with "no new variables on left side of :=". The fix gives each
// array a per-field length variable.
//
// This was first observed only as a side effect of the nested-named-field-union
// fixture (whose Bag type has two arrays); this suite pins the exact failure mode on
// its own — primitive item types, no unions — so the coverage can't disappear if that
// other fixture is ever simplified. Bytes are hand-computed (TS is the spec).

import { defineTestSuite } from "../../schema/test-schema.js";

// ─────────────────────────────────────────────────────────────────────────────
// 1. Two sequential length-prefixed arrays of a primitive (uint16) in one struct.
// ─────────────────────────────────────────────────────────────────────────────
export const sequentialLengthPrefixedArraysTestSuite = defineTestSuite({
  name: "sequential_length_prefixed_arrays",
  description:
    "A struct with two length-prefixed arrays in a row. Each array's decode reads its " +
    "own length prefix; the two reads must use distinct local variables so generated " +
    "Go compiles (regression for the hardcoded `length :=` collision).",

  schema: {
    config: { endianness: "big_endian" },
    types: {
      "TwoArrays": {
        sequence: [
          {
            name: "first",
            type: "array",
            kind: "length_prefixed",
            length_type: "uint8",
            items: { type: "uint16" },
          },
          {
            name: "second",
            type: "array",
            kind: "length_prefixed",
            length_type: "uint8",
            items: { type: "uint16" },
          },
        ],
      },
    },
  },

  test_type: "TwoArrays",

  test_cases: [
    {
      description: "first=[1,2], second=[3]",
      value: { first: [1, 2], second: [3] },
      bytes: [
        // first: len=2, items 0x0001 0x0002
        0x02, 0x00, 0x01, 0x00, 0x02,
        // second: len=1, item 0x0003
        0x01, 0x00, 0x03,
      ],
    },
    {
      description: "both empty — length prefixes still read independently",
      value: { first: [], second: [] },
      bytes: [0x00, 0x00],
    },
    {
      description: "first empty, second non-empty",
      value: { first: [], second: [0xbeef] },
      bytes: [0x00, 0x01, 0xbe, 0xef],
    },
  ],
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Three sequential length-prefixed arrays with mixed length-prefix widths, to
//    confirm uniqueness holds beyond two and across differing prefix types.
// ─────────────────────────────────────────────────────────────────────────────
export const threeMixedLengthPrefixedArraysTestSuite = defineTestSuite({
  name: "three_mixed_length_prefixed_arrays",
  description:
    "Three length-prefixed arrays in sequence with uint8/uint16/uint32 length prefixes. " +
    "Exercises per-array length-variable uniqueness across more than two arrays and " +
    "across different prefix widths.",

  schema: {
    config: { endianness: "big_endian" },
    types: {
      "ThreeArrays": {
        sequence: [
          {
            name: "a",
            type: "array",
            kind: "length_prefixed",
            length_type: "uint8",
            items: { type: "uint8" },
          },
          {
            name: "b",
            type: "array",
            kind: "length_prefixed",
            length_type: "uint16",
            items: { type: "uint8" },
          },
          {
            name: "c",
            type: "array",
            kind: "length_prefixed",
            length_type: "uint32",
            items: { type: "uint8" },
          },
        ],
      },
    },
  },

  test_type: "ThreeArrays",

  test_cases: [
    {
      description: "a=[0x11], b=[0x22,0x33], c=[0x44]",
      value: { a: [0x11], b: [0x22, 0x33], c: [0x44] },
      bytes: [
        // a: uint8 len=1, item 0x11
        0x01, 0x11,
        // b: uint16 len=2, items 0x22 0x33
        0x00, 0x02, 0x22, 0x33,
        // c: uint32 len=1, item 0x44
        0x00, 0x00, 0x00, 0x01, 0x44,
      ],
    },
  ],
});
