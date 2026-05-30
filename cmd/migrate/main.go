package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

type rule struct {
	Type          string          `json:"type"`
	Min           float64         `json:"min,omitempty"`
	Max           float64         `json:"max,omitempty"`
	CycleStart    *time.Time      `json:"cycle_start,omitempty"`
	CycleInterval uint64          `json:"cycle_interval,omitempty"`
	CycleUnit     string          `json:"cycle_unit,omitempty"`
	Duration      uint64          `json:"duration,omitempty"`
	Cover         uint64          `json:"cover"`
	Ignore        map[uint64]bool `json:"ignore,omitempty"`
}

type alertRule struct {
	ID       uint64
	Name     string
	RulesRaw string
}

type server struct {
	ID   uint64
	Name string
}

type summary struct {
	DBPath                 string   `json:"db_path"`
	DryRun                 bool     `json:"dry_run"`
	BackupPath             string   `json:"backup_path,omitempty"`
	ServersTotal           int      `json:"servers_total"`
	CycleServersUpdated    int      `json:"cycle_servers_updated"`
	AlertRulesUpdated      int      `json:"alert_rules_updated"`
	AlertRulesDeleted      int      `json:"alert_rules_deleted"`
	UnsupportedTablesFound []string `json:"unsupported_tables_found,omitempty"`
	Notes                  []string `json:"notes,omitempty"`
}

func main() {
	var dbPath, backupPath string
	var dryRun, keepLegacy bool
	flag.StringVar(&dbPath, "db", "data/sqlite.db", "SQLite database path from an existing Nezha/Kulin dashboard")
	flag.StringVar(&backupPath, "backup", "", "backup path; default: <db>.kulin-migrate-<timestamp>.bak")
	flag.BoolVar(&dryRun, "dry-run", false, "inspect and print planned changes without writing")
	flag.BoolVar(&keepLegacy, "keep-legacy-cycle-alerts", false, "keep legacy cycle traffic rules in alert_rules instead of removing them after migration")
	flag.Parse()

	if err := run(dbPath, backupPath, dryRun, keepLegacy); err != nil {
		fmt.Fprintf(os.Stderr, "kulin-migrate: %v\n", err)
		os.Exit(1)
	}
}

