package controller

import (
	"errors"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net/http"
	"os"
	"regexp"
	"slices"
	"strings"

	jwt "github.com/appleboy/gin-jwt/v2"
	"github.com/gin-contrib/pprof"
	"github.com/gin-gonic/gin"
	"github.com/shuijiao1/Kulin/model"
	"github.com/shuijiao1/Kulin/pkg/utils"
	"github.com/shuijiao1/Kulin/service/singleton"
)

func ServeWeb(frontendDist fs.FS) http.Handler {
	gin.SetMode(gin.ReleaseMode)
	r := gin.Default()

	if singleton.Conf.Debug {
		gin.SetMode(gin.DebugMode)
		pprof.Register(r)
	}
	r.Use(recordPath)

	routers(r, frontendDist)

	return r
}

func routers(r *gin.Engine, frontendDist fs.FS) {
	authMiddleware, err := jwt.New(initParams())
	if err != nil {
		log.Fatal("JWT Error:" + err.Error())
	}
	if err := authMiddleware.MiddlewareInit(); err != nil {
		log.Fatal("authMiddleware.MiddlewareInit Error:" + err.Error())
	}

	api := r.Group("api/v1")
	api.POST("/login", authMiddleware.LoginHandler)

	fallbackAuthMw := fallbackAuthMiddleware(authMiddleware)
	fallbackAuth := api.Group("", fallbackAuthMw)
	fallbackAuth.GET("/setting", commonHandler(listConfig))

	jwtMw := authMiddleware.MiddlewareFunc()
	optionalAuth := api.Group("", fallbackAuthMw)
	optionalAuth.GET("/ws/server", commonHandler(serverStream))
	optionalAuth.GET("/server-group", commonHandler(listServerGroup))
	optionalAuth.GET("/service", commonHandler(showService))
	optionalAuth.GET("/service/server", commonHandler(listServerWithServices))
	optionalAuth.GET("/service/:id/history", commonHandler(getServiceHistory))
	optionalAuth.GET("/server/:id/service", commonHandler(listServerServices))
	optionalAuth.GET("/server/:id/metrics", commonHandler(getServerMetrics))

	auth := api.Group("", jwtMw, csrfMiddleware())
	auth.POST("/refresh-token", authMiddleware.RefreshHandler)
	auth.GET("/profile", commonHandler(getProfile))
	auth.POST("/profile", commonHandler(updateProfile))
	auth.POST("/agent-secret", adminHandler(getAgentSecret))
	auth.GET("/server", listHandler(listServer))
	auth.PATCH("/server/:id", commonHandler(updateServer))
	auth.GET("/server/:id/service-binding", commonHandler(getServerServiceBinding))
	auth.PATCH("/server/:id/service-binding", commonHandler(updateServerServiceBinding))
	auth.POST("/batch-delete/server", commonHandler(batchDeleteServer))

	auth.GET("/service/list", listHandler(listService))
	auth.POST("/service", commonHandler(createService))
	auth.PATCH("/service/:id", commonHandler(updateService))
	auth.POST("/batch-delete/service", commonHandler(batchDeleteService))

	auth.GET("/notification", listHandler(listNotification))
	auth.POST("/notification", commonHandler(createNotification))
	auth.PATCH("/notification/:id", commonHandler(updateNotification))
	auth.POST("/batch-delete/notification", commonHandler(batchDeleteNotification))

	auth.GET("/alert-rule", listHandler(listAlertRule))
	auth.POST("/alert-rule", commonHandler(createAlertRule))
	auth.PATCH("/alert-rule/:id", commonHandler(updateAlertRule))
	auth.POST("/batch-delete/alert-rule", commonHandler(batchDeleteAlertRule))

	auth.PATCH("/setting", adminHandler(updateConfig))
	auth.POST("/maintenance", adminHandler(runMaintenance))

	r.NoRoute(fallbackToFrontend(frontendDist))
}

func recordPath(c *gin.Context) {
	url := c.Request.URL.Path
	for _, p := range c.Params {
		url = strings.Replace(url, p.Value, ":"+p.Key, 1)
	}
	c.Set("MatchedPath", url)
}

func newErrorResponse(err error) model.CommonResponse[any] {
	return model.CommonResponse[any]{
		Success: false,
		Error:   err.Error(),
	}
}

type handlerFunc[T any] func(c *gin.Context) (T, error)
type pHandlerFunc[S ~[]E, E any] func(c *gin.Context) (*model.Value[S], error)

