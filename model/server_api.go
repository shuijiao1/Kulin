package model

import "time"

type StreamServer struct {
	ID           uint64 `json:"id,omitempty"`
	Name         string `json:"name,omitempty"`
	PublicNote   string `json:"public_note,omitempty"`   // 公开备注，只第一个数据包有值
	DisplayIndex int    `json:"display_index,omitempty"` // 展示排序，越大越靠前

	Host        *Host      `json:"host,omitempty"`
	State       *HostState `json:"state,omitempty"`
	CountryCode string     `json:"country_code,omitempty"`
	LastActive  time.Time  `json:"last_active,omitempty"`
}

type StreamServerData struct {
	Now     int64          `json:"now,omitempty"`
	Online  int            `json:"online,omitempty"`
	Servers []StreamServer `json:"servers,omitempty"`
}

type ServerForm struct {
	Name         string `json:"name,omitempty"`
	Note         string `json:"note,omitempty" validate:"optional"`           // 管理员可见备注
	PublicNote   string `json:"public_note,omitempty" validate:"optional"`    // 公开备注
	DisplayIndex int    `json:"display_index,omitempty" default:"0"`          // 展示排序，越大越靠前
	HideForGuest bool   `json:"hide_for_guest,omitempty" validate:"optional"` // 对游客隐藏

	CycleTransferEnabled  bool       `json:"cycle_transfer_enabled,omitempty" validate:"optional"`
	CycleTransferType     string     `json:"cycle_transfer_type,omitempty" validate:"optional"`
	CycleTransferMax      uint64     `json:"cycle_transfer_max,omitempty" validate:"optional"`
	CycleTransferStart    *time.Time `json:"cycle_transfer_start,omitempty" validate:"optional"`
	CycleTransferInterval uint64     `json:"cycle_transfer_interval,omitempty" validate:"optional"`
	CycleTransferUnit     string     `json:"cycle_transfer_unit,omitempty" validate:"optional"`
}

type ServerConfigForm struct {
	Servers []uint64 `json:"servers,omitempty"`
	Config  string   `json:"config,omitempty"`
}

type ServerTaskResponse struct {
	Success []uint64 `json:"success,omitempty" validate:"optional"`
	Failure []uint64 `json:"failure,omitempty" validate:"optional"`
	Offline []uint64 `json:"offline,omitempty" validate:"optional"`
}
