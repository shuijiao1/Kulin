package controller

import (
	"encoding/json"
	"errors"
	"slices"
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jinzhu/copier"
	"gorm.io/gorm"

	"github.com/shuijiao1/Kulin/model"
	"github.com/shuijiao1/Kulin/pkg/tsdb"
	pb "github.com/shuijiao1/Kulin/proto"
	"github.com/shuijiao1/Kulin/service/singleton"
)

// List server
// @Summary List server
// @Security BearerAuth
// @Security APITokenAuth
// @Schemes
// @Description List server. PAT scope required: nezha:inventory:read.
// @Tags auth required
// @Param id query uint false "Resource ID"
// @Produce json
// @Success 200 {object} model.CommonResponse[[]model.Server]
// @Router /server [get]
func listServer(c *gin.Context) ([]*model.Server, error) {
	slist := singleton.ServerShared.GetSortedList()

	var ssl []*model.Server
	if err := copier.Copy(&ssl, &slist); err != nil {
		return nil, err
	}
	return ssl, nil
}

// Edit server
// @Summary Edit server
// @Security BearerAuth
// @Schemes
// @Description Edit server
// @Tags auth required
// @Accept json
// @Param id path uint true "Server ID"
// @Param body body model.ServerForm true "ServerForm"
// @Produce json
// @Success 200 {object} model.CommonResponse[any]
// @Router /server/{id} [patch]
func updateServer(c *gin.Context) (any, error) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		return nil, err
	}
	var raw map[string]json.RawMessage
	if err := c.ShouldBindJSON(&raw); err != nil {
		return nil, err
	}
	var sf model.ServerForm
	for key, value := range raw {
		switch key {
		case "name":
			_ = json.Unmarshal(value, &sf.Name)
		case "note":
			_ = json.Unmarshal(value, &sf.Note)
		case "public_note":
			_ = json.Unmarshal(value, &sf.PublicNote)
		case "display_index":
			_ = json.Unmarshal(value, &sf.DisplayIndex)
		case "hide_for_guest":
			_ = json.Unmarshal(value, &sf.HideForGuest)
		case "traffic_progress_enabled":
			_ = json.Unmarshal(value, &sf.TrafficProgressEnabled)
		case "traffic_progress_mode":
			_ = json.Unmarshal(value, &sf.TrafficProgressMode)
		case "traffic_progress_limit":
			_ = json.Unmarshal(value, &sf.TrafficProgressLimit)
		case "traffic_progress_start_day":
			_ = json.Unmarshal(value, &sf.TrafficProgressStartDay)
		case "home_monitor_id":
			_ = json.Unmarshal(value, &sf.HomeMonitorID)
		}
	}

	var s model.Server
	if err := singleton.DB.First(&s, id).Error; err != nil {
		return nil, singleton.Localizer.ErrorT("server id %d does not exist", id)
	}

	if !s.HasPermission(c) {
		return nil, singleton.Localizer.ErrorT("permission denied")
	}

	if _, ok := raw["name"]; ok {
		s.Name = sf.Name
	}
	if _, ok := raw["display_index"]; ok {
		s.DisplayIndex = sf.DisplayIndex
	}
	if _, ok := raw["note"]; ok {
		s.Note = sf.Note
	}
	if _, ok := raw["public_note"]; ok {
		s.PublicNote = sf.PublicNote
	}
	if _, ok := raw["hide_for_guest"]; ok {
		s.HideForGuest = sf.HideForGuest
	}
	if _, ok := raw["traffic_progress_enabled"]; ok {
		s.TrafficProgressEnabled = sf.TrafficProgressEnabled
	}
	if _, ok := raw["traffic_progress_mode"]; ok {
		s.TrafficProgressMode = sf.TrafficProgressMode
	}
	if s.TrafficProgressMode == "" {
		s.TrafficProgressMode = model.TrafficProgressModeOut
	}
	if _, ok := raw["traffic_progress_limit"]; ok {
		s.TrafficProgressLimit = sf.TrafficProgressLimit
	}
	if _, ok := raw["traffic_progress_start_day"]; ok {
		if sf.TrafficProgressStartDay < 1 {
			sf.TrafficProgressStartDay = 1
		}
		if sf.TrafficProgressStartDay > 31 {
			sf.TrafficProgressStartDay = 31
		}
		s.TrafficProgressStartDay = sf.TrafficProgressStartDay
	}
	if _, ok := raw["home_monitor_id"]; ok {
		s.HomeMonitorID = sf.HomeMonitorID
	}

	if err := singleton.DB.Save(&s).Error; err != nil {
		return nil, newGormError("%v", err)
	}

	rs, _ := singleton.ServerShared.Get(s.ID)
	s.CopyFromRunningServer(rs)
	singleton.ServerShared.Update(&s, "")

	return nil, nil
}

