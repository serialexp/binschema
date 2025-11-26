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
const schemaPath = resolve(__dirname, "../../../../../examples/kerberos.schema.json");
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
        // length is auto-computed, omit from encoding input
        value: [0x05]
      },
      decoded_value: {
        tag: 0x02,
        length: 1,  // Computed field appears in decoded output
        value: [0x05]
      },
      bytes: [
        0x02,  // INTEGER tag
        0x01,  // Length: 1 byte (auto-computed)
        0x05   // Value: 5
      ]
    },
    {
      description: "Integer value 10 (AS-REQ message type)",
      value: {
        tag: 0x02,
        // length is auto-computed, omit from encoding input
        value: [0x0A]
      },
      decoded_value: {
        tag: 0x02,
        length: 1,  // Computed field appears in decoded output
        value: [0x0A]
      },
      bytes: [
        0x02,  // INTEGER tag
        0x01,  // Length: 1 byte (auto-computed)
        0x0A   // Value: 10
      ]
    },
    {
      description: "Integer value 256 (requires 2 bytes)",
      value: {
        tag: 0x02,
        // length is auto-computed, omit from encoding input
        value: [0x01, 0x00]
      },
      decoded_value: {
        tag: 0x02,
        length: 2,  // Computed field appears in decoded output
        value: [0x01, 0x00]
      },
      bytes: [
        0x02,        // INTEGER tag
        0x02,        // Length: 2 bytes (auto-computed)
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
        value: []
      },
      decoded_value: {
        tag: 0x04,
        length: 0,
        value: []
      },
      bytes: [
        0x04,  // OCTET STRING tag
        0x00   // Length: 0 (auto-computed)
      ]
    },
    {
      description: "4-byte octet string",
      value: {
        tag: 0x04,
        value: [0xDE, 0xAD, 0xBE, 0xEF]
      },
      decoded_value: {
        tag: 0x04,
        length: 4,
        value: [0xDE, 0xAD, 0xBE, 0xEF]
      },
      bytes: [
        0x04,                          // OCTET STRING tag
        0x04,                          // Length: 4 (auto-computed)
        0xDE, 0xAD, 0xBE, 0xEF        // Value
      ]
    },
    {
      description: "Large octet string (150 bytes, DER long form)",
      value: {
        tag: 0x04,
        value: Array(150).fill(0x42)  // 150 bytes of 'B'
      },
      decoded_value: {
        tag: 0x04,
        length: 150,
        value: Array(150).fill(0x42)
      },
      bytes: [
        0x04,      // OCTET STRING tag
        0x81, 0x96 // Length: 150 (DER long form: 0x81 = 1 length byte follows, auto-computed)
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
        name_type_tag: 0xA0,
        name_type: {
          tag: 0x02,
          value: [0x01]  // KRB_NT_PRINCIPAL = 1
        },
        name_string_tag: 0xA1,
        name_string_seq_tag: 0x30,
        name_string: [
          {
            tag: 0x1B,
            value: "user"
          }
        ]
      },
      decoded_value: {
        sequence_tag: 0x30,
        sequence_length: 15,  // Includes computed length fields: 1 (type_tag) + 1 (type_length) + 3 (Int32) + 1 (string_tag) + 1 (string_length) + 1 (seq_tag) + 1 (seq_length) + 6 (strings) = 15
        name_type_tag: 0xA0,
        name_type_length: 3,  // Int32: tag(1) + length(1) + value(1) = 3
        name_type: {
          tag: 0x02,
          length: 1,
          value: [0x01]
        },
        name_string_tag: 0xA1,
        name_string_length: 8,
        name_string_seq_tag: 0x30,
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
        0x30, 0x0F,  // SEQUENCE, length=15 (includes computed length fields)

        // [0] name-type
        0xA0, 0x03,  // Context [0], length=3 (corrected from 0x05)
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
        name_type_tag: 0xA0,
        name_type: {
          tag: 0x02,
          value: [0x02]  // KRB_NT_SRV_INST = 2
        },
        name_string_tag: 0xA1,
        name_string_seq_tag: 0x30,
        name_string: [
          {
            tag: 0x1B,
            value: "host"
          },
          {
            tag: 0x1B,
            value: "example.com"
          }
        ]
      },
      decoded_value: {
        sequence_tag: 0x30,
        sequence_length: 28,  // Includes computed length fields
        name_type_tag: 0xA0,
        name_type_length: 3,  // Int32: tag(1) + length(1) + value(1) = 3
        name_type: {
          tag: 0x02,
          length: 1,
          value: [0x02]
        },
        name_string_tag: 0xA1,
        name_string_length: 21,
        name_string_seq_tag: 0x30,
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
        0x30, 0x1C,  // SEQUENCE, length=28 (includes computed length fields)

        // [0] name-type
        0xA0, 0x03,  // Context [0], length=3 (corrected from 0x05)
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
        name_type_tag: 0xA0,
        name_type: {
          tag: 0x02,
          value: [0x00]  // KRB_NT_UNKNOWN = 0
        },
        name_string_tag: 0xA1,
        name_string_seq_tag: 0x30,
        name_string: []
      },
      decoded_value: {
        sequence_tag: 0x30,
        sequence_length: 9,  // Includes computed length fields
        name_type_tag: 0xA0,
        name_type_length: 3,  // Int32: tag(1) + length(1) + value(1) = 3
        name_type: {
          tag: 0x02,
          length: 1,
          value: [0x00]
        },
        name_string_tag: 0xA1,
        name_string_length: 2,
        name_string_seq_tag: 0x30,
        name_string: []
      },
      bytes: [
        // PrincipalName SEQUENCE
        0x30, 0x09,  // SEQUENCE, length=9 (includes computed length fields)

        // [0] name-type
        0xA0, 0x03,  // Context [0], length=3 (corrected from 0x05)
        0x02, 0x01, 0x00,  // INTEGER 0 (KRB_NT_UNKNOWN)

        // [1] name-string
        0xA1, 0x02,  // Context [1], length=2
        0x30, 0x00   // SEQUENCE OF, length=0 (empty)
      ]
    }
  ]
};