func run(dbPath, backupPath string, dryRun, keepLegacy bool) error {
	if dbPath == "" {
		return errors.New("empty -db")
	}
	if _, err := os.Stat(dbPath); err != nil {
		return err
	}

	sum := summary{DBPath: dbPath, DryRun: dryRun}
	if !dryRun {
		if backupPath == "" {
			backupPath = fmt.Sprintf("%s.kulin-migrate-%s.bak", dbPath, time.Now().Format("20060102-150405"))
		}
		if err := copyFile(dbPath, backupPath); err != nil {
			return fmt.Errorf("backup database: %w", err)
		}
		sum.BackupPath = backupPath
	}

	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return err
	}
	defer db.Close()

	if _, err := db.Exec(`PRAGMA foreign_keys = OFF`); err != nil {
		return err
	}

	servers, err := loadServers(db)
	if err != nil {
		return err
	}
	sum.ServersTotal = len(servers)

	unsupported, _ := existingTables(db, []string{
		"crons", "ddns_profiles", "nat", "server_groups", "server_group_servers", "notification_groups", "notification_group_notifications", "server_transfers", "jwt_sessions",
	})
	sum.UnsupportedTablesFound = unsupported
	if len(unsupported) > 0 {
		sum.Notes = append(sum.Notes, "Kulin keeps the core monitoring data. Tables for features removed from the UI are left in the database as archived data, but those features are not restored by the migration.")
	}

	if err := ensureCycleColumns(db); err != nil {
		return err
	}

	alerts, err := loadAlertRules(db)
	if err != nil {
		return err
	}

	type serverUpdate struct{ r rule }
	updates := map[uint64]serverUpdate{}
	updatedAlerts := map[uint64]string{}
	deleteAlerts := map[uint64]bool{}

	serverIDs := make([]uint64, 0, len(servers))
	for id := range servers {
		serverIDs = append(serverIDs, id)
	}
	sort.Slice(serverIDs, func(i, j int) bool { return serverIDs[i] < serverIDs[j] })

	for _, ar := range alerts {
		var rules []rule
		if err := json.Unmarshal([]byte(ar.RulesRaw), &rules); err != nil {
			sum.Notes = append(sum.Notes, fmt.Sprintf("alert rule %d (%s): cannot parse rules_raw, skipped", ar.ID, ar.Name))
			continue
		}
		kept := make([]rule, 0, len(rules))
		changed := false
		for _, r := range rules {
			if !isCycleRule(r.Type) {
				kept = append(kept, r)
				continue
			}
			changed = true
			selected := selectedServers(r, serverIDs)
			for _, sid := range selected {
				updates[sid] = serverUpdate{r: normalizeRule(r)}
			}
			if keepLegacy {
				kept = append(kept, r)
			}
		}
		if changed && !keepLegacy {
			if len(kept) == 0 {
				deleteAlerts[ar.ID] = true
			} else {
				raw, err := json.Marshal(kept)
				if err != nil {
					return err
				}
				updatedAlerts[ar.ID] = string(raw)
			}
		}
	}

	sum.CycleServersUpdated = len(updates)
	sum.AlertRulesUpdated = len(updatedAlerts)
	sum.AlertRulesDeleted = len(deleteAlerts)

	if dryRun {
		return printSummary(sum)
	}

	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	for sid, u := range updates {
		_, err := tx.Exec(`UPDATE servers SET cycle_transfer_enabled = 1, cycle_transfer_type = ?, cycle_transfer_max = ?, cycle_transfer_start = ?, cycle_transfer_interval = ?, cycle_transfer_unit = ? WHERE id = ?`,
			u.r.Type, uint64(u.r.Max), timeValue(u.r.CycleStart), u.r.CycleInterval, u.r.CycleUnit, sid)
		if err != nil {
			return fmt.Errorf("update server %d cycle transfer: %w", sid, err)
		}
	}
	for id, raw := range updatedAlerts {
		_, err := tx.Exec(`UPDATE alert_rules SET rules_raw = ?, updated_at = ? WHERE id = ?`, raw, time.Now(), id)
		if err != nil {
			return fmt.Errorf("update alert rule %d: %w", id, err)
		}
	}
	for id := range deleteAlerts {
		_, err := tx.Exec(`DELETE FROM alert_rules WHERE id = ?`, id)
		if err != nil {
			return fmt.Errorf("delete legacy cycle alert rule %d: %w", id, err)
		}
	}

	if err := tx.Commit(); err != nil {
		return err
	}
	return printSummary(sum)
}

func copyFile(src, dst string) error {
	if err := os.MkdirAll(filepath.Dir(dst), 0o755); err != nil && filepath.Dir(dst) != "." {
		return err
	}
	in, err := os.Open(src)
	if err != nil {
		return err
	}
	defer in.Close()
	out, err := os.OpenFile(dst, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o600)
	if err != nil {
		return err
	}
	defer out.Close()
	if _, err := io.Copy(out, in); err != nil {
		return err
	}
	return out.Sync()
}

