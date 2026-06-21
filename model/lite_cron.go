package model

import (
	"time"

	"github.com/gin-gonic/gin"
	"github.com/goccy/go-json"
	"github.com/robfig/cron/v3"
	"gorm.io/gorm"
)

const (
	CronCoverIgnoreAll = iota
	CronCoverAll
	CronCoverAlertTrigger
	CronTypeCronTask    = 0
	CronTypeTriggerTask = 1
)

type Cron struct {
	Common
	Name                string       `json:"name"`
	TaskType            uint8        `gorm:"default:0" json:"task_type"`
	Scheduler           string       `json:"scheduler"`
	Command             string       `json:"command,omitempty"`
	Servers             []uint64     `gorm:"-" json:"servers"`
	PushSuccessful      bool         `json:"push_successful,omitempty"`
	NotificationGroupID uint64       `json:"notification_group_id"`
	LastExecutedAt      time.Time    `json:"last_executed_at,omitempty"`
	LastResult          bool         `json:"last_result,omitempty"`
	Cover               uint8        `json:"cover"`
	CronJobID           cron.EntryID `gorm:"-" json:"cron_job_id,omitempty"`
	ServersRaw          string       `json:"-"`
}

func (c *Cron) BeforeSave(tx *gorm.DB) error {
	data, err := json.Marshal(c.Servers)
	if err != nil {
		return err
	}
	c.ServersRaw = string(data)
	return nil
}
func (c *Cron) AfterFind(tx *gorm.DB) error         { return json.Unmarshal([]byte(c.ServersRaw), &c.Servers) }
func (c *Cron) HasPermission(ctx *gin.Context) bool { return c.Common.HasPermission(ctx) }
func (c *Cron) CronSpec() string                    { return c.Scheduler }
