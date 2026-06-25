package singleton

import (
	"testing"

	"github.com/stretchr/testify/require"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"github.com/shuijiao1/Kulin/model"
)

func TestInitUserHardensLegacySingleAdminDatabase(t *testing.T) {
	var err error
	DB, err = gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, DB.AutoMigrate(&model.User{}))
	Conf = &ConfigClass{Config: &model.Config{AgentSecretKey: "agent-secret"}}
	t.Cleanup(func() {
		DB = nil
		Conf = nil
		DashboardUserID = 0
		UserInfoMap = nil
		AgentSecretToUserId = nil
	})

	users := []model.User{
		{Username: "legacy", Password: "$2a$10$legacy", Role: model.RoleAdmin, TokenVersion: 7},
		{Username: "admin", Password: "$2a$10$admin", Role: model.RoleAdmin, TokenVersion: 3},
	}
	require.NoError(t, DB.Create(&users).Error)

	initUser()

	require.Equal(t, users[1].ID, DashboardUserID)
	require.True(t, userIsAdmin(DashboardUserID))
	require.False(t, userIsAdmin(users[0].ID))
	require.Equal(t, users[1].ID, DashboardUserIDOrFallback())

	var legacy model.User
	require.NoError(t, DB.First(&legacy, users[0].ID).Error)
	require.Equal(t, "!single-admin-disabled!", legacy.Password)
	require.Equal(t, uint64(8), legacy.TokenVersion)

	var admin model.User
	require.NoError(t, DB.First(&admin, users[1].ID).Error)
	require.Equal(t, "$2a$10$admin", admin.Password)
	require.Equal(t, uint64(3), admin.TokenVersion)
	require.Equal(t, model.RoleAdmin, admin.Role)
}
