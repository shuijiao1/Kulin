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
	loginRateLimitMaxKeys  = 4096
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

func loginRateLimitIPKey(ip string) string {
	return ip + "\x00*"
}

func (l *loginRateLimiter) prune(now time.Time) {
	for key, bucket := range l.buckets {
		if !bucket.lockedUntil.IsZero() {
			if now.After(bucket.lockedUntil) {
				delete(l.buckets, key)
			}
			continue
		}
		if bucket.firstFailed.IsZero() || now.Sub(bucket.firstFailed) > loginRateLimitWindow {
			delete(l.buckets, key)
		}
	}
	if len(l.buckets) > loginRateLimitMaxKeys {
		l.buckets = make(map[string]loginFailureBucket)
	}
}

func (l *loginRateLimiter) blockedLocked(now time.Time, key string) bool {
	bucket, ok := l.buckets[key]
	if !ok {
		return false
	}
	if !bucket.lockedUntil.IsZero() && now.Before(bucket.lockedUntil) {
		return true
	}
	return false
}

func (l *loginRateLimiter) Blocked(ip, username string) bool {
	now := time.Now()
	key := loginRateLimitKey(ip, username)

	l.mu.Lock()
	defer l.mu.Unlock()
	l.prune(now)

	return l.blockedLocked(now, loginRateLimitIPKey(ip)) || l.blockedLocked(now, key)
}

func (l *loginRateLimiter) RecordFailure(ip, username string) {
	now := time.Now()

	l.mu.Lock()
	defer l.mu.Unlock()
	l.prune(now)

	l.recordFailureLocked(now, loginRateLimitIPKey(ip))
	l.recordFailureLocked(now, loginRateLimitKey(ip, username))
}

func (l *loginRateLimiter) recordFailureLocked(now time.Time, key string) {
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
	delete(l.buckets, loginRateLimitIPKey(ip))
	l.mu.Unlock()
}
