/**
 * Kerberos Protocol Tests (RFC 4120)
 *
 * Tests basic Kerberos message structures using ASN.1 DER encoding.
 * Kerberos uses variable-length DER encoding for all length fields.
 */

import { readFileSync } from "fs";
import { resolve } from "path";
import JSON5 from "json5";
import { defineBinarySchema, type BinarySchema } from "../../schema/binary-schema.js";
import type { TestSuite } from "../../schema/test-schema.js";

// Load Kerberos schema
const schemaPath = resolve(__dirname, "../../../examples/kerberos.schema.json");
const rawSchema = JSON5.parse(readFileSync(schemaPath, "utf-8")) as BinarySchema;
const schema = defineBinarySchema(rawSchema);

// Test basic DER primitives
export const kerberosInt32TestSuite: TestSuite = {
  name: "kerberos_int32",
  description: "ASN.1 INTEGER encoding (used throughout Kerberos)",
  schema,
  test_type: "Int32",
  test_cases: [
    {
      description: "Integer value 5 (Kerberos version)",
      value: {
        tag: 0x02,
        length: 1,
        value: [0x05]
      },
      bytes: [
        0x02,  // INTEGER tag
        0x01,  // Length: 1 byte
        0x05   // Value: 5
      ]
    },
    {
      description: "Integer value 10 (AS-REQ message type)",
      value: {
        tag: 0x02,
        length: 1,
        value: [0x0A]
      },
      bytes: [
        0x02,  // INTEGER tag
        0x01,  // Length: 1 byte
        0x0A   // Value: 10
      ]
    },
    {
      description: "Integer value 256 (requires 2 bytes)",
      value: {
        tag: 0x02,
        length: 2,
        value: [0x01, 0x00]
      },
      bytes: [
        0x02,        // INTEGER tag
        0x02,        // Length: 2 bytes
        0x01, 0x00   // Value: 256 (big-endian)
      ]
    }
  ]
};

// Test OCTET STRING
export const kerberosOctetStringTestSuite: TestSuite = {
  name: "kerberos_octet_string",
  description: "ASN.1 OCTET STRING encoding (used for encrypted data)",
  schema,
  test_type: "OctetString",
  test_cases: [
    {
      description: "Empty octet string",
      value: {
        tag: 0x04,
        length: 0,
        value: []
      },
      bytes: [
        0x04,  // OCTET STRING tag
        0x00   // Length: 0
      ]
    },
    {
      description: "4-byte octet string",
      value: {
        tag: 0x04,
        length: 4,
        value: [0xDE, 0xAD, 0xBE, 0xEF]
      },
      bytes: [
        0x04,                          // OCTET STRING tag
        0x04,                          // Length: 4
        0xDE, 0xAD, 0xBE, 0xEF        // Value
      ]
    },
    {
      description: "Large octet string (150 bytes, DER long form)",
      value: {
        tag: 0x04,
        length: 150,
        value: Array(150).fill(0x42)  // 150 bytes of 'B'
      },
      bytes: [
        0x04,      // OCTET STRING tag
        0x81, 0x96 // Length: 150 (DER long form: 0x81 = 1 length byte follows)
      ].concat(Array(150).fill(0x42))
    }
  ]
};

