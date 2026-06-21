package model

// Lite build keeps only database shapes required by remaining core code.
type DDNSProfile struct{ Common }

type NAT struct {
	Common
	Enabled  bool   `json:"enabled"`
	Name     string `json:"name"`
	ServerID uint64 `json:"server_id"`
	Host     string `json:"host"`
	Domain   string `json:"domain" gorm:"unique"`
}

type MCPAuditLog struct{ Common }