// Test EncryptedData
export const kerberosEncryptedDataTestSuite: TestSuite = {
  name: "kerberos_encrypted_data",
  description: "Kerberos EncryptedData encoding with optional kvno field",
  schema,
  test_type: "EncryptedData",
  test_cases: [
    {
      description: "EncryptedData without kvno (minimal)",
      value: {
        sequence_tag: 0x30,
        fields: [
          {
            type: "EncryptedData_Field_Etype",
            tag: 0xA0,
            value: {
              tag: 0x02,
              value: [0x12]  // Encryption type 18 (AES256-CTS-HMAC-SHA1-96)
            }
          },
          {
            type: "EncryptedData_Field_Cipher",
            tag: 0xA2,
            value: {
              tag: 0x04,
              value: [0xDE, 0xAD, 0xBE, 0xEF, 0xCA, 0xFE, 0xBA, 0xBE, 0x00]
            }
          }
        ]
      },
      decoded_value: {
        sequence_tag: 0x30,
        // Note: sequence_length is not captured in decoded output (implementation detail)
        fields: [
          {
            type: "EncryptedData_Field_Etype",
            tag: 0xA0,
            length: 3,  // Int32: tag(1) + length(1) + value(1) = 3 bytes
            value: {
              tag: 0x02,
              length: 1,
              value: [0x12]
            }
          },
          {
            type: "EncryptedData_Field_Cipher",
            tag: 0xA2,
            length: 11,  // OctetString: tag(1) + length(1) + value(9) = 11 bytes
            value: {
              tag: 0x04,
              length: 9,
              value: [0xDE, 0xAD, 0xBE, 0xEF, 0xCA, 0xFE, 0xBA, 0xBE, 0x00]
            }
          }
        ]
      },
      bytes: [
        // EncryptedData SEQUENCE
        0x30, 0x12,  // SEQUENCE, length=18

        // [0] etype
        0xA0, 0x03,  // Context [0], length=3
        0x02, 0x01, 0x12,  // INTEGER 18

        // [2] cipher (no [1] kvno - it's optional)
        0xA2, 0x0B,  // Context [2], length=11
        0x04, 0x09,  // OCTET STRING, length=9
        0xDE, 0xAD, 0xBE, 0xEF, 0xCA, 0xFE, 0xBA, 0xBE, 0x00
      ]
    },
    {
      description: "EncryptedData with kvno (all fields)",
      value: {
        sequence_tag: 0x30,
        fields: [
          {
            type: "EncryptedData_Field_Etype",
            tag: 0xA0,
            value: {
              tag: 0x02,
              value: [0x12]  // Encryption type 18
            }
          },
          {
            type: "EncryptedData_Field_Kvno",
            tag: 0xA1,
            value: {
              tag: 0x02,
              value: [0x03]  // Key version 3
            }
          },
          {
            type: "EncryptedData_Field_Cipher",
            tag: 0xA2,
            value: {
              tag: 0x04,
              value: [0xDE, 0xAD, 0xBE, 0xEF, 0xCA, 0xFE, 0xBA, 0xBE, 0x00]
            }
          }
        ]
      },
      decoded_value: {
        sequence_tag: 0x30,
        // Note: sequence_length is not captured in decoded output (implementation detail)
        fields: [
          {
            type: "EncryptedData_Field_Etype",
            tag: 0xA0,
            length: 3,  // Int32: tag(1) + length(1) + value(1) = 3 bytes
            value: {
              tag: 0x02,
              length: 1,
              value: [0x12]
            }
          },
          {
            type: "EncryptedData_Field_Kvno",
            tag: 0xA1,
            length: 3,  // UInt32: tag(1) + length(1) + value(1) = 3 bytes
            value: {
              tag: 0x02,
              length: 1,
              value: [0x03]
            }
          },
          {
            type: "EncryptedData_Field_Cipher",
            tag: 0xA2,
            length: 11,  // OctetString: tag(1) + length(1) + value(9) = 11 bytes
            value: {
              tag: 0x04,
              length: 9,
              value: [0xDE, 0xAD, 0xBE, 0xEF, 0xCA, 0xFE, 0xBA, 0xBE, 0x00]
            }
          }
        ]
      },
      bytes: [
        // EncryptedData SEQUENCE
        0x30, 0x17,  // SEQUENCE, length=23

        // [0] etype
        0xA0, 0x03,  // Context [0], length=3
        0x02, 0x01, 0x12,  // INTEGER 18

        // [1] kvno (optional, present)
        0xA1, 0x03,  // Context [1], length=3
        0x02, 0x01, 0x03,  // INTEGER 3

        // [2] cipher
        0xA2, 0x0B,  // Context [2], length=11
        0x04, 0x09,  // OCTET STRING, length=9
        0xDE, 0xAD, 0xBE, 0xEF, 0xCA, 0xFE, 0xBA, 0xBE, 0x00
      ]
    }
  ]
};

