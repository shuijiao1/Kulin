package singleton

import (
	"iter"

	"github.com/gin-gonic/gin"
	"github.com/robfig/cron/v3"

	"github.com/shuijiao1/Kulin/model"
)

// CronClass is an internal minimal scheduler used by service monitoring,
// traffic snapshots and maintenance jobs. It intentionally exposes no Cron
// API/model management in the lite build.
type CronClass struct{ cron *cron.Cron }

func NewCronClass() *CronClass {
	c := cron.New(cron.WithSeconds(), cron.WithLocation(Loc))
	c.Start()
	return &CronClass{cron: c}
}
func (c *CronClass) AddFunc(spec string, cmd func()) (cron.EntryID, error) {
	return c.cron.AddFunc(spec, cmd)
}
func (c *CronClass) Remove(id cron.EntryID)                              { c.cron.Remove(id) }
func (c *CronClass) SendTriggerTasks(_ []uint64, _ uint64, _ uint64)     {}
func (c *CronClass) Get(uint64) (*model.Cron, bool)                      { return nil, false }
func (c *CronClass) GetSortedList() []*model.Cron                        { return nil }
func (c *CronClass) CheckPermission(*gin.Context, iter.Seq[uint64]) bool { return true }
func (c *CronClass) Delete([]uint64)                                     {}
func (c *CronClass) Stop()                                               { c.cron.Stop() }

func CanReportCronResult(cr *model.Cron, server *model.Server) bool {
	return cr != nil && server != nil
}
