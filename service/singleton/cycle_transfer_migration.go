package singleton

import (
	"log"
	"time"

	"gorm.io/gorm"

	"github.com/nezhahq/nezha/model"
)

// migrateCycleTransferRulesToServers moves legacy cycle-transfer alert rules into
// per-server settings. Kulin no longer exposes traffic-bar configuration in
// alert rules, but existing installs may still have those rows in SQLite.
func migrateCycleTransferRulesToServers() error {
	if !DB.Migrator().HasColumn(&model.Server{}, "cycle_transfer_enabled") {
		return nil
	}

	var servers []model.Server
	if err := DB.Find(&servers).Error; err != nil {
		return err
	}
	serverIDs := make([]uint64, 0, len(servers))
	for _, server := range servers {
		serverIDs = append(serverIDs, server.ID)
	}

	var alerts []model.AlertRule
	if err := DB.Find(&alerts).Error; err != nil {
		return err
	}

	serverUpdates := make(map[uint64]model.Rule)
	var changedAlerts []model.AlertRule
	var deleteAlertIDs []uint64
	for _, alert := range alerts {
		if len(alert.Rules) == 0 {
			continue
		}
		kept := make([]*model.Rule, 0, len(alert.Rules))
		changed := false
		for _, rule := range alert.Rules {
			if rule == nil || !rule.IsTransferDurationRule() {
				kept = append(kept, rule)
				continue
			}
			changed = true
			for _, sid := range selectedServersForCycleTransferRule(rule, serverIDs) {
				serverUpdates[sid] = *rule
			}
		}
		if changed {
			if len(kept) == 0 {
				deleteAlertIDs = append(deleteAlertIDs, alert.ID)
			} else {
				alert.Rules = kept
				changedAlerts = append(changedAlerts, alert)
			}
		}
	}

	if len(serverUpdates) == 0 && len(changedAlerts) == 0 && len(deleteAlertIDs) == 0 {
		return nil
	}

	if err := DB.Transaction(func(tx *gorm.DB) error {
		for serverID, rule := range serverUpdates {
			start := normalizeCycleTransferStart(rule.CycleStart)
			interval := rule.CycleInterval
			if interval == 0 {
				interval = 1
			}
			unit := rule.CycleUnit
			if unit == "" {
				unit = "month"
			}
			if err := tx.Model(&model.Server{}).Where("id = ?", serverID).Updates(map[string]any{
				"cycle_transfer_enabled":  true,
				"cycle_transfer_type":     rule.Type,
				"cycle_transfer_max":      uint64(rule.Max),
				"cycle_transfer_start":    start,
				"cycle_transfer_interval": interval,
				"cycle_transfer_unit":     unit,
			}).Error; err != nil {
				return err
			}
		}
		for _, alert := range changedAlerts {
			if err := tx.Save(&alert).Error; err != nil {
				return err
			}
		}
		if len(deleteAlertIDs) > 0 {
			if err := tx.Unscoped().Delete(&model.AlertRule{}, "id IN ?", deleteAlertIDs).Error; err != nil {
				return err
			}
		}
		return nil
	}); err != nil {
		return err
	}

	log.Printf("NEZHA>> migrated %d cycle transfer server setting(s), updated %d alert rule(s), removed %d legacy cycle transfer alert rule(s)", len(serverUpdates), len(changedAlerts), len(deleteAlertIDs))
	return nil
}

func selectedServersForCycleTransferRule(rule *model.Rule, allServerIDs []uint64) []uint64 {
	if rule == nil {
		return nil
	}
	var ids []uint64
	switch rule.Cover {
	case model.RuleCoverIgnoreAll:
		for sid, selected := range rule.Ignore {
			if selected {
				ids = append(ids, sid)
			}
		}
	default:
		ignored := rule.Ignore
		for _, sid := range allServerIDs {
			if ignored != nil && ignored[sid] {
				continue
			}
			ids = append(ids, sid)
		}
	}
	return ids
}

func normalizeCycleTransferStart(t *time.Time) *time.Time {
	if t == nil || t.IsZero() {
		now := time.Now()
		return &now
	}
	return t
}
