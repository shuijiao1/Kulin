package controller

import (
	"net/http"
	"time"

	jwt "github.com/appleboy/gin-jwt/v2"
	"github.com/gin-gonic/gin"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"github.com/shuijiao1/Kulin/model"
	"github.com/shuijiao1/Kulin/service/singleton"
)

const jwtClaimUserID = "uid"

func issueJWTSession(c *gin.Context, user *model.User, jwtTimeoutHours int) (map[string]interface{}, error) {
	return map[string]interface{}{jwtClaimUserID: user.ID}, nil
}

func initParams() *jwt.GinJWTMiddleware {
	return &jwt.GinJWTMiddleware{
		Realm:      singleton.Conf.SiteName,
		Key:        []byte(singleton.Conf.JWTSecretKey),
		CookieName: "nz-jwt",
		SendCookie: true,
		// Pin the signing algorithm so a future library default change (or an
		// `alg: none` confusion attempt) cannot weaken token validation.
		SigningAlgorithm: "HS256",
		// Lax blocks cross-site POST CSRF while keeping normal dashboard navigation working.
		// HttpOnly/Secure are intentionally left default: the frontend reads
		// `!!document.cookie` for login-state display and many deployments
		// terminate TLS at a proxy upstream — both warrant a separate change.
		CookieSameSite: http.SameSiteLaxMode,
		Timeout:        time.Hour * time.Duration(singleton.Conf.JWTTimeout),
		MaxRefresh:     time.Hour * time.Duration(singleton.Conf.JWTTimeout),
		IdentityKey:    model.CtxKeyAuthorizedUser,
		PayloadFunc:    payloadFunc(),

		IdentityHandler: identityHandler(),
		Authenticator:   authenticator(),
		Authorizator:    authorizator(),
		Unauthorized:    unauthorized(),
		// query: token still accepted because the WebSocket browser API
		// cannot set Authorization headers; removing it would break the
		// /ws/* routes until the frontend migrates to cookie auth.
		TokenLookup:   "header: Authorization, query: token, cookie: nz-jwt",
		TokenHeadName: "Bearer",
		TimeFunc:      time.Now,

		LoginResponse: func(c *gin.Context, code int, token string, expire time.Time) {
			setCSRFCookie(c)
			c.JSON(http.StatusOK, model.CommonResponse[model.LoginResponse]{
				Success: true,
				Data: model.LoginResponse{
					Token:  token,
					Expire: expire.Format(time.RFC3339),
				},
			})
		},
		RefreshResponse: refreshResponse,
	}
}

func payloadFunc() func(data any) jwt.MapClaims {
	return func(data any) jwt.MapClaims {
		if v, ok := data.(map[string]interface{}); ok {
			return v
		}
		return jwt.MapClaims{}
	}
}

func identityHandler() func(c *gin.Context) any {
	return func(c *gin.Context) any {
		claims := jwt.ExtractClaims(c)
		uidFloat, ok := claims[jwtClaimUserID].(float64)
		if !ok || uidFloat == 0 {
			return nil
		}
		var user model.User
		if err := singleton.DB.First(&user, uint64(uidFloat)).Error; err != nil {
			return nil
		}
		return &user
	}
}

// User Login
// @Summary user login
// @Schemes
// @Description user login
// @Accept json
// @param loginRequest body model.LoginRequest true "Login Request"
// @Produce json
// @Success 200 {object} model.CommonResponse[model.LoginResponse]
// @Router /login [post]
func authenticator() func(c *gin.Context) (any, error) {
	return func(c *gin.Context) (any, error) {
		var loginVals model.LoginRequest
		if err := c.ShouldBind(&loginVals); err != nil {
			return "", jwt.ErrMissingLoginValues
		}

		var user model.User
		if err := singleton.DB.Select("id", "password", "reject_password", "token_version").Where("username = ?", loginVals.Username).First(&user).Error; err != nil {
			if err == gorm.ErrRecordNotFound {
				return nil, jwt.ErrFailedAuthentication
			}
			return nil, jwt.ErrFailedAuthentication
		}

		if user.RejectPassword {
			return nil, jwt.ErrFailedAuthentication
		}

		if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(loginVals.Password)); err != nil {
			return nil, jwt.ErrFailedAuthentication
		}

		return issueJWTSession(c, &user, singleton.Conf.JWTTimeout)
	}
}

func authorizator() func(data any, c *gin.Context) bool {
	return func(data any, c *gin.Context) bool {
		_, ok := data.(*model.User)
		return ok
	}
}

func unauthorized() func(c *gin.Context, code int, message string) {
	return func(c *gin.Context, code int, message string) {
		c.JSON(http.StatusOK, model.CommonResponse[any]{
			Success: false,
			Error:   "ApiErrorUnauthorized",
		})
	}
}

// Refresh token
// @Summary Refresh token
// @Security BearerAuth
// @Schemes
// @Description Refresh token
// @Tags auth required
// @Produce json
// @Success 200 {object} model.CommonResponse[model.LoginResponse]
// @Router /refresh-token [post]
func refreshResponse(c *gin.Context, code int, token string, expire time.Time) {
	setCSRFCookie(c)
	c.JSON(http.StatusOK, model.CommonResponse[model.LoginResponse]{
		Success: true,
		Data:    model.LoginResponse{Token: token, Expire: expire.Format(time.RFC3339)},
	})
}

func fallbackAuthMiddleware(mw *jwt.GinJWTMiddleware) func(c *gin.Context) {
	return func(c *gin.Context) {
		claims, err := mw.GetClaimsFromJWT(c)
		if err == nil {
			c.Set("JWT_PAYLOAD", claims)
			if identity := mw.IdentityHandler(c); identity != nil {
				c.Set(mw.IdentityKey, identity)
			}
		}
		c.Next()
	}
}