// Test PA-DATA
export const kerberosPADataTestSuite: TestSuite = {
  name: "kerberos_pa_data",
  description: "Kerberos PA-DATA (pre-authentication data)",
  schema,
  test_type: "PA_DATA",
  test_cases: [
    {
      description: "PA-DATA with type 2 and small data",
      value: {
        sequence_tag: 0x30,
        padata_type_tag: 0xA1,
        padata_type: {
          tag: 0x02,
          value: [0x02]  // PA-ENC-TIMESTAMP = 2
        },
        padata_value_tag: 0xA2,
        padata_value: {
          tag: 0x04,
          value: [0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]
        }
      },
      decoded_value: {
        sequence_tag: 0x30,
        sequence_length: 16,  // Includes encoded length fields: 1 (type_tag) + 1 (type_length) + 3 (Int32) + 1 (value_tag) + 1 (value_length) + 9 (OctetString) = 16
        padata_type_tag: 0xA1,
        padata_type_length: 3,  // Int32: tag(1) + length(1) + value(1) = 3
        padata_type: {
          tag: 0x02,
          length: 1,
          value: [0x02]
        },
        padata_value_tag: 0xA2,
        padata_value_length: 9,  // OctetString: tag(1) + length(1) + value(7) = 9
        padata_value: {
          tag: 0x04,
          length: 7,
          value: [0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]
        }
      },
      bytes: [
        // PA-DATA SEQUENCE
        0x30, 0x10,  // SEQUENCE, length=16 (includes computed length fields)

        // [1] padata-type
        0xA1, 0x03,  // Context [1], length=3
        0x02, 0x01, 0x02,  // INTEGER 2 (PA-ENC-TIMESTAMP)

        // [2] padata-value
        0xA2, 0x09,  // Context [2], length=9
        0x04, 0x07,  // OCTET STRING, length=7
        0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07
      ]
    },
    {
      description: "PA-DATA with type 128 and empty data",
      value: {
        sequence_tag: 0x30,
        padata_type_tag: 0xA1,
        padata_type: {
          tag: 0x02,
          value: [0x00, 0x80]  // 128 in big-endian
        },
        padata_value_tag: 0xA2,
        padata_value: {
          tag: 0x04,
          value: []
        }
      },
      decoded_value: {
        sequence_tag: 0x30,
        sequence_length: 10,  // Includes encoded length fields: 1 (type_tag) + 1 (type_length) + 4 (Int32) + 1 (value_tag) + 1 (value_length) + 2 (OctetString) = 10
        padata_type_tag: 0xA1,
        padata_type_length: 4,  // Int32: tag(1) + length(1) + value(2) = 4
        padata_type: {
          tag: 0x02,
          length: 2,
          value: [0x00, 0x80]
        },
        padata_value_tag: 0xA2,
        padata_value_length: 2,  // OctetString: tag(1) + length(1) + value(0) = 2
        padata_value: {
          tag: 0x04,
          length: 0,
          value: []
        }
      },
      bytes: [
        // PA-DATA SEQUENCE
        0x30, 0x0A,  // SEQUENCE, length=10 (includes computed length fields)

        // [1] padata-type
        0xA1, 0x04,  // Context [1], length=4
        0x02, 0x02, 0x00, 0x80,  // INTEGER 128 (2 bytes, big-endian)

        // [2] padata-value
        0xA2, 0x02,  // Context [2], length=2
        0x04, 0x00   // OCTET STRING, length=0 (empty)
      ]
    }
  ]
};

