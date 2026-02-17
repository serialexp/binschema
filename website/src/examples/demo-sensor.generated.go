package main

import (
	"fmt"
	"github.com/anthropics/binschema/runtime"
)

type SensorReading struct {
	DeviceId uint16
	Temperature float32
	Humidity uint8
	Timestamp uint32
}

func (m *SensorReading) Encode() ([]byte, error) {
	return m.EncodeWithContext(runtime.NewEncodingContext())
}

func (m *SensorReading) EncodeWithContext(ctx *runtime.EncodingContext) ([]byte, error) {
	encoder := runtime.NewBitStreamEncoder(runtime.MSBFirst)

	// Build parent context for nested struct encoding
	parentFields := map[string]interface{}{
		"device_id": m.DeviceId,
		"temperature": m.Temperature,
		"humidity": m.Humidity,
		"timestamp": m.Timestamp,
	}
	childCtx := ctx.ExtendWithParent(parentFields)
	_ = childCtx // Used by nested struct encoding

	encoder.WriteUint16(m.DeviceId, runtime.BigEndian)
	encoder.WriteFloat32(m.Temperature, runtime.BigEndian)
	encoder.WriteUint8(m.Humidity)
	encoder.WriteUint32(m.Timestamp, runtime.BigEndian)

	return encoder.Finish(), nil
}

func (m *SensorReading) CalculateSize() int {
	size := 0

	size += 2 // DeviceId
	size += 4 // Temperature
	size += 1 // Humidity
	size += 4 // Timestamp

	return size
}

func DecodeSensorReading(bytes []byte) (*SensorReading, error) {
	decoder := runtime.NewBitStreamDecoder(bytes, runtime.MSBFirst)
	return decodeSensorReadingWithDecoder(decoder)
}

func decodeSensorReadingWithDecoder(decoder *runtime.BitStreamDecoder) (*SensorReading, error) {
	result := &SensorReading{}

	deviceId, err := decoder.ReadUint16(runtime.BigEndian)
	if err != nil {
		return nil, fmt.Errorf("failed to decode device_id: %w", err)
	}
	result.DeviceId = deviceId

	temperature, err := decoder.ReadFloat32(runtime.BigEndian)
	if err != nil {
		return nil, fmt.Errorf("failed to decode temperature: %w", err)
	}
	result.Temperature = temperature

	humidity, err := decoder.ReadUint8()
	if err != nil {
		return nil, fmt.Errorf("failed to decode humidity: %w", err)
	}
	result.Humidity = humidity

	timestamp, err := decoder.ReadUint32(runtime.BigEndian)
	if err != nil {
		return nil, fmt.Errorf("failed to decode timestamp: %w", err)
	}
	result.Timestamp = timestamp


	return result, nil
}
