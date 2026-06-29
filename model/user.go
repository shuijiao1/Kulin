package model

import (
	"time"

	"github.com/gorilla/websocket"
	"github.com/shuijiao1/Kulin/pkg/utils"
	"gorm.io/gorm"
)

type Role uint8

func (r Role) IsAdmin() bool {
	return r == RoleAdmin
}

const (
	RoleAdmin Role = 0
)

const DefaultAgentSecretLength = 32

type User struct {
	Common
	Username     string `json:"username,omitempty" gorm:"uniqueIndex"`
	Password     string `json:"-" gorm:"type:char(72)"`
	Role         Role   `json:"role"`
	AgentSecret  string `json:"-" gorm:"type:char(32)"`
	AvatarURL    string `json:"avatar_url,omitempty"`
	TokenVersion uint64 `json:"-" gorm:"not null;default:0"`
}

type UserInfo struct {
	Role        Role
	Username    string
	AgentSecret string
}

func (u *User) BeforeSave(tx *gorm.DB) error {
	if u.AgentSecret != "" {
		return nil
	}

	key, err := utils.GenerateRandomString(DefaultAgentSecretLength)
	if err != nil {
		return err
	}

	u.AgentSecret = key
	return nil
}

type Profile struct {
	ID        uint64 `json:"id,omitempty"`
	Username  string `json:"username,omitempty"`
	Role      Role   `json:"role"`
	AvatarURL string `json:"avatar_url,omitempty"`
	LoginIP   string `json:"login_ip,omitempty"`
}

type AgentSecretResponse struct {
	AgentSecret string `json:"agent_secret,omitempty"`
}

// OnlineUser is retained only for internal connection counters in lite/single-admin mode.
type OnlineUser struct {
	ConnectedAt time.Time `json:"connected_at,omitempty"`
	IP          string    `json:"ip,omitempty"`

	Conn *websocket.Conn `json:"-"`
}