// There are many error types in gorm, so create a custom type to represent all
// gorm errors here instead
type gormError struct {
	msg string
	a   []any
}

func newGormError(format string, args ...any) error {
	return &gormError{
		msg: format,
		a:   args,
	}
}

func (ge *gormError) Error() string {
	return fmt.Sprintf(ge.msg, ge.a...)
}

type wsError struct {
	msg string
	a   []any
}

func newWsError(format string, args ...any) error {
	return &wsError{
		msg: format,
		a:   args,
	}
}

func (we *wsError) Error() string {
	return fmt.Sprintf(we.msg, we.a...)
}

var errNoop = errors.New("wrote")

func commonHandler[T any](handler handlerFunc[T]) func(*gin.Context) {
	return func(c *gin.Context) {
		handle(c, handler)
	}
}

func adminHandler[T any](handler handlerFunc[T]) func(*gin.Context) {
	return func(c *gin.Context) {
		auth, ok := c.Get(model.CtxKeyAuthorizedUser)
		if !ok {
			c.JSON(http.StatusOK, newErrorResponse(singleton.Localizer.ErrorT("unauthorized")))
			return
		}

		user := *auth.(*model.User)
		if !user.Role.IsAdmin() {
			c.JSON(http.StatusOK, newErrorResponse(singleton.Localizer.ErrorT("permission denied")))
			return
		}

		handle(c, handler)
	}
}

func handle[T any](c *gin.Context, handler handlerFunc[T]) {
	data, err := handler(c)
	if err == nil {
		c.JSON(http.StatusOK, model.CommonResponse[T]{Success: true, Data: data})
		return
	}
	switch err.(type) {
	case *gormError:
		log.Printf("KULIN>> gorm error: %v", err)
		c.JSON(http.StatusOK, newErrorResponse(singleton.Localizer.ErrorT("database error")))
		return
	case *wsError:
		// Connection is upgraded to WebSocket, so c.Writer is no longer usable
		if msg := err.Error(); msg != "" {
			log.Printf("KULIN>> websocket error: %v", err)
		}
		return
	default:
		if !errors.Is(err, errNoop) {
			c.JSON(http.StatusOK, newErrorResponse(err))
		}
		return
	}
}

func listHandler[S ~[]E, E model.CommonInterface](handler handlerFunc[S]) func(*gin.Context) {
	return func(c *gin.Context) {
		data, err := handler(c)
		if err != nil {
			c.JSON(http.StatusOK, newErrorResponse(err))
			return
		}

		filtered := filter(c, data)
		c.JSON(http.StatusOK, model.CommonResponse[S]{Success: true, Data: model.SearchByIDCtx(c, filtered)})
	}
}

func pCommonHandler[S ~[]E, E any](handler pHandlerFunc[S, E]) func(*gin.Context) {
	return func(c *gin.Context) {
		data, err := handler(c)
		if err != nil {
			c.JSON(http.StatusOK, newErrorResponse(err))
			return
		}

		c.JSON(http.StatusOK, model.PaginatedResponse[S, E]{Success: true, Data: data})
	}
}

func pAdminHandler[S ~[]E, E any](handler pHandlerFunc[S, E]) func(*gin.Context) {
	return func(c *gin.Context) {
		auth, ok := c.Get(model.CtxKeyAuthorizedUser)
		if !ok {
			c.JSON(http.StatusOK, newErrorResponse(singleton.Localizer.ErrorT("unauthorized")))
			return
		}
		user := *auth.(*model.User)
		if !user.Role.IsAdmin() {
			c.JSON(http.StatusOK, newErrorResponse(singleton.Localizer.ErrorT("permission denied")))
			return
		}

		data, err := handler(c)
		if err != nil {
			c.JSON(http.StatusOK, newErrorResponse(err))
			return
		}

		c.JSON(http.StatusOK, model.PaginatedResponse[S, E]{Success: true, Data: data})
	}
}

func filter[S ~[]E, E model.CommonInterface](ctx *gin.Context, s S) S {
	return slices.DeleteFunc(s, func(e E) bool {
		return !e.HasPermission(ctx)
	})
}

func getUid(c *gin.Context) uint64 {
	user, _ := c.MustGet(model.CtxKeyAuthorizedUser).(*model.User)
	return user.ID
}

