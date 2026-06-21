package rpc

func (h *NezhaHandler) RevokeStreamsForPurpose(string) int { return 0 }
func CancelAllMCPInflight() int                            { return 0 }

const PurposeMCPTransfer = "mcp-transfer"

func SetMCPKillSwitchObserver(func() bool) {}