func getServerServiceBinding(c *gin.Context) (map[uint64]bool, error) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		return nil, err
	}
	server, ok := singleton.ServerShared.Get(id)
	if !ok || server == nil || !server.HasPermission(c) {
		return nil, singleton.Localizer.ErrorT("permission denied")
	}
	var services []*model.Service
	if err := singleton.DB.Find(&services).Error; err != nil {
		return nil, newGormError("%v", err)
	}
	ret := make(map[uint64]bool, len(services))
	for _, svc := range services {
		if svc.Type != model.TaskTypeHTTPGet && svc.Type != model.TaskTypeICMPPing && svc.Type != model.TaskTypeTCPPing {
			continue
		}
		if svc.SkipServers == nil {
			_ = svc.AfterFind(singleton.DB)
		}
		covered := false
		switch svc.Cover {
		case model.ServiceCoverAll:
			covered = !svc.SkipServers[id]
		case model.ServiceCoverIgnoreAll:
			covered = svc.SkipServers[id]
		}
		ret[svc.ID] = covered
	}
	return ret, nil
}

func updateServerServiceBinding(c *gin.Context) (any, error) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		return nil, err
	}
	server, ok := singleton.ServerShared.Get(id)
	if !ok || server == nil || !server.HasPermission(c) {
		return nil, singleton.Localizer.ErrorT("permission denied")
	}
	var wanted map[uint64]bool
	if err := c.ShouldBindJSON(&wanted); err != nil {
		return nil, err
	}
	var services []*model.Service
	if err := singleton.DB.Find(&services).Error; err != nil {
		return nil, newGormError("%v", err)
	}
	for _, svc := range services {
		want, touched := wanted[svc.ID]
		if !touched || (svc.Type != model.TaskTypeHTTPGet && svc.Type != model.TaskTypeICMPPing && svc.Type != model.TaskTypeTCPPing) {
			continue
		}
		if svc.SkipServers == nil {
			_ = svc.AfterFind(singleton.DB)
		}
		if svc.SkipServers == nil {
			svc.SkipServers = map[uint64]bool{}
		}
		// Kulin uses explicit include mode for server-side binding edits.
		svc.Cover = model.ServiceCoverIgnoreAll
		if want {
			svc.SkipServers[id] = true
		} else {
			delete(svc.SkipServers, id)
		}
		if err := singleton.DB.Save(svc).Error; err != nil {
			return nil, newGormError("%v", err)
		}
		if err := singleton.ServiceSentinelShared.Update(svc); err != nil {
			return nil, err
		}
	}
	singleton.ServiceSentinelShared.UpdateServiceList()
	return nil, nil
}

