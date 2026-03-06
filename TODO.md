# TODO

- Go test harness: dns_label_* tests fail because `Label` is a string type alias (`type X = string`) which has no Encode/Decode methods. The Go test harness can't call Encode/Decode on bare string type aliases used as test_type roots. Need to either generate wrapper structs for string types used as test_type, or handle string type aliases specially in the test harness.
