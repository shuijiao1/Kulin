package rpc

import (
	"context"
	"fmt"
	"google.golang.org/grpc"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/peer"
	"log"
	"net/netip"

	"github.com/nezhahq/nezha/model"
	"github.com/nezhahq/nezha/pkg/utils"
	"github.com/nezhahq/nezha/proto"
	rpcService "github.com/nezhahq/nezha/service/rpc"
	"github.com/nezhahq/nezha/service/singleton"
)

func ServeRPC() *grpc.Server {
	server := grpc.NewServer(grpc.ChainUnaryInterceptor(getRealIp, waf))
	rpcService.NezhaHandlerSingleton = rpcService.NewNezhaHandler()
	// Install the IOStream revocation hook so ServerTransferShared can tear
	// down terminal/FM sessions held by the previous owner on every
	// ownership rotation (Register/revertTransition/OnServersDeleted).
	singleton.ServerTransferStreamRevocationHook = rpcService.NezhaHandlerSingleton.RevokeStreamsForServer
	proto.RegisterNezhaServiceServer(server, rpcService.NezhaHandlerSingleton)
	return server
}

func waf(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
	realip, _ := ctx.Value(model.CtxKeyRealIP{}).(string)
	if err := model.CheckIP(singleton.DB, realip); err != nil {
		return nil, err
	}
	return handler(ctx, req)
}

func getRealIp(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
	var ip, connectingIp string
	p, ok := peer.FromContext(ctx)
	if ok {
		addrPort, err := netip.ParseAddrPort(p.Addr.String())
		if err == nil {
			connectingIp = addrPort.Addr().String()
		}
	}
	ctx = context.WithValue(ctx, model.CtxKeyConnectingIP{}, connectingIp)

	if singleton.Conf.AgentRealIPHeader == "" {
		return handler(ctx, req)
	}

	if singleton.Conf.AgentRealIPHeader == model.ConfigUsePeerIP {
		if connectingIp == "" {
			return nil, fmt.Errorf("connecting ip not found")
		}
	} else {
		vals := metadata.ValueFromIncomingContext(ctx, singleton.Conf.AgentRealIPHeader)
		if len(vals) == 0 {
			return nil, fmt.Errorf("real ip header not found")
		}
		var err error
		ip, err = utils.GetIPFromHeader(vals[0])
		if err != nil {
			return nil, err
		}
	}

	if singleton.Conf.Debug {
		log.Printf("NEZHA>> gRPC Agent Real IP: %s, connecting IP: %s\n", ip, connectingIp)
	}

	ctx = context.WithValue(ctx, model.CtxKeyRealIP{}, ip)
	return handler(ctx, req)
}

func DispatchTask(serviceSentinelDispatchBus <-chan *model.Service) {
	for task := range serviceSentinelDispatchBus {
		if task == nil {
			continue
		}

		switch task.Cover {
		case model.ServiceCoverIgnoreAll:
			for id, enabled := range task.SkipServers {
				if !enabled {
					continue
				}

				server, _ := singleton.ServerShared.Get(id)
				if server == nil {
					continue
				}
				stream := server.GetTaskStream()
				if stream == nil {
					continue
				}

				if canSendTaskToServer(task, server) {
					stream.Send(task.PB())
				}
			}
		case model.ServiceCoverAll:
			for id, server := range singleton.ServerShared.Range {
				if server == nil || task.SkipServers[id] {
					continue
				}
				stream := server.GetTaskStream()
				if stream == nil {
					continue
				}

				if canSendTaskToServer(task, server) {
					stream.Send(task.PB())
				}
			}
		}
	}
}

func DispatchKeepalive() {
	singleton.CronShared.AddFunc("@every 20s", func() {
		list := singleton.ServerShared.GetSortedList()
		for _, s := range list {
			if s == nil {
				continue
			}
			stream := s.GetTaskStream()
			if stream == nil {
				continue
			}
			stream.Send(&proto.Task{Type: model.TaskTypeKeepalive})
		}
	})
}

func canSendTaskToServer(task *model.Service, server *model.Server) bool {
	var role model.Role
	singleton.UserLock.RLock()
	if u, ok := singleton.UserInfoMap[task.UserID]; !ok {
		role = model.RoleMember
	} else {
		role = u.Role
	}
	singleton.UserLock.RUnlock()

	return task.UserID == server.GetUserID() || role.IsAdmin()
}
