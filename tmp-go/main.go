package main

import (
	"bytes"
	"fmt"
	"math"
	"reflect"

	"github.com/aeolun/json5"
)

type TestResult struct {
	Description  string      `json:"description"`
	Pass         bool        `json:"pass"`
	Error        string      `json:"error,omitempty"`
	EncodedBytes []byte      `json:"encoded_bytes,omitempty"`
	DecodedValue interface{} `json:"decoded_value,omitempty"`
}

func main() {
	_ = math.Pi
	allResults := [][]TestResult{}

	// Test suite: dns_cname_record
	{
		results := []TestResult{}

		// Test case 0: www.example.com CNAME -> example.com
		func() {
			result := TestResult{Description: "www.example.com CNAME -> example.com"}
			defer func() { results = append(results, result) }()

			testValue := dns_cname_record_DnsMessage{
				Answers: [map[class:1 name:[map[type:Label value:www] map[type:Label value:example] map[type:Label value:com]] rdata:map[type:CNAMERdata value:map[cname:[map[type:Label value:example] map[type:Label value:com]]]] rdlength:15 ttl:300 type:5]],
				Additional: [],
				Id: 4660,
				Qdcount: 1,
				Nscount: 0,
				Authority: [],
				Ancount: 1,
				Flags: map[aa:0 opcode:0 qr:1 ra:1 rcode:0 rd:1 tc:0 z:0],
				Arcount: 0,
				Questions: [map[qclass:1 qname:[map[type:Label value:www] map[type:Label value:example] map[type:Label value:com]] qtype:1]],
			}
			encoded, encErr := testValue.Encode()
			if encErr != nil {
				result.Error = fmt.Sprintf("encode error: %v", encErr)
				return
			}
			result.EncodedBytes = encoded

			expectedBytes := []byte{18, 52, 129, 128, 0, 1, 0, 1, 0, 0, 0, 0, 3, 119, 119, 119, 7, 101, 120, 97, 109, 112, 108, 101, 3, 99, 111, 109, 0, 0, 1, 0, 1, 3, 119, 119, 119, 7, 101, 120, 97, 109, 112, 108, 101, 3, 99, 111, 109, 0, 0, 5, 0, 1, 0, 0, 1, 44, 0, 15, 7, 101, 120, 97, 109, 112, 108, 101, 3, 99, 111, 109, 0}
			if !bytes.Equal(encoded, expectedBytes) {
				result.Error = fmt.Sprintf("encoded bytes mismatch: got %v, want %v", encoded, expectedBytes)
				result.Pass = false
				return
			}

			decoded, decErr := Decodedns_cname_record_DnsMessage(encoded)
			if decErr != nil {
				result.Error = fmt.Sprintf("decode error: %v", decErr)
				return
			}
			result.DecodedValue = decoded

			if !reflect.DeepEqual(decoded, &testValue) {
				result.Error = fmt.Sprintf("decoded value mismatch: got %+v, want %+v", decoded, testValue)
				result.Pass = false
				return
			}

			result.Pass = true
		}()

		allResults = append(allResults, results)
	}


	// Output results as JSON5
	data, err := json5.Marshal(allResults)
	if err != nil {
		panic(err)
	}
	fmt.Println(string(data))
}
