package model

import (
	"errors"
	"slices"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	pb "github.com/shuijiao1/Kulin/proto"
)

const (
	TrafficProgressModeOut  = "out"
	TrafficProgressModeIn   = "in"
	TrafficProgressModeMax  = "max"
	TrafficProgressModeDual = "dual"

	TrafficProgressLimitUnitGB = "GB"
	TrafficProgressLimitUnitTB = "TB"
)

func NormalizeTrafficProgressLimitUnit(unit string) string {
	switch unit {
	case TrafficProgressLimitUnitTB:
		return TrafficProgressLimitUnitTB
	default:
		return TrafficProgressLimitUnitGB
	}
}

type Server struct {
	Common

	Name                     string     `json:"name"`
	UUID                     string     `json:"uuid,omitempty" gorm:"unique"`
	Note                     string     `json:"note,omitempty"`        // 管理员可见备注
	PublicNote               string     `json:"public_note,omitempty"` // 公开备注
	DisplayIndex             int        `json:"display_index"`         // 展示排序，越大越靠前
	TrafficProgressEnabled   bool       `json:"traffic_progress_enabled,omitempty"`
	TrafficProgressMode      string     `gorm:"default:'out'" json:"traffic_progress_mode,omitempty"`
	TrafficProgressLimit     uint64     `json:"traffic_progress_limit,omitempty"`
	TrafficProgressLimitUnit string     `gorm:"default:'GB'" json:"traffic_progress_limit_unit,omitempty"`
	TrafficProgressStartDay  uint8      `gorm:"default:1" json:"traffic_progress_start_day,omitempty"`
	HomeMonitorID            uint64     `json:"home_monitor_id,omitempty"`
	Host                     *Host      `gorm:"-" json:"host,omitempty"`
	State                    *HostState `gorm:"-" json:"state,omitempty"`
	GeoIP                    *GeoIP     `gorm:"-" json:"geoip,omitempty"`
	LastActive               time.Time  `gorm:"-" json:"last_active,omitempty"`

	// taskStream MUST be accessed only via SetTaskStream / GetTaskStream. Direct
	// field access from outside this file races with the gRPC RequestTask
	// handler that reassigns the stream on every reconnect — a torn read of the
	// two-word interface header would panic on a subsequent .Send call. The
	// atomic.Pointer + holder struct lets us swap the stream lock-free while
	// every reader observes a single, consistent value. The holder also carries
	// the send mutex so CopyFromRunningServer can share it across the old/new
	// *Server objects that briefly co-exist during edit rotations —
	// otherwise two *Server pointers would hold the same gRPC stream behind
	// two independent mutexes, defeating the "one SendMsg goroutine per stream"
	// invariant grpc-go requires.
	taskStream atomic.Pointer[taskStreamHolder]

	PrevTransferInSnapshot  uint64 `gorm:"-" json:"-"` // 上次数据点时的入站使用量
	PrevTransferOutSnapshot uint64 `gorm:"-" json:"-"` // 上次数据点时的出站使用量
}

// taskStreamHolder wraps the interface so atomic.Pointer (which requires a
// concrete pointed-to type) can publish it atomically. The previous bare
// field `TaskStream pb.NezhaService_RequestTaskServer` was a plain interface
// value: two words on the heap (type ptr + data ptr). Concurrent assignment
// produced torn reads detectable by `go test -race` and crashable in production.
//
// sendMu lives on the holder (not on *Server) so it is bound to the stream
// itself: CopyFromRunningServer shares the same holder pointer with the new
// *Server, and SendTask locks via the holder, guaranteeing serialized SendMsg
// even when old/new *Server objects briefly co-exist during edit.
type taskStreamHolder struct {
	s      pb.NezhaService_RequestTaskServer
	sendMu sync.Mutex
}

// SetTaskStream publishes the agent's RequestTask stream so other goroutines
// can deliver tasks to the agent. Pass nil to detach (e.g. on disconnect).
func (s *Server) SetTaskStream(stream pb.NezhaService_RequestTaskServer) {
	if stream == nil {
		s.taskStream.Store(nil)
		return
	}
	s.taskStream.Store(&taskStreamHolder{s: stream})
}

