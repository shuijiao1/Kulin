package controller

import (
	"strings"
	"sync"
	"time"
)

const (
	loginRateLimitWindow   = 10 * time.Minute
	loginRateLimitCooldown = 15 * time.Minute
	loginRateLimitMaxFails = 5
)

type loginFailureBucket struct {
	failures    int
	firstFailed time.Time
	lockedUntil time.Time
}

type loginRateLimiter struct {
	mu      sync.Mutex
	buckets map[string]loginFailureBucket
}

var loginLimiter = &loginRateLimiter{buckets: make(map[string]loginFailureBucket)}

func loginRateLimitKey(ip, username string) string {
	return ip + "\x00" + strings.ToLower(strings.TrimSpace(username))
}

func (l *loginRateLimiter) Blocked(ip, username string) bool {
	now := time.Now()
	key := loginRateLimitKey(ip, username)

	l.mu.Lock()
	defer l.mu.Unlock()

	bucket, ok := l.buckets[key]
	if !ok {
		return false
	}
	if !bucket.lockedUntil.IsZero() && now.Before(bucket.lockedUntil) {
		return true
	}
	if now.Sub(bucket.firstFailed) > loginRateLimitWindow {
		delete(l.buckets, key)
	}
	return false
}

func (l *loginRateLimiter) RecordFailure(ip, username string) {
	now := time.Now()
	key := loginRateLimitKey(ip, username)

	l.mu.Lock()
	defer l.mu.Unlock()

	bucket := l.buckets[key]
	if bucket.firstFailed.IsZero() || now.Sub(bucket.firstFailed) > loginRateLimitWindow {
		bucket = loginFailureBucket{firstFailed: now}
	}
	bucket.failures++
	if bucket.failures >= loginRateLimitMaxFails {
		bucket.lockedUntil = now.Add(loginRateLimitCooldown)
	}
	l.buckets[key] = bucket
}

func (l *loginRateLimiter) RecordSuccess(ip, username string) {
	key := loginRateLimitKey(ip, username)
	l.mu.Lock()
	delete(l.buckets, key)
	l.mu.Unlock()
}
