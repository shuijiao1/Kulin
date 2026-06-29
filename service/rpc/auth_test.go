package rpc

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"google.golang.org/grpc/metadata"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"github.com/shuijiao1/Kulin/model"
	"github.com/shuijiao1/Kulin/service/singleton"
)

func setupAuthTest(t *testing.T) {
	t.Helper()
	oldDB := singleton.DB
	oldConf := singleton.Conf
	oldServerShared := singleton.ServerShared
	oldDashboardUserID := singleton.DashboardUserID
	oldUserInfoMap := singleton.UserInfoMap
	oldAgentSecretToUserID := singleton.AgentSecretToUserId

	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Server{}))

	singleton.DB = db
	singleton.Conf = &singleton.ConfigClass{Config: &model.Config{AgentSecretKey: "global-secret"}}
	singleton.DashboardUserID = 1
	singleton.ServerShared = singleton.NewServerClass()
	singleton.UserInfoMap = map[uint64]model.UserInfo{}
	singleton.AgentSecretToUserId = map[string]uint64{}

	t.Cleanup(func() {
		singleton.DB = oldDB
		singleton.Conf = oldConf
		singleton.ServerShared = oldServerShared
		singleton.DashboardUserID = oldDashboardUserID
		singleton.UserInfoMap = oldUserInfoMap
		singleton.AgentSecretToUserId = oldAgentSecretToUserID
	})
}

func authCtx(secret, uuid string) context.Context {
	pairs := []string{"client-secret", secret}
	if uuid != "" {
		pairs = append(pairs, "client-uuid", uuid)
	}
	return metadata.NewIncomingContext(context.Background(), metadata.Pairs(pairs...))
}

func TestAuthRejectsUnknownUUIDWithoutGlobalSecret(t *testing.T) {
	setupAuthTest(t)

	id, err := (&authHandler{}).Check(authCtx("attacker-secret", "attacker-uuid"))
	require.Error(t, err)
	require.Zero(t, id)

	var count int64
	require.NoError(t, singleton.DB.Model(&model.Server{}).Count(&count).Error)
	require.Zero(t, count)
}

func TestAuthRequiresExplicitUUIDForRegistration(t *testing.T) {
	setupAuthTest(t)

	id, err := (&authHandler{}).Check(authCtx("global-secret", ""))
	require.Error(t, err)
	require.Zero(t, id)

	var count int64
	require.NoError(t, singleton.DB.Model(&model.Server{}).Count(&count).Error)
	require.Zero(t, count)
}

func TestAuthRegistersUnknownUUIDOnlyWithGlobalSecret(t *testing.T) {
	setupAuthTest(t)

	id, err := (&authHandler{}).Check(authCtx("global-secret", "new-agent-uuid"))
	require.NoError(t, err)
	require.NotZero(t, id)

	var server model.Server
	require.NoError(t, singleton.DB.First(&server, id).Error)
	require.Equal(t, "new-agent-uuid", server.UUID)
	require.Equal(t, uint64(1), server.UserID)
}

func TestAuthKeepsExistingServerUUIDSecretCompatibility(t *testing.T) {
	setupAuthTest(t)

	server := model.Server{UUID: "server-uuid"}
	require.NoError(t, singleton.DB.Create(&server).Error)
	singleton.ServerShared.Update(&server, server.UUID)

	id, err := (&authHandler{}).Check(authCtx("server-uuid", "server-uuid"))
	require.NoError(t, err)
	require.Equal(t, server.ID, id)
}
