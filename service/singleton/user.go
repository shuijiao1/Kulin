package singleton

import (
	"fmt"
	"log"
	"sync"

	"github.com/shuijiao1/Kulin/model"
	"github.com/shuijiao1/Kulin/pkg/utils"
)

var (
	UserInfoMap         map[uint64]model.UserInfo
	AgentSecretToUserId map[string]uint64
	DashboardUserID     uint64

	UserLock sync.RWMutex
)

func initUser() {
	UserInfoMap = make(map[uint64]model.UserInfo)
	AgentSecretToUserId = make(map[string]uint64)

	var users []model.User
	if err := DB.Order("CASE WHEN username = 'admin' THEN 0 ELSE 1 END, id ASC").Find(&users).Error; err != nil {
		panic(fmt.Errorf("load users failed: %v", err))
	}

	DashboardUserID = chooseDashboardUserID(users)
	if DashboardUserID != 0 {
		if err := hardenSingleAdminUsers(users, DashboardUserID); err != nil {
			panic(err)
		}
	}

	// for backward compatibility with existing agents that use the global secret.
	UserInfoMap[0] = model.UserInfo{
		Role:        model.RoleAdmin,
		AgentSecret: Conf.AgentSecretKey,
	}
	AgentSecretToUserId[Conf.AgentSecretKey] = 0

	for _, u := range users {
		if u.AgentSecret == "" {
			u.AgentSecret = utils.MustGenerateRandomString(model.DefaultAgentSecretLength)
			if err := DB.Save(&u).Error; err != nil {
				panic(fmt.Errorf("update of user %d failed: %v", u.ID, err))
			}
		}
		role := u.Role
		if u.ID == DashboardUserID {
			role = model.RoleAdmin
		}

		UserInfoMap[u.ID] = model.UserInfo{
			Role:        role,
			Username:    u.Username,
			AgentSecret: u.AgentSecret,
		}
		AgentSecretToUserId[u.AgentSecret] = u.ID
	}
}

func chooseDashboardUserID(users []model.User) uint64 {
	for _, u := range users {
		if u.Username == "admin" {
			return u.ID
		}
	}
	if len(users) > 0 {
		return users[0].ID
	}
	return 0
}

func hardenSingleAdminUsers(users []model.User, dashboardUserID uint64) error {
	if len(users) > 1 {
		log.Printf("KULIN>> single-admin mode detected %d legacy users; only user id=%d can log in", len(users), dashboardUserID)
	}
	for _, u := range users {
		updates := map[string]any{"role": model.RoleAdmin}
		if hasColumn("users", "reject_password") {
			updates["reject_password"] = false
		}
		if u.ID != dashboardUserID {
			updates["password"] = "!single-admin-disabled!"
			updates["token_version"] = u.TokenVersion + 1
		}
		if err := DB.Model(&model.User{}).Where("id = ?", u.ID).Updates(updates).Error; err != nil {
			return fmt.Errorf("harden user %d failed: %v", u.ID, err)
		}
	}
	return nil
}

func hasColumn(table, column string) bool {
	rows, err := DB.Raw("PRAGMA table_info(" + table + ")").Rows()
	if err != nil {
		return false
	}
	defer rows.Close()
	for rows.Next() {
		var cid int
		var name, typ string
		var notnull int
		var dflt any
		var pk int
		if err := rows.Scan(&cid, &name, &typ, &notnull, &dflt, &pk); err == nil && name == column {
			return true
		}
	}
	return false
}

func OnUserUpdate(u *model.User) {
	UserLock.Lock()
	defer UserLock.Unlock()

	if u == nil {
		return
	}

	UserInfoMap[u.ID] = model.UserInfo{
		Role:        u.Role,
		Username:    u.Username,
		AgentSecret: u.AgentSecret,
	}
	AgentSecretToUserId[u.AgentSecret] = u.ID
}

func DashboardUserIDOrFallback() uint64 {
	UserLock.RLock()
	defer UserLock.RUnlock()
	if DashboardUserID != 0 {
		return DashboardUserID
	}
	return 1
}

func userIsAdmin(uid uint64) bool { return uid == 0 || uid == DashboardUserID }
