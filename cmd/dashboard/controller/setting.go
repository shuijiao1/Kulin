package controller

import (
	"errors"
	"net"
	"net/url"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"

	"github.com/shuijiao1/Kulin/model"
	"github.com/shuijiao1/Kulin/service/singleton"
)

// List settings
// @Summary List settings
// @Schemes
// @Description List settings
// @Security BearerAuth
// @Tags common
// @Produce json
// @Success 200 {object} model.CommonResponse[model.SettingResponse]
// @Router /setting [get]
func listConfig(c *gin.Context) (*model.SettingResponse, error) {
	u, authorized := c.Get(model.CtxKeyAuthorizedUser)
	var isAdmin bool
	if authorized {
		user := u.(*model.User)
		isAdmin = user.Role.IsAdmin()
	}

	config := *singleton.Conf
	config.Language = strings.ReplaceAll(config.Language, "_", "-")

	conf := model.SettingResponse{
		Config: model.Setting{
			ConfigForGuests:                config.ConfigForGuests,
			ConfigDashboard:                config.ConfigDashboard,
			IgnoredIPNotificationServerIDs: config.IgnoredIPNotificationServerIDs,
		},
		Version:           singleton.Version,
		FrontendTemplates: singleton.FrontendTemplates,
		TSDBEnabled:       singleton.TSDBEnabled(),
	}

	if !authorized || !isAdmin {
		configForGuests := config.ConfigForGuests
		var configDashboard model.ConfigDashboard
		if authorized {
			configDashboard.AgentTLS = singleton.Conf.AgentTLS
			configDashboard.InstallHost = singleton.Conf.InstallHost
		}
		conf = model.SettingResponse{
			Config: model.Setting{
				ConfigForGuests: configForGuests,
				ConfigDashboard: configDashboard,
			},
			TSDBEnabled: singleton.TSDBEnabled(),
		}
	}

	return &conf, nil
}

// Edit config
// @Summary Edit config
// @Security BearerAuth
// @Schemes
// @Description Edit config
// @Tags admin required
// @Accept json
// @Param body body model.SettingForm true "SettingForm"
// @Produce json
// @Success 200 {object} model.CommonResponse[any]
// @Router /setting [patch]
func updateConfig(c *gin.Context) (any, error) {
	var sf model.SettingForm
	if err := c.ShouldBindJSON(&sf); err != nil {
		return nil, err
	}
	var userTemplateValid bool
	for _, v := range singleton.FrontendTemplates {
		if !userTemplateValid && v.Path == sf.UserTemplate && !v.IsAdmin {
			userTemplateValid = true
		}
		if userTemplateValid {
			break
		}
	}
	if !userTemplateValid {
		return nil, errors.New("invalid user template")
	}
	if err := validateInstallHost(sf.InstallHost); err != nil {
		return nil, err
	}

	singleton.Conf.Language = strings.ReplaceAll(sf.Language, "-", "_")

	singleton.Conf.EnableIPChangeNotification = sf.EnableIPChangeNotification
	singleton.Conf.EnablePlainIPInNotification = sf.EnablePlainIPInNotification
	singleton.Conf.Cover = sf.Cover
	singleton.Conf.InstallHost = sf.InstallHost
	singleton.Conf.IgnoredIPNotification = sf.IgnoredIPNotification
	singleton.Conf.IPChangeNotificationGroupID = sf.IPChangeNotificationGroupID
	singleton.Conf.SiteName = sf.SiteName
	singleton.Conf.AvatarURL = sf.AvatarURL
	singleton.Conf.ThemeMode = sf.ThemeMode
	singleton.Conf.BackgroundImage = sf.BackgroundImage
	singleton.Conf.MobileBackgroundImage = sf.MobileBackgroundImage
	singleton.Conf.CustomCode = sf.CustomCode
	singleton.Conf.CustomCodeDashboard = sf.CustomCodeDashboard
	singleton.Conf.WebRealIPHeader = sf.WebRealIPHeader
	singleton.Conf.AgentRealIPHeader = sf.AgentRealIPHeader
	singleton.Conf.AgentTLS = sf.AgentTLS
	singleton.Conf.UserTemplate = sf.UserTemplate
	if err := singleton.Conf.Save(); err != nil {
		return nil, newGormError("%v", err)
	}

	singleton.OnUpdateLang(singleton.Conf.Language)
	return nil, nil
}

func validateInstallHost(raw string) error {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil
	}
	if trimmed != raw || strings.ContainsAny(trimmed, " \t\r\n'\"`$;&|()<>\\") {
		return errors.New("invalid install_host")
	}

	hostPort := trimmed
	if strings.Contains(trimmed, "://") {
		u, err := url.Parse(trimmed)
		if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" || (u.Path != "" && u.Path != "/") {
			return errors.New("invalid install_host")
		}
		hostPort = u.Host
	}

	host, port, err := splitInstallHostPort(hostPort)
	if err != nil || !validInstallHostName(host) || !validInstallPort(port) {
		return errors.New("invalid install_host")
	}
	return nil
}

func splitInstallHostPort(hostPort string) (host, port string, err error) {
	if strings.HasPrefix(hostPort, "[") || strings.Count(hostPort, ":") == 1 {
		host, port, err = net.SplitHostPort(hostPort)
		if err != nil {
			return "", "", err
		}
		return host, port, nil
	}
	if strings.Contains(hostPort, ":") {
		// Unbracketed IPv6 without a port is accepted as a host value, but IPv6
		// with a port must use [addr]:port so parsing is unambiguous.
		if ip := net.ParseIP(hostPort); ip == nil {
			return "", "", errors.New("invalid host")
		}
		return hostPort, "", nil
	}
	return hostPort, "", nil
}

func validInstallHostName(host string) bool {
	if host == "" || len(host) > 253 || strings.ContainsAny(host, "/?#@") {
		return false
	}
	if ip := net.ParseIP(host); ip != nil {
		return true
	}
	host = strings.TrimSuffix(host, ".")
	if host == "" {
		return false
	}
	for _, label := range strings.Split(host, ".") {
		if label == "" || len(label) > 63 || label[0] == '-' || label[len(label)-1] == '-' {
			return false
		}
		for _, ch := range label {
			if (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9') || ch == '-' {
				continue
			}
			return false
		}
	}
	return true
}

func validInstallPort(port string) bool {
	if port == "" {
		return true
	}
	p, err := strconv.Atoi(port)
	return err == nil && p > 0 && p <= 65535
}
