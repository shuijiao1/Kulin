package main

import (
	"database/sql"
	"encoding/json"
	"path/filepath"
	"testing"

	_ "github.com/mattn/go-sqlite3"
)

func TestMigrateCycleRulesToServerSettings(t *testing.T) {
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "sqlite.db")
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		t.Fatal(err)
	}
	_, err = db.Exec(`
CREATE TABLE servers(id integer primary key, name text);
CREATE TABLE alert_rules(id integer primary key, name text, rules_raw text, updated_at datetime);
INSERT INTO servers(id, name) VALUES (1, 'alpha'), (2, 'beta'), (3, 'gamma');`)
	if err != nil {
		t.Fatal(err)
	}
	raw := `[{"type":"cpu","max":90,"cover":0},{"type":"transfer_all_cycle","max":1024,"cycle_interval":1,"cycle_unit":"month","cover":0,"ignore":{"2":true}}]`
	if _, err := db.Exec(`INSERT INTO alert_rules(id, name, rules_raw) VALUES (1, 'mixed', ?)`, raw); err != nil {
		t.Fatal(err)
	}
	if err := db.Close(); err != nil {
		t.Fatal(err)
	}

	if err := run(dbPath, "", false, false); err != nil {
		t.Fatal(err)
	}

	db, err = sql.Open("sqlite3", dbPath)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	for _, id := range []int{1, 3} {
		var enabled int
		var typ string
		var max int
		if err := db.QueryRow(`SELECT cycle_transfer_enabled, cycle_transfer_type, cycle_transfer_max FROM servers WHERE id = ?`, id).Scan(&enabled, &typ, &max); err != nil {
			t.Fatal(err)
		}
		if enabled != 1 || typ != "transfer_all_cycle" || max != 1024 {
			t.Fatalf("server %d not migrated: enabled=%d type=%q max=%d", id, enabled, typ, max)
		}
	}

	var ignored sql.NullInt64
	if err := db.QueryRow(`SELECT cycle_transfer_enabled FROM servers WHERE id = 2`).Scan(&ignored); err != nil {
		t.Fatal(err)
	}
	if ignored.Valid && ignored.Int64 != 0 {
		t.Fatalf("ignored server should not be migrated, got %d", ignored.Int64)
	}

	var rr string
	if err := db.QueryRow(`SELECT rules_raw FROM alert_rules WHERE id = 1`).Scan(&rr); err != nil {
		t.Fatal(err)
	}
	var rules []map[string]any
	if err := json.Unmarshal([]byte(rr), &rules); err != nil {
		t.Fatal(err)
	}
	if len(rules) != 1 || rules[0]["type"] != "cpu" {
		t.Fatalf("legacy cycle rule not removed from alert rule: %s", rr)
	}
}
