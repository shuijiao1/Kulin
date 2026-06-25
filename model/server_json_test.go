package model

import (
	"encoding/json"
	"testing"
)

func TestServerMarshalJSONDoesNotExposeOwnerOrUserID(t *testing.T) {
	raw, err := json.Marshal(&Server{Common: Common{ID: 7, UserID: 42}, Name: "srv"})
	if err != nil {
		t.Fatal(err)
	}
	var got map[string]any
	if err := json.Unmarshal(raw, &got); err != nil {
		t.Fatal(err)
	}
	if _, ok := got["owner"]; ok {
		t.Fatalf("owner field should be removed, raw=%s", raw)
	}
	if _, ok := got["user_id"]; ok {
		t.Fatalf("user_id must not be exposed, raw=%s", raw)
	}
	if got["name"] != "srv" {
		t.Fatalf("name=%v, want srv", got["name"])
	}
}
