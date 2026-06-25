package controller

import "github.com/shuijiao1/Kulin/pkg/tsdb"

var serverMetricMap = map[string]tsdb.MetricType{
	"cpu":              tsdb.MetricServerCPU,
	"mem":              tsdb.MetricServerMemory,
	"memory":           tsdb.MetricServerMemory,
	"swap":             tsdb.MetricServerSwap,
	"disk":             tsdb.MetricServerDisk,
	"net_in_speed":     tsdb.MetricServerNetInSpeed,
	"net_out_speed":    tsdb.MetricServerNetOutSpeed,
	"net_in_transfer":  tsdb.MetricServerNetInTransfer,
	"net_out_transfer": tsdb.MetricServerNetOutTransfer,
	"load1":            tsdb.MetricServerLoad1,
	"load5":            tsdb.MetricServerLoad5,
	"load15":           tsdb.MetricServerLoad15,
	"tcp_conn":         tsdb.MetricServerTCPConn,
	"udp_conn":         tsdb.MetricServerUDPConn,
	"process_count":    tsdb.MetricServerProcessCount,
	"temperature":      tsdb.MetricServerTemperature,
	"uptime":           tsdb.MetricServerUptime,
	"gpu":              tsdb.MetricServerGPU,
}
