package model

import (
	"slices"
	"strings"
	"time"

	"gorm.io/gorm"

	"github.com/nezhahq/nezha/pkg/utils"
)

const (
	RuleCoverAll = iota
	RuleCoverIgnoreAll
)

type NResult struct {
	N uint64
}

type Rule struct {
	// 指标类型，cpu、memory、swap、disk、net_in_speed、net_out_speed
	// net_all_speed、transfer_in、transfer_out、transfer_all、offline
	Type string  `json:"type"`
	Min  float64 `json:"min,omitempty" validate:"optional"` // 最小阈值 (百分比、字节 kb ÷ 1024)
	Max  float64 `json:"max,omitempty" validate:"optional"` // 最大阈值 (百分比、字节 kb ÷ 1024)
	// Deprecated: cycle transfer alert fields are kept only to reject legacy alert-rule payloads.
	CycleStart    *time.Time      `json:"cycle_start,omitempty" validate:"optional"`
	CycleInterval uint64          `json:"cycle_interval,omitempty" validate:"optional"`
	CycleUnit     string          `json:"cycle_unit,omitempty" enums:"hour,day,week,month,year" validate:"optional" default:"hour"`
	Duration      uint64          `json:"duration,omitempty" validate:"optional"` // 持续时间 (秒)
	Cover         uint64          `json:"cover"`                                  // 覆盖范围 RuleCoverAll/IgnoreAll
	Ignore        map[uint64]bool `json:"ignore,omitempty" validate:"optional"`   // 覆盖范围的排除

	// 只作为缓存使用，记录下次该检测的时间
	NextTransferAt  map[uint64]time.Time `json:"-"`
	LastCycleStatus map[uint64]bool      `json:"-"`
}

func percentage(used, total uint64) float64 {
	if total == 0 {
		return 0
	}
	return float64(used) * 100 / float64(total)
}

// Snapshot 未通过规则返回 false, 通过返回 true
func (u *Rule) Snapshot(cycleTransferStats *CycleTransferStats, server *Server, db *gorm.DB) bool {
	// 监控全部但是排除了此服务器
	if u.Cover == RuleCoverAll && u.Ignore[server.ID] {
		return true
	}
	// 忽略全部但是指定监控了此服务器
	if u.Cover == RuleCoverIgnoreAll && !u.Ignore[server.ID] {
		return true
	}

	var src float64

	switch u.Type {
	case "cpu":
		src = float64(server.State.CPU)
	case "gpu_max":
		src = slices.Max(server.State.GPU)
	case "memory":
		src = percentage(server.State.MemUsed, server.Host.MemTotal)
	case "swap":
		src = percentage(server.State.SwapUsed, server.Host.SwapTotal)
	case "disk":
		src = percentage(server.State.DiskUsed, server.Host.DiskTotal)
	case "net_in_speed":
		src = float64(server.State.NetInSpeed)
	case "net_out_speed":
		src = float64(server.State.NetOutSpeed)
	case "net_all_speed":
		src = float64(server.State.NetOutSpeed + server.State.NetOutSpeed)
	case "transfer_in":
		src = float64(server.State.NetInTransfer)
	case "transfer_out":
		src = float64(server.State.NetOutTransfer)
	case "transfer_all":
		src = float64(server.State.NetOutTransfer + server.State.NetInTransfer)
	case "offline":
		if server.LastActive.IsZero() {
			src = 0
		} else {
			src = float64(server.LastActive.Unix())
		}
	case "transfer_in_cycle":
		src = float64(utils.SubUintChecked(server.State.NetInTransfer, server.PrevTransferInSnapshot))
		if u.CycleInterval != 0 {
			var res NResult
			db.Model(&Transfer{}).Select("SUM(`in`) AS n").Where("datetime(`created_at`) >= datetime(?) AND server_id = ?", u.GetTransferDurationStart().UTC(), server.ID).Scan(&res)
			src += float64(res.N)
		}
	case "transfer_out_cycle":
		src = float64(utils.SubUintChecked(server.State.NetOutTransfer, server.PrevTransferOutSnapshot))
		if u.CycleInterval != 0 {
			var res NResult
			db.Model(&Transfer{}).Select("SUM(`out`) AS n").Where("datetime(`created_at`) >= datetime(?) AND server_id = ?", u.GetTransferDurationStart().UTC(), server.ID).Scan(&res)
			src += float64(res.N)
		}
	case "transfer_all_cycle":
		src = float64(utils.SubUintChecked(server.State.NetOutTransfer, server.PrevTransferOutSnapshot) + utils.SubUintChecked(server.State.NetInTransfer, server.PrevTransferInSnapshot))
		if u.CycleInterval != 0 {
			var res NResult
			db.Model(&Transfer{}).Select("SUM(`in`+`out`) AS n").Where("datetime(`created_at`) >= datetime(?) AND server_id = ?", u.GetTransferDurationStart().UTC(), server.ID).Scan(&res)
			src += float64(res.N)
		}
	case "load1":
		src = server.State.Load1
	case "load5":
		src = server.State.Load5
	case "load15":
		src = server.State.Load15
	case "tcp_conn_count":
		src = float64(server.State.TcpConnCount)
	case "udp_conn_count":
		src = float64(server.State.UdpConnCount)
	case "process_count":
		src = float64(server.State.ProcessCount)
	case "temperature_max":
		var temp []float64
		if server.State.Temperatures != nil {
			for _, tempStat := range server.State.Temperatures {
				if tempStat.Temperature != 0 {
					temp = append(temp, tempStat.Temperature)
				}
			}
			src = slices.Max(temp)
		}
	}

	if u.IsTransferDurationRule() {
		u.UpdateCycleTransferStats(cycleTransferStats, server, src)
	}

	if u.Type == "offline" && float64(time.Now().Unix())-src > 6 {
		return false
	} else if (u.Max > 0 && src > u.Max) || (u.Min > 0 && src < u.Min) {
		return false
	}

	return true
}

