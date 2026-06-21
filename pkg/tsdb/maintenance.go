package tsdb

import (
	"log"
)

func (db *TSDB) Maintenance() {
	db.mu.RLock()
	defer db.mu.RUnlock()
	if db.closed {
		return
	}

	log.Println("KULIN>> TSDB starting maintenance (flush)...")
	db.storage.DebugFlush()
	log.Println("KULIN>> TSDB maintenance completed")
}