// adoptTaskStreamHolder publishes an existing holder verbatim. Used by
// CopyFromRunningServer so the new *Server shares the send mutex (and the
// underlying stream identity) with the old *Server.
func (s *Server) adoptTaskStreamHolder(h *taskStreamHolder) {
	s.taskStream.Store(h)
}

// ClearTaskStreamIfCurrent detaches stream only if it is still the published
// RequestTask stream. Disconnect cleanup uses this guard so an old stream
// returning after a reconnect cannot erase the newer live stream.
func (s *Server) ClearTaskStreamIfCurrent(stream pb.NezhaService_RequestTaskServer) bool {
	if stream == nil {
		return false
	}
	for {
		h := s.taskStream.Load()
		if h == nil || h.s != stream {
			return false
		}
		if s.taskStream.CompareAndSwap(h, nil) {
			return true
		}
	}
}

// GetTaskStream returns the currently-published stream, or nil if the agent
// is offline. Callers MUST capture the return into a local variable before
// using it — re-reading via GetTaskStream() across a Send call reopens the
// race we're trying to close.
func (s *Server) GetTaskStream() pb.NezhaService_RequestTaskServer {
	h := s.taskStream.Load()
	if h == nil {
		return nil
	}
	return h.s
}

// SendTask dispatches a task on the agent's RequestTask stream under the
// holder's sendMu so concurrent dispatchers (service monitor, keepalive, report-config)
// cannot violate grpc-go's "one SendMsg goroutine per stream" rule. Returns
// ErrTaskStreamOffline if the agent has not published a stream yet; callers
// that need to distinguish offline from send failure should branch on that.
//
// The mutex is keyed by holder (= by stream) rather than by *Server so that
// edit rotations replacing *Server in the singleton map still share
// a single lock across the old and new objects pointing at the same stream.
func (s *Server) SendTask(task *pb.Task) error {
	h := s.taskStream.Load()
	if h == nil {
		return ErrTaskStreamOffline
	}
	h.sendMu.Lock()
	defer h.sendMu.Unlock()
	return h.s.Send(task)
}

// ErrTaskStreamOffline is returned by SendTask when the agent has no
// published RequestTask stream. Defined here (rather than in service/rpc)
// so model-layer callers can branch on it without an import cycle.
var ErrTaskStreamOffline = errors.New("agent task stream offline")

func InitServer(s *Server) {
	s.Host = &Host{}
	s.State = &HostState{}
	s.GeoIP = &GeoIP{}
}

func (s *Server) CopyFromRunningServer(old *Server) {
	s.Host = old.Host
	s.State = old.State
	s.GeoIP = old.GeoIP
	s.LastActive = old.LastActive
	// Adopt the holder pointer verbatim so the new *Server shares the send
	// mutex AND the stream identity with the old *Server; constructing a fresh
	// holder via SetTaskStream(GetTaskStream()) would give the new object its
	// own mutex, letting two *Server pointers race SendMsg on the same stream
	// during the edit rotation window.
	s.adoptTaskStreamHolder(old.taskStream.Load())
	s.PrevTransferInSnapshot = old.PrevTransferInSnapshot
	s.PrevTransferOutSnapshot = old.PrevTransferOutSnapshot
}

func (s *Server) AfterFind(tx *gorm.DB) error {
	if s.TrafficProgressMode == "" {
		s.TrafficProgressMode = TrafficProgressModeOut
	}
	s.TrafficProgressLimitUnit = NormalizeTrafficProgressLimitUnit(s.TrafficProgressLimitUnit)
	return nil
}

func (s *Server) HasPermission(ctx *gin.Context) bool {
	return s.Common.HasPermission(ctx)
}
func (s *Server) SplitList(x []*Server) ([]*Server, []*Server) {
	pri := func(s *Server) bool {
		return s.DisplayIndex == 0
	}

	i := slices.IndexFunc(x, pri)
	if i == -1 {
		return nil, x
	}

	return x[:i], x[i:]
}
