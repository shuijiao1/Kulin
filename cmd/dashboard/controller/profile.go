package controller

import (
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"

	"github.com/shuijiao1/Kulin/model"
	"github.com/shuijiao1/Kulin/service/singleton"
)

func getProfile(c *gin.Context) (*model.Profile, error) {
	u, ok := c.Get(model.CtxKeyAuthorizedUser)
	if !ok {
		return nil, singleton.Localizer.ErrorT("unauthorized")
	}
	user := u.(*model.User)
	return &model.Profile{
		ID:        user.ID,
		Username:  user.Username,
		Role:      user.Role,
		AvatarURL: user.AvatarURL,
		LoginIP:   c.ClientIP(),
	}, nil
}

func getAgentSecret(c *gin.Context) (*model.AgentSecretResponse, error) {
	return &model.AgentSecretResponse{AgentSecret: singleton.Conf.AgentSecretKey}, nil
}

func updateProfile(c *gin.Context) (any, error) {
	u, ok := c.Get(model.CtxKeyAuthorizedUser)
	if !ok {
		return nil, singleton.Localizer.ErrorT("unauthorized")
	}
	user := u.(*model.User)
	var pf model.ProfileForm
	if err := c.ShouldBindJSON(&pf); err != nil {
		return nil, err
	}
	if pf.OriginalPassword == "" || bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(pf.OriginalPassword)) != nil {
		return nil, singleton.Localizer.ErrorT("permission denied")
	}
	updates := map[string]any{}
	if pf.NewUsername != "" {
		updates["username"] = pf.NewUsername
	}
	if pf.AvatarURL != "" {
		updates["avatar_url"] = pf.AvatarURL
	}
	if pf.NewPassword != "" {
		hash, err := bcrypt.GenerateFromPassword([]byte(pf.NewPassword), bcrypt.DefaultCost)
		if err != nil {
			return nil, err
		}
		updates["password"] = string(hash)
		updates["token_version"] = user.TokenVersion + 1
	}
	if len(updates) == 0 {
		return nil, nil
	}
	if err := singleton.DB.Model(&model.User{}).Where("id = ?", user.ID).Updates(updates).Error; err != nil {
		return nil, newGormError("%v", err)
	}
	return nil, nil
}

type liteServerGroupResponse struct {
	Group   any      `json:"group"`
	Servers []uint64 `json:"servers"`
}

func listServerGroup(c *gin.Context) ([]liteServerGroupResponse, error) {
	return []liteServerGroupResponse{}, nil
}
