package controller

import "github.com/shuijiao1/Kulin/pkg/tsdb"

var serverMetricMap = map[string]tsdb.MetricType{
	"cpu":              tsdb.MetricServerCPU,
	"mem":              tsdb.MetricServerMemory,
	"swap":             tsdb.MetricServerSwap,
	"disk":             tsdb.MetricServerDisk,
	"net_in_speed":     tsdb.MetricServerNetInSpeed,
	"net_out_speed":    tsdb.MetricServerNetOutSpeed,
	"net_in_transfer":  tsdb.MetricServerNetInTransfer,
	"net_out_transfer": tsdb.MetricServerNetOutTransfer,
}