// Test KDC-REQ-BODY
export const kerberosKdcReqBodyTestSuite: TestSuite = {
  name: "kerberos_kdc_req_body",
  description: "Kerberos KDC-REQ-BODY with required fields",
  schema,
  test_type: "KDC_REQ_BODY",
  test_cases: [
    {
      description: "Minimal KDC-REQ-BODY with required fields only",
      value: {
        sequence_tag: 0x30,
        fields: [
          // [0] kdc-options (required)
          {
            type: "KDC_REQ_BODY_Field_KdcOptions",
            tag: 0xA0,
            value: {
              tag: 0x03,  // BIT STRING
              unused_bits: 0,
              value: [0x00, 0x00, 0x00, 0x01]  // Forwardable bit set
            }
          },
          // [2] realm (required)
          {
            type: "KDC_REQ_BODY_Field_Realm",
            tag: 0xA2,
            value: {
              tag: 0x1B,  // GeneralString
              value: "TEST.ORG"
            }
          },
          // [5] till (required)
          {
            type: "KDC_REQ_BODY_Field_Till",
            tag: 0xA5,
            value: {
              tag: 0x18,
              value: "20251231235959Z"
            }
          },
          // [7] nonce (required)
          {
            type: "KDC_REQ_BODY_Field_Nonce",
            tag: 0xA7,
            value: {
              tag: 0x02,  // INTEGER
              value: [0x01, 0xE2, 0x40]  // 123456
            }
          },
          // [8] etype (required, SEQUENCE OF)
          {
            type: "KDC_REQ_BODY_Field_Etype",
            tag: 0xA8,
            value: {
              sequence_tag: 0x30,
              items: [
                {
                  tag: 0x02,
                  value: [0x12]  // AES256 = 18
                }
              ]
            }
          }
        ]
      },
      decoded_value: {
        sequence_tag: 0x30,
        // Note: sequence_length is not captured in decoded output (implementation detail)
        fields: [
          // [0] kdc-options (required) - 9 bytes total
          {
            type: "KDC_REQ_BODY_Field_KdcOptions",
            tag: 0xA0,
            length: 7,  // KDCOptions total
            value: {
              tag: 0x03,  // BIT STRING
              total_length: 5,
              unused_bits: 0,
              value: [0x00, 0x00, 0x00, 0x01]  // Forwardable bit set
            }
          },
          // [2] realm (required) - 12 bytes total
          {
            type: "KDC_REQ_BODY_Field_Realm",
            tag: 0xA2,
            length: 10,
            value: {
              tag: 0x1B,  // GeneralString
              length: 8,
              value: "TEST.ORG"
            }
          },
          // [5] till (required) - 19 bytes total
          {
            type: "KDC_REQ_BODY_Field_Till",
            tag: 0xA5,
            length: 17,
            value: {
              tag: 0x18,
              length: 15,
              value: "20251231235959Z"
            }
          },
          // [7] nonce (required) - 7 bytes total
          {
            type: "KDC_REQ_BODY_Field_Nonce",
            tag: 0xA7,
            length: 5,
            value: {
              tag: 0x02,  // INTEGER
              length: 3,
              value: [0x01, 0xE2, 0x40]  // 123456
            }
          },
          // [8] etype (required, SEQUENCE OF) - 7 bytes total
          {
            type: "KDC_REQ_BODY_Field_Etype",
            tag: 0xA8,
            length: 5,
            value: {
              sequence_tag: 0x30,
              // Note: sequence_length is not captured in decoded output (implementation detail)
              items: [
                {
                  tag: 0x02,
                  length: 1,
                  value: [0x12]  // AES256 = 18
                }
              ]
            }
          }
        ]
      },
      bytes: [
        // KDC-REQ-BODY SEQUENCE
        0x30, 0x36,  // SEQUENCE, length=54

        // [0] kdc-options
        0xA0, 0x07,  // Context [0], length=7
        0x03, 0x05, 0x00,  // BIT STRING, length=5, unused=0
        0x00, 0x00, 0x00, 0x01,  // 4 bytes (32 bits), bit 0 set

        // [2] realm
        0xA2, 0x0A,  // Context [2], length=10
        0x1B, 0x08,  // GeneralString, length=8
        0x54, 0x45, 0x53, 0x54, 0x2E, 0x4F, 0x52, 0x47,  // "TEST.ORG"

        // [5] till
        0xA5, 0x11,  // Context [5], length=17
        0x18, 0x0F,  // GeneralizedTime, length=15
        0x32, 0x30, 0x32, 0x35, 0x31, 0x32, 0x33, 0x31,  // "20251231"
        0x32, 0x33, 0x35, 0x39, 0x35, 0x39, 0x5A,  // "235959Z"

        // [7] nonce
        0xA7, 0x05,  // Context [7], length=5
        0x02, 0x03, 0x01, 0xE2, 0x40,  // INTEGER 123456

        // [8] etype
        0xA8, 0x05,  // Context [8], length=5
        0x30, 0x03,  // SEQUENCE, length=3
        0x02, 0x01, 0x12  // INTEGER 18 (AES256)
      ]
    }
  ]
};

