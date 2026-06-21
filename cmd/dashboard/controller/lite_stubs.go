package controller

import (
	"github.com/gin-gonic/gin"
	"github.com/shuijiao1/Kulin/model"
	"github.com/shuijiao1/Kulin/service/singleton"
)

type liteAPIToken struct{}

func (*liteAPIToken) ServerIDs() []uint64         { return nil }
func (*liteAPIToken) CanAccessServer(uint64) bool { return true }

func APITokenFromContext(*gin.Context) *liteAPIToken                    { return nil }
func registerPATConnection(*gin.Context, func()) func()                 { return func() {} }
func enforcePATTriggerTaskScope(*gin.Context, ...[]uint64) error        { return nil }
func enforcePATServiceDispatchScope(*gin.Context, *model.Service) error { return nil }
func rejectImplicitServiceCoverForLimitedPAT(*gin.Context, uint8, map[uint64]bool, uint64) error {
	return nil
}
func assertOwnsNotificationGroup(*gin.Context, uint64) error                              { return nil }
func PurgeTransferEntries() int                                                           { return 0 }
func checkServiceSkipServerPermission(*gin.Context, uint8, map[uint64]bool, uint64) error { return nil }
func isValidServiceCover(cover uint8) bool {
	return cover == model.ServiceCoverAll || cover == model.ServiceCoverIgnoreAll
}
func filterCycleTransferStatsForViewer(_ *gin.Context, stats map[uint64]model.CycleTransferStats) map[uint64]model.CycleTransferStats {
	return stats
}
func runMaintenance(*gin.Context) (any, error) { singleton.PerformMaintenance(); return nil, nil }

func callerIsAdmin(c *gin.Context) bool {
	u, ok := c.Get(model.CtxKeyAuthorizedUser)
	if !ok {
		return false
	}
	user, _ := u.(*model.User)
	return user != nil && user.Role.IsAdmin()
}
func patAllowsServer(*gin.Context, uint64) bool { return true }
func userCanViewServer(c *gin.Context, server *model.Server) bool {
	if server == nil {
		return false
	}
	u, ok := c.Get(model.CtxKeyAuthorizedUser)
	if !ok {
		return !server.HideForGuest
	}
	user, _ := u.(*model.User)
	return user != nil && (user.Role.IsAdmin() || server.GetUserID() == user.ID || !server.HideForGuest)
}
func userCanViewService(c *gin.Context, service *model.Service) bool {
	if service == nil {
		return false
	}
	u, ok := c.Get(model.CtxKeyAuthorizedUser)
	if !ok {
		return !service.HideForGuest
	}
	user, _ := u.(*model.User)
	return user != nil && (user.Role.IsAdmin() || service.GetUserID() == user.ID || !service.HideForGuest)
}