// Test PrincipalName
export const kerberosPrincipalNameTestSuite: TestSuite = {
  name: "kerberos_principal_name",
  description: "Kerberos PrincipalName encoding (user@REALM or service/host@REALM)",
  schema,
  test_type: "PrincipalName",
  test_cases: [
    {
      description: "Simple user principal (single component)",
      value: {
        sequence_tag: 0x30,
        sequence_length: 17,  // 5 (name-type) + 2 (tag+len for name-string) + 2 (SEQUENCE OF tag+len) + 6 (string) + 2 (context tag+len) = 17
        name_type_tag: 0xA0,
        name_type_length: 5,  // Int32 is 5 bytes total (tag + length + 1 byte value)
        name_type: {
          tag: 0x02,
          length: 1,
          value: [0x01]  // KRB_NT_PRINCIPAL = 1
        },
        name_string_tag: 0xA1,
        name_string_length: 8,  // 2 (SEQUENCE OF tag+len) + 6 (string) = 8
        name_string_seq_tag: 0x30,
        name_string_seq_length: 6,  // 1 string: tag(1) + len(1) + "user"(4) = 6 bytes
        name_string: [
          {
            tag: 0x1B,
            length: 4,
            value: "user"
          }
        ]
      },
      bytes: [
        // PrincipalName SEQUENCE
        0x30, 0x11,  // SEQUENCE, length=17

        // [0] name-type
        0xA0, 0x05,  // Context [0], length=5
        0x02, 0x01, 0x01,  // INTEGER 1 (KRB_NT_PRINCIPAL)

        // [1] name-string
        0xA1, 0x08,  // Context [1], length=8
        0x30, 0x06,  // SEQUENCE OF, length=6

        // First string component: "user"
        0x1B, 0x04,  // GeneralString, length=4
        0x75, 0x73, 0x65, 0x72  // "user"
      ]
    },
    {
      description: "Service principal with two components (service/host)",
      value: {
        sequence_tag: 0x30,
        sequence_length: 28,  // 5 (name-type) + 2 (context tag+len) + 2 (SEQUENCE tag+len) + 19 (two strings) = 28
        name_type_tag: 0xA0,
        name_type_length: 5,
        name_type: {
          tag: 0x02,
          length: 1,
          value: [0x02]  // KRB_NT_SRV_INST = 2
        },
        name_string_tag: 0xA1,
        name_string_length: 21,  // 2 (SEQUENCE tag+len) + 19 (two strings) = 21
        name_string_seq_tag: 0x30,
        name_string_seq_length: 19,  // "host": tag(1)+len(1)+data(4)=6, "example.com": tag(1)+len(1)+data(11)=13, total=19
        name_string: [
          {
            tag: 0x1B,
            length: 4,
            value: "host"
          },
          {
            tag: 0x1B,
            length: 11,
            value: "example.com"
          }
        ]
      },
      bytes: [
        // PrincipalName SEQUENCE
        0x30, 0x1C,  // SEQUENCE, length=28

        // [0] name-type
        0xA0, 0x05,  // Context [0], length=5
        0x02, 0x01, 0x02,  // INTEGER 2 (KRB_NT_SRV_INST)

        // [1] name-string
        0xA1, 0x15,  // Context [1], length=21
        0x30, 0x13,  // SEQUENCE OF, length=19

        // First component: "host"
        0x1B, 0x04,  // GeneralString, length=4
        0x68, 0x6F, 0x73, 0x74,  // "host"

        // Second component: "example.com"
        0x1B, 0x0B,  // GeneralString, length=11
        0x65, 0x78, 0x61, 0x6D, 0x70, 0x6C, 0x65, 0x2E, 0x63, 0x6F, 0x6D  // "example.com"
      ]
    },
    {
      description: "Principal with empty name-string array",
      value: {
        sequence_tag: 0x30,
        sequence_length: 11,
        name_type_tag: 0xA0,
        name_type_length: 5,
        name_type: {
          tag: 0x02,
          length: 1,
          value: [0x00]  // KRB_NT_UNKNOWN = 0
        },
        name_string_tag: 0xA1,
        name_string_length: 2,
        name_string_seq_tag: 0x30,
        name_string_seq_length: 0,
        name_string: []
      },
      bytes: [
        // PrincipalName SEQUENCE
        0x30, 0x0B,  // SEQUENCE, length=11

        // [0] name-type
        0xA0, 0x05,  // Context [0], length=5
        0x02, 0x01, 0x00,  // INTEGER 0 (KRB_NT_UNKNOWN)

        // [1] name-string
        0xA1, 0x02,  // Context [1], length=2
        0x30, 0x00   // SEQUENCE OF, length=0 (empty)
      ]
    }
  ]
};
