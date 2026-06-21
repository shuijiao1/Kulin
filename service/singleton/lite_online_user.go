package singleton

import "github.com/shuijiao1/Kulin/model"

func AddOnlineUser(string, *model.OnlineUser) {}
func RemoveOnlineUser(string)                 {}
func GetOnlineUserCount() int                 { return 0 }
