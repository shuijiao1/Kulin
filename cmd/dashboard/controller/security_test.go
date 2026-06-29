package controller

import (
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"

	"github.com/shuijiao1/Kulin/model"
	"github.com/shuijiao1/Kulin/service/singleton"
)

func TestForceAuthBlocksGuestLiteViews(t *testing.T) {
	oldConf := singleton.Conf
	singleton.Conf = &singleton.ConfigClass{Config: &model.Config{ForceAuth: true}}
	t.Cleanup(func() { singleton.Conf = oldConf })

	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	require.False(t, userCanViewServer(c, &model.Server{}))
	require.False(t, userCanViewService(c, &model.Service{}))

	c.Set(model.CtxKeyAuthorizedUser, &model.User{Role: model.RoleAdmin})
	require.True(t, userCanViewServer(c, &model.Server{}))
	require.True(t, userCanViewService(c, &model.Service{}))
}

func TestRecordPathDropsQueryString(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	req := httptest.NewRequest("GET", "/api/v1/profile?token=secret&x=1", nil)
	c.Request = req
	c.Params = gin.Params{{Key: "id", Value: "profile"}}

	recordPath(c)

	matched, ok := c.Get("MatchedPath")
	require.True(t, ok)
	require.Equal(t, "/api/v1/:id", matched)
}

func TestLoginLimiterBlocksUsernameSprayByIP(t *testing.T) {
	limiter := &loginRateLimiter{buckets: make(map[string]loginFailureBucket)}
	ip := "203.0.113.10"
	for _, username := range []string{"a", "b", "c", "d", "e"} {
		require.False(t, limiter.Blocked(ip, username))
		limiter.RecordFailure(ip, username)
	}
	require.True(t, limiter.Blocked(ip, "fresh-username"))

	limiter.RecordSuccess(ip, "fresh-username")
	require.False(t, limiter.Blocked(ip, "fresh-username"))
}

func TestValidateInstallHost(t *testing.T) {
	valid := []string{
		"",
		"shuijiao.li",
		"shuijiao.li:443",
		"https://shuijiao.li",
		"http://127.0.0.1:80",
		"[2001:db8::1]:443",
	}
	for _, host := range valid {
		require.NoError(t, validateInstallHost(host), host)
	}

	invalid := []string{
		"shuijiao.li;touch /tmp/pwned",
		"shuijiao.li && id",
		"shuijiao.li$(id)",
		"https://shuijiao.li/path",
		"https://user@shuijiao.li",
		"shuijiao.li:abc",
		"bad host:443",
		"-bad.example:443",
		"bad-.example:443",
	}
	for _, host := range invalid {
		require.Error(t, validateInstallHost(host), host)
	}
}