// Batch delete server
// @Summary Batch delete server
// @Security BearerAuth
// @Schemes
// @Description Batch delete server
// @Tags auth required
// @Accept json
// @param request body []uint64 true "id list"
// @Produce json
// @Success 200 {object} model.CommonResponse[any]
// @Router /batch-delete/server [post]
func batchDeleteServer(c *gin.Context) (any, error) {
	var servers []uint64
	if err := c.ShouldBindJSON(&servers); err != nil {
		return nil, err
	}

	if !singleton.ServerShared.CheckPermission(c, slices.Values(servers)) {
		return nil, singleton.Localizer.ErrorT("permission denied")
	}

	err := singleton.DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Unscoped().Delete(&model.Server{}, "id in (?)", servers).Error; err != nil {
			return err
		}
		return nil
	})

	if err != nil {
		return nil, newGormError("%v", err)
	}

	singleton.AlertsLock.Lock()
	for _, sid := range servers {
		for _, alert := range singleton.Alerts {
			if singleton.AlertsCycleTransferStatsStore[alert.ID] != nil {
				delete(singleton.AlertsCycleTransferStatsStore[alert.ID].ServerName, sid)
				delete(singleton.AlertsCycleTransferStatsStore[alert.ID].Transfer, sid)
				delete(singleton.AlertsCycleTransferStatsStore[alert.ID].NextUpdate, sid)
			}
		}
	}
	singleton.DB.Unscoped().Delete(&model.Transfer{}, "server_id in (?)", servers)
	singleton.AlertsLock.Unlock()

	// Cancel any in-flight transfers BEFORE the in-memory ServerShared
	// entry is dropped: the order shortens the window in which a
	// concurrent Retry/Register could install a fresh pending entry for
	// the same serverID and have it wiped by the cleanup. The
	// transferID-guarded delete inside OnServersDeleted is the
	// authoritative protection against that race; the ordering here is
	// belt and braces.
	singleton.ServerShared.Delete(servers)
	return nil, nil
}

// Force update Agent
// @Summary Force update Agent
// @Security BearerAuth
// @Schemes
// @Description Force update Agent
// @Tags auth required
// @Accept json
// @param request body []uint64 true "id list"
// @Produce json
// @Success 200 {object} model.CommonResponse[model.ServerTaskResponse]
// @Router /force-update/server [post]
func forceUpdateServer(c *gin.Context) (*model.ServerTaskResponse, error) {
	var forceUpdateServers []uint64
	if err := c.ShouldBindJSON(&forceUpdateServers); err != nil {
		return nil, err
	}

	forceUpdateResp := new(model.ServerTaskResponse)

	for _, sid := range forceUpdateServers {
		server, _ := singleton.ServerShared.Get(sid)
		// Per-ID ownership check. Foreign servers (online or offline) and
		// unknown IDs MUST be indistinguishable in the response — otherwise the
		// response shape leaks server-ID existence/online-state, letting a
		// RoleMember enumerate other users' machines. We drop them into the
		// Offline bucket without actually dispatching the upgrade task.
		if server == nil || !server.HasPermission(c) {
			forceUpdateResp.Offline = append(forceUpdateResp.Offline, sid)
			continue
		}
		if server.GetTaskStream() != nil {
			if err := server.SendTask(&pb.Task{
				Type: model.TaskTypeUpgrade,
			}); err != nil {
				if errors.Is(err, model.ErrTaskStreamOffline) {
					forceUpdateResp.Offline = append(forceUpdateResp.Offline, sid)
				} else {
					forceUpdateResp.Failure = append(forceUpdateResp.Failure, sid)
				}
			} else {
				forceUpdateResp.Success = append(forceUpdateResp.Success, sid)
			}
		} else {
			forceUpdateResp.Offline = append(forceUpdateResp.Offline, sid)
		}
	}

	return forceUpdateResp, nil
}

// Get server config
// @Summary Get server config
// @Security BearerAuth
// @Schemes
// @Description Get server config
// @Tags auth required
// @Produce json
// @Success 200 {object} model.CommonResponse[string]
// @Router /server/config/{id} [get]
func getServerConfig(c *gin.Context) (string, error) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		return "", err
	}

	s, ok := singleton.ServerShared.Get(id)
	if !ok {
		return "", nil
	}
	if !s.HasPermission(c) {
		return "", singleton.Localizer.ErrorT("permission denied")
	}
	if s.GetTaskStream() == nil {
		return "", nil
	}

	if err := s.SendTask(&pb.Task{
		Type: model.TaskTypeReportConfig,
	}); err != nil {
		if errors.Is(err, model.ErrTaskStreamOffline) {
			return "", nil
		}
		return "", err
	}

	timeout := time.NewTimer(time.Second * 10)
	select {
	case <-timeout.C:
		return "", singleton.Localizer.ErrorT("operation timeout")
	case data := <-s.ConfigCache:
		timeout.Stop()
		switch data := data.(type) {
		case string:
			return data, nil
		case error:
			return "", singleton.Localizer.ErrorT("get server config failed: %v", data)
		}
	}

	return "", singleton.Localizer.ErrorT("get server config failed")
}

