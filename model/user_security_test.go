package model

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestUserJSONDoesNotExposeSecrets(t *testing.T) {
	data, err := json.Marshal(User{
		Common:      Common{ID: 1},
		Username:    "admin",
		Password:    "$2a$10$hash",
		Role:        RoleAdmin,
		AgentSecret: "agent-secret",
		AvatarURL:   "https://example.com/avatar.png",
	})
	require.NoError(t, err)
	body := string(data)
	require.NotContains(t, body, "password")
	require.NotContains(t, body, "$2a$10$hash")
	require.NotContains(t, body, "agent_secret")
	require.NotContains(t, body, "agent-secret")
	require.Contains(t, body, "admin")
}

func TestProfileJSONIsSafeDTO(t *testing.T) {
	data, err := json.Marshal(Profile{
		ID:        1,
		Username:  "admin",
		Role:      RoleAdmin,
		AvatarURL: "https://example.com/avatar.png",
		LoginIP:   "203.0.113.10",
	})
	require.NoError(t, err)
	body := string(data)
	require.Contains(t, body, "username")
	require.Contains(t, body, "login_ip")
	require.NotContains(t, body, "password")
	require.NotContains(t, body, "agent_secret")
}