func (u *Rule) UpdateCycleTransferStats(cycleTransferStats *CycleTransferStats, server *Server, src float64) {
	if cycleTransferStats == nil || server == nil {
		return
	}
	seconds := 180.0
	if u.Max > 0 {
		seconds = max(1800*((u.Max-src)/u.Max), 180)
	}
	if u.NextTransferAt == nil {
		u.NextTransferAt = make(map[uint64]time.Time)
	}
	if u.LastCycleStatus == nil {
		u.LastCycleStatus = make(map[uint64]bool)
	}
	u.NextTransferAt[server.ID] = time.Now().Add(time.Second * time.Duration(seconds))
	if (u.Max > 0 && src > u.Max) || (u.Min > 0 && src < u.Min) {
		u.LastCycleStatus[server.ID] = false
	} else {
		u.LastCycleStatus[server.ID] = true
	}
	if cycleTransferStats.ServerName == nil {
		cycleTransferStats.ServerName = make(map[uint64]string)
	}
	if cycleTransferStats.Transfer == nil {
		cycleTransferStats.Transfer = make(map[uint64]uint64)
	}
	if cycleTransferStats.NextUpdate == nil {
		cycleTransferStats.NextUpdate = make(map[uint64]time.Time)
	}
	if cycleTransferStats.ServerName[server.ID] != server.Name {
		cycleTransferStats.ServerName[server.ID] = server.Name
	}
	cycleTransferStats.Transfer[server.ID] = uint64(src)
	cycleTransferStats.NextUpdate[server.ID] = u.NextTransferAt[server.ID]
	// 自动更新周期流量展示起止时间
	cycleTransferStats.From = u.GetTransferDurationStart()
	cycleTransferStats.To = u.GetTransferDurationEnd()
}

// IsTransferDurationRule 判断该规则是否属于已废弃的通知规则周期流量类型。
// 周期流量条设置已迁移到服务器编辑页；这里只用于拒绝旧通知规则配置。
func (u *Rule) IsTransferDurationRule() bool {
	switch u.Type {
	case "transfer_in_cycle", "transfer_out_cycle", "transfer_all_cycle":
		return true
	default:
		return false
	}
}

func (u *Rule) IsOfflineRule() bool {
	return u.Type == "offline"
}

// GetTransferDurationStart 获取周期流量的起始时间
func (u *Rule) GetTransferDurationStart() time.Time {
	// Accept uppercase and lowercase
	unit := strings.ToLower(u.CycleUnit)
	startTime := *u.CycleStart
	var nextTime time.Time
	switch unit {
	case "year":
		nextTime = startTime.AddDate(int(u.CycleInterval), 0, 0)
		for time.Now().After(nextTime) {
			startTime = nextTime
			nextTime = nextTime.AddDate(int(u.CycleInterval), 0, 0)
		}
	case "month":
		nextTime = startTime.AddDate(0, int(u.CycleInterval), 0)
		for time.Now().After(nextTime) {
			startTime = nextTime
			nextTime = nextTime.AddDate(0, int(u.CycleInterval), 0)
		}
	case "week":
		nextTime = startTime.AddDate(0, 0, 7*int(u.CycleInterval))
		for time.Now().After(nextTime) {
			startTime = nextTime
			nextTime = nextTime.AddDate(0, 0, 7*int(u.CycleInterval))
		}
	case "day":
		nextTime = startTime.AddDate(0, 0, int(u.CycleInterval))
		for time.Now().After(nextTime) {
			startTime = nextTime
			nextTime = nextTime.AddDate(0, 0, int(u.CycleInterval))
		}
	default:
		// For hour unit or not set.
		interval := 3600 * int64(u.CycleInterval)
		startTime = time.Unix(u.CycleStart.Unix()+(time.Now().Unix()-u.CycleStart.Unix())/interval*interval, 0)
	}

	return startTime
}

// GetTransferDurationEnd 获取周期流量结束时间
func (u *Rule) GetTransferDurationEnd() time.Time {
	// Accept uppercase and lowercase
	unit := strings.ToLower(u.CycleUnit)
	startTime := *u.CycleStart
	var nextTime time.Time
	switch unit {
	case "year":
		nextTime = startTime.AddDate(int(u.CycleInterval), 0, 0)
		for time.Now().After(nextTime) {
			startTime = nextTime
			nextTime = nextTime.AddDate(int(u.CycleInterval), 0, 0)
		}
	case "month":
		nextTime = startTime.AddDate(0, int(u.CycleInterval), 0)
		for time.Now().After(nextTime) {
			startTime = nextTime
			nextTime = nextTime.AddDate(0, int(u.CycleInterval), 0)
		}
	case "week":
		nextTime = startTime.AddDate(0, 0, 7*int(u.CycleInterval))
		for time.Now().After(nextTime) {
			startTime = nextTime
			nextTime = nextTime.AddDate(0, 0, 7*int(u.CycleInterval))
		}
	case "day":
		nextTime = startTime.AddDate(0, 0, int(u.CycleInterval))
		for time.Now().After(nextTime) {
			startTime = nextTime
			nextTime = nextTime.AddDate(0, 0, int(u.CycleInterval))
		}
	default:
		// For hour unit or not set.
		interval := 3600 * int64(u.CycleInterval)
		startTime = time.Unix(u.CycleStart.Unix()+(time.Now().Unix()-u.CycleStart.Unix())/interval*interval, 0)
		nextTime = time.Unix(startTime.Unix()+interval, 0)
	}

	return nextTime
}
