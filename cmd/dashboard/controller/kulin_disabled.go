package controller

import (
	"errors"

	"github.com/gin-gonic/gin"
)

func disabledFeature(name string) func(*gin.Context) (any, error) {
	return func(c *gin.Context) (any, error) {
		return nil, errors.New(name + " 已在精简版哪吒中禁用")
	}
}