// Set server config
// @Summary Set server config
// @Security BearerAuth
// @Schemes
// @Description Set server config
// @Tags auth required
// @Accept json
// @Param body body model.ServerConfigForm true "ServerConfigForm"
// @Produce json
// @Success 200 {object} model.CommonResponse[model.ServerTaskResponse]
// @Router /server/config [post]
func setServerConfig(c *gin.Context) (*model.ServerTaskResponse, error) {
	var configForm model.ServerConfigForm
	if err := c.ShouldBindJSON(&configForm); err != nil {
		return nil, err
	}

	var resp model.ServerTaskResponse
	slist := singleton.ServerShared.GetList()
	servers := make([]*model.Server, 0, len(configForm.Servers))
	for _, sid := range configForm.Servers {
		if s, ok := slist[sid]; ok {
			if !s.HasPermission(c) {
				return nil, singleton.Localizer.ErrorT("permission denied")
			}
			if s.GetTaskStream() == nil {
				resp.Offline = append(resp.Offline, s.ID)
				continue
			}
			servers = append(servers, s)
		}
	}

	var wg sync.WaitGroup
	var respMu sync.Mutex

	for i := 0; i < len(servers); i += 10 {
		end := min(i+10, len(servers))
		group := servers[i:end]

		wg.Add(1)
		go func(srvGroup []*model.Server) {
			defer wg.Done()
			for _, s := range srvGroup {
				task := &pb.Task{
					Type: model.TaskTypeApplyConfig,
					Data: configForm.Config,
				}
				if s.GetTaskStream() == nil {
					respMu.Lock()
					resp.Offline = append(resp.Offline, s.ID)
					respMu.Unlock()
					continue
				}
				if err := s.SendTask(task); err != nil {
					respMu.Lock()
					if errors.Is(err, model.ErrTaskStreamOffline) {
						resp.Offline = append(resp.Offline, s.ID)
					} else {
						resp.Failure = append(resp.Failure, s.ID)
					}
					respMu.Unlock()
					continue
				}
				respMu.Lock()
				resp.Success = append(resp.Success, s.ID)
				respMu.Unlock()
			}
		}(group)
	}

	wg.Wait()
	return &resp, nil
}

func getServerMetrics(c *gin.Context) (*model.ServerMetricsResponse, error) {
	idStr := c.Param("id")
	serverID, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		return nil, err
	}

	server, ok := singleton.ServerShared.Get(serverID)
	if !ok {
		return nil, singleton.Localizer.ErrorT("server not found")
	}

	if !userCanViewServer(c, server) {
		return nil, singleton.Localizer.ErrorT("unauthorized")
	}
	_, isMember := c.Get(model.CtxKeyAuthorizedUser)

	metricName := c.Query("metric")
	metricType, ok := serverMetricMap[metricName]
	if !ok {
		return nil, singleton.Localizer.ErrorT("invalid metric name")
	}

	periodStr := c.DefaultQuery("period", "1d")
	period, err := tsdb.ParseQueryPeriod(periodStr)
	if err != nil {
		return nil, err
	}

	if !isMember && period != tsdb.Period1Day {
		return nil, singleton.Localizer.ErrorT("unauthorized: only 1d data available for guests")
	}

	response := &model.ServerMetricsResponse{
		ServerID:   serverID,
		ServerName: server.Name,
		Metric:     metricName,
		DataPoints: make([]model.ServerMetricsDataPoint, 0),
	}

	if !singleton.TSDBEnabled() {
		return response, nil
	}

	points, err := singleton.TSDBShared.QueryServerMetrics(serverID, metricType, period)
	if err != nil {
		return nil, err
	}

	response.DataPoints = points

	return response, nil
}
