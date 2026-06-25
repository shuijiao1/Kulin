package rpc

import (
	"context"
	"errors"
	"fmt"
	"log"

	"google.golang.org/grpc/metadata"

	"github.com/shuijiao1/Kulin/model"
	"github.com/shuijiao1/Kulin/service/singleton"
)

type authHandler struct{}

func (a *authHandler) Check(ctx context.Context) (uint64, error)            { return a.check(ctx) }
func (a *authHandler) CheckRequestTask(ctx context.Context) (uint64, error) { return a.check(ctx) }

func firstUserID() uint64 {
	singleton.UserLock.RLock()
	defer singleton.UserLock.RUnlock()
	for id := range singleton.UserInfoMap {
		return id
	}
	return 1
}

func (a *authHandler) check(ctx context.Context) (uint64, error) {
	md, ok := metadata.FromIncomingContext(ctx)
	if !ok {
		return 0, errors.New("metadata missing")
	}
	first := func(keys ...string) string {
		for _, k := range keys {
			if vals := md.Get(k); len(vals) > 0 {
				return vals[0]
			}
		}
		return ""
	}
	clientSecret := first("client-secret", "client_secret")
	clientUUID := first("client-uuid", "client_uuid")
	if clientSecret == "" {
		return 0, errors.New("unauthorized")
	}
	var clientID uint64
	if idStr := first("client-id", "client_id"); idStr != "" {
		_, _ = fmt.Sscan(idStr, &clientID)
	}
	if clientID == 0 {
		if clientUUID == "" {
			clientUUID = clientSecret
		}
		if id, ok := singleton.ServerShared.UUIDToID(clientUUID); ok {
			clientID = id
		} else {
			server := model.Server{Common: model.Common{UserID: firstUserID()}, UUID: clientUUID}
			if err := singleton.DB.Create(&server).Error; err != nil {
				return 0, err
			}
			singleton.ServerShared.Update(&server, server.UUID)
			log.Printf("KULIN>> Agent registered server id=%d", server.ID)
			return server.ID, nil
		}
	}
	server, ok := singleton.ServerShared.Get(clientID)
	if !ok || server == nil {
		return 0, errors.New("server not found")
	}
	if clientSecret != server.UUID && clientSecret != singleton.Conf.AgentSecretKey {
		return 0, errors.New("unauthorized")
	}
	return clientID, nil
}
