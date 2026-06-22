package controller

import (
	"github.com/gin-gonic/gin"
	"github.com/shuijiao1/Kulin/model"
	"github.com/shuijiao1/Kulin/service/singleton"
)

func registerPATConnection(*gin.Context, func()) func()                                   { return func() {} }
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
func userCanViewServer(_ *gin.Context, server *model.Server) bool {
	return server != nil
}
func userCanViewService(_ *gin.Context, service *model.Service) bool {
	return service != nil
}