// Test AS-REQ
export const kerberosAsReqTestSuite: TestSuite = {
  name: "kerberos_as_req",
  description: "Kerberos AS-REQ (Authentication Service Request)",
  schema,
  test_type: "AS_REQ",
  test_cases: [
    {
      description: "Minimal AS-REQ without padata",
      value: {
        application_tag: 0x6A,
        sequence_tag: 0x30,
        fields: [
          // [1] pvno (required)
          {
            type: "AS_REQ_Field_Pvno",
            tag: 0xA1,
            value: {
              tag: 0x02,
              value: [0x05]  // Version 5
            }
          },
          // [2] msg-type (required)
          {
            type: "AS_REQ_Field_MsgType",
            tag: 0xA2,
            value: {
              tag: 0x02,
              value: [0x0A]  // AS-REQ = 10
            }
          },
          // [4] req-body (required) - minimal KDC-REQ-BODY
          {
            type: "AS_REQ_Field_ReqBody",
            tag: 0xA4,
            value: {
              sequence_tag: 0x30,
              fields: [
                // [0] kdc-options
                {
                  type: "KDC_REQ_BODY_Field_KdcOptions",
                  tag: 0xA0,
                  value: {
                    tag: 0x03,
                    unused_bits: 0,
                    value: [0x00, 0x00, 0x00, 0x01]
                  }
                },
                // [2] realm
                {
                  type: "KDC_REQ_BODY_Field_Realm",
                  tag: 0xA2,
                  value: {
                    tag: 0x1B,
                    value: "TEST.ORG"
                  }
                },
                // [5] till
                {
                  type: "KDC_REQ_BODY_Field_Till",
                  tag: 0xA5,
                  value: {
                    tag: 0x18,
                    value: "20251231235959Z"
                  }
                },
                // [7] nonce
                {
                  type: "KDC_REQ_BODY_Field_Nonce",
                  tag: 0xA7,
                  value: {
                    tag: 0x02,
                    value: [0x01, 0xE2, 0x40]
                  }
                },
                // [8] etype
                {
                  type: "KDC_REQ_BODY_Field_Etype",
                  tag: 0xA8,
                  value: {
                    sequence_tag: 0x30,
                    items: [
                      {
                        tag: 0x02,
                        value: [0x12]
                      }
                    ]
                  }
                }
              ]
            }
          }
        ]
      },
      decoded_value: {
        application_tag: 0x6A,
        application_length: 70,  // 2 (inner SEQUENCE header) + 68 (inner content)
        sequence_tag: 0x30,
        // Note: sequence_length is not captured in decoded output (implementation detail)
        fields: [
          // [1] pvno (required)
          {
            type: "AS_REQ_Field_Pvno",
            tag: 0xA1,
            length: 3,
            value: {
              tag: 0x02,
              length: 1,
              value: [0x05]  // Version 5
            }
          },
          // [2] msg-type (required)
          {
            type: "AS_REQ_Field_MsgType",
            tag: 0xA2,
            length: 3,
            value: {
              tag: 0x02,
              length: 1,
              value: [0x0A]  // AS-REQ = 10
            }
          },
          // [4] req-body (required) - minimal KDC-REQ-BODY
          {
            type: "AS_REQ_Field_ReqBody",
            tag: 0xA4,
            length: 56,  // 2 (SEQUENCE header) + 54 (content)
            value: {
              sequence_tag: 0x30,
              // Note: sequence_length is not captured in decoded output (implementation detail)
              fields: [
                // [0] kdc-options
                {
                  type: "KDC_REQ_BODY_Field_KdcOptions",
                  tag: 0xA0,
                  length: 7,
                  value: {
                    tag: 0x03,
                    total_length: 5,
                    unused_bits: 0,
                    value: [0x00, 0x00, 0x00, 0x01]
                  }
                },
                // [2] realm
                {
                  type: "KDC_REQ_BODY_Field_Realm",
                  tag: 0xA2,
                  length: 10,
                  value: {
                    tag: 0x1B,
                    length: 8,
                    value: "TEST.ORG"
                  }
                },
                // [5] till
                {
                  type: "KDC_REQ_BODY_Field_Till",
                  tag: 0xA5,
                  length: 17,
                  value: {
                    tag: 0x18,
                    length: 15,
                    value: "20251231235959Z"
                  }
                },
                // [7] nonce
                {
                  type: "KDC_REQ_BODY_Field_Nonce",
                  tag: 0xA7,
                  length: 5,
                  value: {
                    tag: 0x02,
                    length: 3,
                    value: [0x01, 0xE2, 0x40]
                  }
                },
                // [8] etype
                {
                  type: "KDC_REQ_BODY_Field_Etype",
                  tag: 0xA8,
                  length: 5,
                  value: {
                    sequence_tag: 0x30,
                    // Note: sequence_length is not captured in decoded output (implementation detail)
                    items: [
                      {
                        tag: 0x02,
                        length: 1,
                        value: [0x12]
                      }
                    ]
                  }
                }
              ]
            }
          }
        ]
      },
      bytes: [
        // AS-REQ APPLICATION tag
        0x6A, 0x46,  // APPLICATION 10, length=70

        // Inner SEQUENCE
        0x30, 0x44,  // SEQUENCE, length=68

        // [1] pvno
        0xA1, 0x03,  // Context [1], length=3
        0x02, 0x01, 0x05,  // INTEGER 5

        // [2] msg-type
        0xA2, 0x03,  // Context [2], length=3
        0x02, 0x01, 0x0A,  // INTEGER 10 (AS-REQ)

        // [4] req-body
        0xA4, 0x38,  // Context [4], length=56
        // KDC-REQ-BODY SEQUENCE
        0x30, 0x36,  // SEQUENCE, length=54
        // [0] kdc-options
        0xA0, 0x07,
        0x03, 0x05, 0x00,
        0x00, 0x00, 0x00, 0x01,
        // [2] realm
        0xA2, 0x0A,
        0x1B, 0x08,
        0x54, 0x45, 0x53, 0x54, 0x2E, 0x4F, 0x52, 0x47,
        // [5] till
        0xA5, 0x11,
        0x18, 0x0F,
        0x32, 0x30, 0x32, 0x35, 0x31, 0x32, 0x33, 0x31,
        0x32, 0x33, 0x35, 0x39, 0x35, 0x39, 0x5A,
        // [7] nonce
        0xA7, 0x05,
        0x02, 0x03, 0x01, 0xE2, 0x40,
        // [8] etype
        0xA8, 0x05,
        0x30, 0x03,
        0x02, 0x01, 0x12
      ]
    }
  ]
};