func loadServers(db *sql.DB) (map[uint64]server, error) {
	rows, err := db.Query(`SELECT id, COALESCE(name, '') FROM servers`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	m := map[uint64]server{}
	for rows.Next() {
		var s server
		if err := rows.Scan(&s.ID, &s.Name); err != nil {
			return nil, err
		}
		m[s.ID] = s
	}
	return m, rows.Err()
}

func loadAlertRules(db *sql.DB) ([]alertRule, error) {
	rows, err := db.Query(`SELECT id, COALESCE(name, ''), COALESCE(rules_raw, '[]') FROM alert_rules`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []alertRule
	for rows.Next() {
		var ar alertRule
		if err := rows.Scan(&ar.ID, &ar.Name, &ar.RulesRaw); err != nil {
			return nil, err
		}
		out = append(out, ar)
	}
	return out, rows.Err()
}

func ensureCycleColumns(db *sql.DB) error {
	columns, err := tableColumns(db, "servers")
	if err != nil {
		return err
	}
	stmts := map[string]string{
		"cycle_transfer_enabled":  `ALTER TABLE servers ADD COLUMN cycle_transfer_enabled numeric`,
		"cycle_transfer_type":     `ALTER TABLE servers ADD COLUMN cycle_transfer_type TEXT`,
		"cycle_transfer_max":      `ALTER TABLE servers ADD COLUMN cycle_transfer_max INTEGER`,
		"cycle_transfer_start":    `ALTER TABLE servers ADD COLUMN cycle_transfer_start datetime`,
		"cycle_transfer_interval": `ALTER TABLE servers ADD COLUMN cycle_transfer_interval INTEGER`,
		"cycle_transfer_unit":     `ALTER TABLE servers ADD COLUMN cycle_transfer_unit TEXT`,
	}
	order := []string{"cycle_transfer_enabled", "cycle_transfer_type", "cycle_transfer_max", "cycle_transfer_start", "cycle_transfer_interval", "cycle_transfer_unit"}
	for _, col := range order {
		if !columns[col] {
			if _, err := db.Exec(stmts[col]); err != nil {
				return err
			}
		}
	}
	return nil
}

func tableColumns(db *sql.DB, table string) (map[string]bool, error) {
	rows, err := db.Query(`PRAGMA table_info(` + table + `)`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]bool{}
	for rows.Next() {
		var cid int
		var name, typ string
		var notnull int
		var dflt sql.NullString
		var pk int
		if err := rows.Scan(&cid, &name, &typ, &notnull, &dflt, &pk); err != nil {
			return nil, err
		}
		out[name] = true
	}
	return out, rows.Err()
}

func existingTables(db *sql.DB, names []string) ([]string, error) {
	var out []string
	for _, name := range names {
		var n string
		err := db.QueryRow(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, name).Scan(&n)
		if err == nil {
			out = append(out, name)
			continue
		}
		if !errors.Is(err, sql.ErrNoRows) {
			return nil, err
		}
	}
	return out, nil
}

func isCycleRule(t string) bool {
	switch t {
	case "transfer_in_cycle", "transfer_out_cycle", "transfer_all_cycle":
		return true
	default:
		return false
	}
}

func normalizeRule(r rule) rule {
	if r.Type == "" {
		r.Type = "transfer_all_cycle"
	}
	if r.Max < 0 {
		r.Max = 0
	}
	if r.CycleInterval == 0 {
		r.CycleInterval = 1
	}
	r.CycleUnit = strings.ToLower(r.CycleUnit)
	switch r.CycleUnit {
	case "hour", "day", "week", "month", "year":
	default:
		r.CycleUnit = "month"
	}
	if r.CycleStart == nil || r.CycleStart.IsZero() {
		now := time.Now()
		r.CycleStart = &now
	}
	return r
}

func selectedServers(r rule, all []uint64) []uint64 {
	if r.Cover == 1 { // RuleCoverIgnoreAll: only selected ids in Ignore map
		ids := make([]uint64, 0, len(r.Ignore))
		for sid, selected := range r.Ignore {
			if selected {
				ids = append(ids, sid)
			}
		}
		sort.Slice(ids, func(i, j int) bool { return ids[i] < ids[j] })
		return ids
	}
	ids := make([]uint64, 0, len(all))
	for _, sid := range all {
		if r.Ignore != nil && r.Ignore[sid] {
			continue
		}
		ids = append(ids, sid)
	}
	return ids
}

func timeValue(t *time.Time) any {
	if t == nil {
		return nil
	}
	return t.UTC().Format(time.RFC3339Nano)
}

func printSummary(s summary) error {
	b, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return err
	}
	fmt.Println(string(b))
	return nil
}