func fallbackToFrontend(frontendDist fs.FS) func(*gin.Context) {
	serveFile := func(c *gin.Context, name string, file fs.File, customStatusCode int) bool {
		defer file.Close()
		fileStat, err := file.Stat()
		if err != nil {
			return false
		}
		if fileStat.IsDir() {
			return false
		}
		readSeeker, ok := file.(io.ReadSeeker)
		if !ok {
			return false
		}
		http.ServeContent(utils.NewGinCustomWriter(c, customStatusCode), c.Request, name, fileStat.ModTime(), readSeeker)
		return true
	}

	checkLocalFileOrFs := func(c *gin.Context, frontendFS fs.FS, templateRoot, filePath string, customStatusCode int) bool {
		if filePath != "" {
			localRoot, err := os.OpenRoot(templateRoot)
			if err == nil {
				defer localRoot.Close()
				// URL paths must stay inside the selected template root; never join them against the process cwd.
				if file, err := localRoot.Open(filePath); err == nil && serveFile(c, filePath, file, customStatusCode) {
					return true
				}
			}
		}

		if !fs.ValidPath(filePath) {
			return false
		}
		templateFS, err := fs.Sub(frontendFS, templateRoot)
		if err != nil {
			return false
		}
		file, err := templateFS.Open(filePath)
		if err != nil {
			return false
		}
		if serveFile(c, filePath, file, customStatusCode) {
			return true
		}
		return false
	}

	frontendPageUrlRegistry := []*regexp.Regexp{
		// official user frontend
		regexp.MustCompile(`^/$`),
		regexp.MustCompile(`^/server/\d*$`),
		// backend frontend
		regexp.MustCompile(`^/dashboard/$`),
		regexp.MustCompile(`^/dashboard/login$`),
		regexp.MustCompile(`^/dashboard/service$`),
		regexp.MustCompile(`^/dashboard/notification$`),
		regexp.MustCompile(`^/dashboard/alert-rule$`),
		regexp.MustCompile(`^/dashboard/settings$`),
		regexp.MustCompile(`^/dashboard/settings/waf$`),
		regexp.MustCompile(`^/dashboard/settings/api-tokens$`),
		// 注意：这里的白名单决定哪些 URL 走 index.html fallback；漏一条就会把
		// 直接刷新该页面变成 404（HTTP 状态码层面，body 仍是 index.html，所以
		// 浏览器内 SPA 看起来正常，但 monitoring / 链接预览会以为站点挂了）。
		// 新增前端路由时必须在 admin-frontend/src/main.tsx 与这里同步加。
	}

	getFallbackStatusCode := func(path string) int {
		for _, reg := range frontendPageUrlRegistry {
			if reg.MatchString(path) {
				return http.StatusOK
			}
		}
		return http.StatusNotFound
	}

	return func(c *gin.Context) {
		if strings.HasPrefix(c.Request.URL.Path, "/api") {
			c.JSON(http.StatusNotFound, newErrorResponse(errors.New("404 Not Found")))
			return
		}

		// redirect for /dashboard to /dashboard/
		if c.Request.URL.Path == "/dashboard" {
			c.Redirect(http.StatusMovedPermanently, "/dashboard/")
			return
		}

		fallbackStatusCode := getFallbackStatusCode(c.Request.URL.Path)
		// Only /dashboard/ belongs to the admin frontend; /dashboard.. must not be trimmed into ../.
		if strings.HasPrefix(c.Request.URL.Path, "/dashboard/") {
			stripPath := strings.TrimPrefix(c.Request.URL.Path, "/dashboard/")
			if checkLocalFileOrFs(c, frontendDist, singleton.Conf.AdminTemplate, stripPath, http.StatusOK) {
				return
			}
			if !checkLocalFileOrFs(c, frontendDist, singleton.Conf.AdminTemplate, "index.html", fallbackStatusCode) {
				c.JSON(http.StatusNotFound, newErrorResponse(errors.New("404 Not Found")))
			}
			return
		}
		stripPath := strings.TrimPrefix(c.Request.URL.Path, "/")
		if checkLocalFileOrFs(c, frontendDist, singleton.Conf.UserTemplate, stripPath, http.StatusOK) {
			return
		}
		if !checkLocalFileOrFs(c, frontendDist, singleton.Conf.UserTemplate, "index.html", fallbackStatusCode) {
			c.JSON(http.StatusNotFound, newErrorResponse(errors.New("404 Not Found")))
		}
	}
}
