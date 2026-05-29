package model

import (
	"github.com/goccy/go-json"
	"slices"
	"strings"
	"sync/atomic"
	"time"

	pb "github.com/nezhahq/nezha/proto"
)

type Server struct {
	Common

	Name         string `json:"name"`
	UUID         string `json:"uuid,omitempty" gorm:"unique"`
	Note         string `json:"note,omitempty"`           // 管理员可见备注
	PublicNote   string `json:"public_note,omitempty"`    // 公开备注
	DisplayIndex int    `json:"display_index"`            // 展示排序，越大越靠前
	HideForGuest bool   `json:"hide_for_guest,omitempty"` // 对游客隐藏

	CycleTransferEnabled  bool       `json:"cycle_transfer_enabled,omitempty"`  // 启用每服务器周期流量条
	CycleTransferType     string     `json:"cycle_transfer_type,omitempty"`     // transfer_in_cycle/transfer_out_cycle/transfer_all_cycle（内部兼容值）
	CycleTransferMax      uint64     `json:"cycle_transfer_max,omitempty"`      // 周期流量配额（字节）
	CycleTransferStart    *time.Time `json:"cycle_transfer_start,omitempty"`    // 周期开始时间
	CycleTransferInterval uint64     `json:"cycle_transfer_interval,omitempty"` // 周期间隔
	CycleTransferUnit     string     `json:"cycle_transfer_unit,omitempty"`     // hour/day/week/month/year

	Host       *Host      `gorm:"-" json:"host,omitempty"`
	State      *HostState `gorm:"-" json:"state,omitempty"`
	GeoIP      *GeoIP     `gorm:"-" json:"geoip,omitempty"`
	LastActive time.Time  `gorm:"-" json:"last_active,omitempty"`

	// taskStream MUST be accessed only via SetTaskStream / GetTaskStream. Direct
	// field access from outside this file races with the gRPC RequestTask
	// handler that reassigns the stream on every reconnect — a torn read of the
	// two-word interface header would panic on a subsequent .Send call. The
	// atomic.Pointer + holder struct lets us swap the stream lock-free while
	// every reader observes a single, consistent value.
	taskStream  atomic.Pointer[taskStreamHolder]
	ConfigCache chan any `gorm:"-" json:"-"`

	PrevTransferInSnapshot  uint64 `gorm:"-" json:"-"` // 上次数据点时的入站使用量
	PrevTransferOutSnapshot uint64 `gorm:"-" json:"-"` // 上次数据点时的出站使用量
}

func (s *Server) CycleTransferRule() *Rule {
	if s == nil || !s.CycleTransferEnabled || s.CycleTransferMax == 0 || s.CycleTransferStart == nil {
		return nil
	}
	ruleType := s.CycleTransferType
	switch ruleType {
	case "transfer_in_cycle", "transfer_out_cycle", "transfer_all_cycle":
	default:
		ruleType = "transfer_all_cycle"
	}
	interval := s.CycleTransferInterval
	if interval == 0 {
		interval = 1
	}
	unit := strings.ToLower(s.CycleTransferUnit)
	switch unit {
	case "hour", "day", "week", "month", "year":
	default:
		unit = "month"
	}
	return &Rule{
		Type:          ruleType,
		Max:           float64(s.CycleTransferMax),
		CycleStart:    s.CycleTransferStart,
		CycleInterval: interval,
		CycleUnit:     unit,
	}
}

// taskStreamHolder wraps the interface so atomic.Pointer (which requires a
// concrete pointed-to type) can publish it atomically. The previous bare
// field `TaskStream pb.NezhaService_RequestTaskServer` was a plain interface
// value: two words on the heap (type ptr + data ptr). Concurrent assignment
// produced torn reads detectable by `go test -race` and crashable in production.
type taskStreamHolder struct {
	s pb.NezhaService_RequestTaskServer
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

func InitServer(s *Server) {
	s.Host = &Host{}
	s.State = &HostState{}
	s.GeoIP = &GeoIP{}
	s.ConfigCache = make(chan any, 1)
}

func (s *Server) CopyFromRunningServer(old *Server) {
	s.Host = old.Host
	s.State = old.State
	s.GeoIP = old.GeoIP
	s.LastActive = old.LastActive
	// taskStream is an atomic.Pointer; copy the published value rather than
	// the field itself (atomic.Pointer is not safe to copy by value).
	s.SetTaskStream(old.GetTaskStream())
	s.ConfigCache = old.ConfigCache
	s.PrevTransferInSnapshot = old.PrevTransferInSnapshot
	s.PrevTransferOutSnapshot = old.PrevTransferOutSnapshot
}

// ServerOwnerInfo carries the user-facing identity for Server.UserID. It is
// returned by the lookup function installed by the singleton layer; model
// must not import singleton (cycle), so the dependency flows through a
// package-level function variable instead.
type ServerOwnerInfo struct {
	ID       uint64 `json:"id"`
	Username string `json:"username,omitempty"`
}

// ServerOwnerLookup is installed by singleton at startup to resolve a
// Server.UserID into a display-ready owner record. Returns ok=false when
// the uid does not map to a known user; the caller renders that as an
// "unknown user" placeholder so deleted-user rows stay debuggable. Left nil
// in tests / headless contexts so the JSON simply omits the owner field.
var ServerOwnerLookup func(uid uint64) (ServerOwnerInfo, bool)

type serverJSON Server

type serverWithOwner struct {
	*serverJSON
	Owner *ServerOwnerInfo `json:"owner,omitempty"`
}

// MarshalJSON projects Server.UserID into a structured owner field on the
// wire. Server.UserID itself stays `json:"-"` (set on Common) so callers
// that do not need owner info pay nothing and members do not accidentally
// receive raw uid integers. The lookup function is consulted only when
// installed; if absent we still emit a minimal {id} record so clients can
// at least distinguish ownership, except for uid=0 which is the legacy
// global-secret pseudo-owner and is best surfaced as such by the caller's
// translation table on the frontend.
func (s *Server) MarshalJSON() ([]byte, error) {
	owner := &ServerOwnerInfo{ID: s.GetUserID()}
	if ServerOwnerLookup != nil {
		if info, ok := ServerOwnerLookup(owner.ID); ok {
			owner.Username = info.Username
		}
	}
	return json.Marshal(serverWithOwner{
		serverJSON: (*serverJSON)(s),
		Owner:      owner,
	})
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
