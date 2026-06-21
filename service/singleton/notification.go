package singleton

import (
	"cmp"
	"fmt"
	"log"
	"slices"
	"time"

	"github.com/shuijiao1/Kulin/model"
	"github.com/shuijiao1/Kulin/pkg/utils"
)

const (
	firstNotificationDelay = time.Minute * 15
)

type notificationMuteLabel struct{}

var NotificationMuteLabel notificationMuteLabel

func (notificationMuteLabel) IPChanged(serverId uint64) string {
	return fmt.Sprintf("bf::ic-%d", serverId)
}
func (notificationMuteLabel) ServerIncident(alertId uint64, serverId uint64) string {
	return fmt.Sprintf("bf::sei-%d-%d", alertId, serverId)
}
func (notificationMuteLabel) ServerIncidentResolved(alertId uint64, serverId uint64) string {
	return fmt.Sprintf("bf::seir-%d-%d", alertId, serverId)
}
func (notificationMuteLabel) ServiceLatencyMin(serviceId uint64) string {
	return fmt.Sprintf("bf::sln-%d", serviceId)
}
func (notificationMuteLabel) ServiceLatencyMax(serviceId uint64) string {
	return fmt.Sprintf("bf::slm-%d", serviceId)
}
func (notificationMuteLabel) ServiceStateChanged(serviceId uint64) string {
	return fmt.Sprintf("bf::ssc-%d", serviceId)
}
func (notificationMuteLabel) ServiceTLS(serviceId uint64, extraInfo string) string {
	return fmt.Sprintf("bf::stls-%d-%s", serviceId, extraInfo)
}

func (notificationMuteLabel) AppendNotificationGroupName(muteLabel, groupName string) string {
	if muteLabel == "" {
		return groupName
	}
	if groupName == "" {
		return muteLabel
	}
	return muteLabel + ":" + groupName
}

type NotificationClass struct {
	class[uint64, *model.Notification]
}

func NewNotificationClass() *NotificationClass {
	var sortedList []*model.Notification
	DB.Find(&sortedList)
	list := make(map[uint64]*model.Notification, len(sortedList))
	for _, n := range sortedList {
		list[n.ID] = n
	}
	return &NotificationClass{class: class[uint64, *model.Notification]{list: list, sortedList: sortedList}}
}

func (c *NotificationClass) Update(n *model.Notification) {
	c.listMu.Lock()
	c.list[n.ID] = n
	c.listMu.Unlock()
	c.sortList()
}

func (c *NotificationClass) Delete(idList []uint64) {
	c.listMu.Lock()
	for _, id := range idList {
		delete(c.list, id)
	}
	c.listMu.Unlock()
	c.sortList()
}

func (c *NotificationClass) GetGroupName(gid uint64) string { return "Telegram" }

func (c *NotificationClass) sortList() {
	c.listMu.RLock()
	defer c.listMu.RUnlock()

	sortedList := utils.MapValuesToSlice(c.list)
	slices.SortFunc(sortedList, func(a, b *model.Notification) int {
		return cmp.Compare(a.ID, b.ID)
	})

	c.sortedListMu.Lock()
	defer c.sortedListMu.Unlock()
	c.sortedList = sortedList
}

func (c *NotificationClass) UnMuteNotification(notificationGroupID uint64, muteLabel string) {
	fullMuteLabel := NotificationMuteLabel.AppendNotificationGroupName(muteLabel, c.GetGroupName(notificationGroupID))
	Cache.Delete(fullMuteLabel)
}

// SendNotification 向指定的通知方式组的所有通知方式发送通知
func (c *NotificationClass) SendNotification(groupID uint64, desc, muteLabel string, ext ...*model.Server) {
	c.listMu.RLock()
	notifications := slices.Clone(c.sortedList)
	c.listMu.RUnlock()
	for _, n := range notifications {
		if n == nil {
			continue
		}
		ns := model.NotificationServerBundle{Notification: n, Loc: Loc}
		if len(ext) > 0 {
			ns.Server = ext[0]
		}
		go func(name string, bundle model.NotificationServerBundle) {
			if err := bundle.Send(desc); err != nil {
				log.Printf("KULIN>> Sending notification to %s failed: %v", name, err)
			}
		}(n.Name, ns)
	}
}
