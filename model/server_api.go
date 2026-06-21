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

	TrafficProgressEnabled bool   `json:"traffic_progress_enabled,omitempty"`
	TrafficProgressMode    string `json:"traffic_progress_mode,omitempty"`
	TrafficProgressLimit   uint64 `json:"traffic_progress_limit,omitempty"`
}

type StreamServerData struct {
	Now     int64          `json:"now,omitempty"`
	Online  int            `json:"online,omitempty"`
	Servers []StreamServer `json:"servers,omitempty"`
}

type ServerForm struct {
	Name                   string `json:"name,omitempty"`
	Note                   string `json:"note,omitempty" validate:"optional"`        // 管理员可见备注
	PublicNote             string `json:"public_note,omitempty" validate:"optional"` // 公开备注
	DisplayIndex           int    `json:"display_index,omitempty" default:"0"`       // 展示排序，越大越靠前
	HideForGuest           bool   `json:"hide_for_guest,omitempty" validate:"optional"`
	TrafficProgressEnabled bool   `json:"traffic_progress_enabled,omitempty" validate:"optional"`
	TrafficProgressMode    string `json:"traffic_progress_mode,omitempty" validate:"optional"`
	TrafficProgressLimit   uint64 `json:"traffic_progress_limit,omitempty" validate:"optional"`
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
