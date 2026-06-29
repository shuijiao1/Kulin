package controller

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDecodeServerFormRejectsInvalidKnownField(t *testing.T) {
	_, err := decodeServerForm(map[string]json.RawMessage{
		"display_index": json.RawMessage(`"bad"`),
	})

	require.Error(t, err)
	assert.Contains(t, err.Error(), "display_index")
}

func TestDecodeServerFormKeepsValidFields(t *testing.T) {
	sf, err := decodeServerForm(map[string]json.RawMessage{
		"name":                     json.RawMessage(`"Hytron"`),
		"display_index":            json.RawMessage(`3`),
		"traffic_progress_enabled": json.RawMessage(`true`),
		"unknown_field":            json.RawMessage(`"ignored for compatibility"`),
	})

	require.NoError(t, err)
	assert.Equal(t, "Hytron", sf.Name)
	assert.Equal(t, 3, sf.DisplayIndex)
	assert.True(t, sf.TrafficProgressEnabled)
}

func TestDecodeServerFormReportsFieldNameForBoolTypeError(t *testing.T) {
	_, err := decodeServerForm(map[string]json.RawMessage{
		"traffic_progress_enabled": json.RawMessage(`"bad"`),
	})

	require.Error(t, err)
	assert.True(t, strings.Contains(err.Error(), "traffic_progress_enabled"), err.Error())
}
