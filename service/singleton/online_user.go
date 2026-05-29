package singleton

import (
	"sync"

	"github.com/nezhahq/nezha/model"
)

var (
	OnlineUserMap     = make(map[string]*model.OnlineUser)
	OnlineUserMapLock sync.Mutex
)

func AddOnlineUser(connId string, user *model.OnlineUser) {
	OnlineUserMapLock.Lock()
	defer OnlineUserMapLock.Unlock()
	OnlineUserMap[connId] = user
}

func RemoveOnlineUser(connId string) {
	OnlineUserMapLock.Lock()
	defer OnlineUserMapLock.Unlock()
	delete(OnlineUserMap, connId)
}

func GetOnlineUserCount() int {
	OnlineUserMapLock.Lock()
	defer OnlineUserMapLock.Unlock()
	return len(OnlineUserMap)
}
