package singleton

import (
	"fmt"
	"sync"

	"github.com/shuijiao1/Kulin/model"
	"github.com/shuijiao1/Kulin/pkg/utils"
)

var (
	UserInfoMap         map[uint64]model.UserInfo
	AgentSecretToUserId map[string]uint64

	UserLock sync.RWMutex
)

func initUser() {
	UserInfoMap = make(map[uint64]model.UserInfo)
	AgentSecretToUserId = make(map[string]uint64)

	var users []model.User
	DB.Find(&users)

	// for backward compatibility
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

		UserInfoMap[u.ID] = model.UserInfo{
			Role:        u.Role,
			Username:    u.Username,
			AgentSecret: u.AgentSecret,
		}
		AgentSecretToUserId[u.AgentSecret] = u.ID
	}

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

func OnUserDelete(id []uint64, errorFunc func(string, ...any) error) error {
	if len(id) < 1 {
		return Localizer.ErrorT("user id not specified")
	}
	return errorFunc("Kulin only supports one administrator account")
}

func userIsAdmin(uid uint64) bool {
	UserLock.RLock()
	defer UserLock.RUnlock()
	return UserInfoMap[uid].Role.IsAdmin()
}
