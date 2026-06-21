package rpc

import "github.com/shuijiao1/Kulin/model"

func canSendTaskToServer(task *model.Service, server *model.Server) bool {
	return task != nil && server != nil && server.GetTaskStream() != nil
}
