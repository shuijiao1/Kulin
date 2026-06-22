package singleton

import (
	"fmt"
	"log"
	"time"

	"github.com/goccy/go-json"
)

type serverPublicNote struct {
	BillingDataMod *serverBillingDataMod `json:"billingDataMod"`
}

type serverBillingDataMod struct {
	EndDate           string `json:"endDate"`
	RenewalNotifyDays []int  `json:"renewalNotifyDays"`
}

func StartRenewalNotificationCron() error {
	_, err := CronShared.AddFunc("0 5 9 * * *", CheckRenewalNotifications)
	return err
}

func CheckRenewalNotifications() {
	if NotificationShared == nil || ServerShared == nil {
		return
	}

	now := time.Now().In(Loc)
	today := dateOnly(now)
	for _, server := range ServerShared.GetSortedList() {
		if server == nil || server.PublicNote == "" {
			continue
		}
		pn, ok := parseServerPublicNote(server.PublicNote)
		if !ok || pn.BillingDataMod == nil || pn.BillingDataMod.EndDate == "" || pn.BillingDataMod.EndDate == "0000-00-00T23:59:59+08:00" {
			continue
		}
		endAt, err := parseRenewalEndDate(pn.BillingDataMod.EndDate)
		if err != nil {
			continue
		}
		endDate := dateOnly(endAt.In(Loc))
		daysLeft := int(endDate.Sub(today).Hours() / 24)
		for _, notifyDay := range pn.BillingDataMod.RenewalNotifyDays {
			if notifyDay != daysLeft {
				continue
			}
			dateText := endDate.Format("2006-01-02")
			message := fmt.Sprintf("[续费通知] %s 将于 %s 到期", server.Name, dateText)
			if notifyDay == 0 {
				message = fmt.Sprintf("[续费通知] %s 今天到期", server.Name)
			} else {
				message = fmt.Sprintf("[续费通知] %s 将于 %d 天后到期（%s）", server.Name, notifyDay, dateText)
			}
			muteLabel := NotificationMuteLabel.ServerRenewal(server.ID, notifyDay, dateText)
			NotificationShared.SendNotification(0, message, muteLabel, server)
		}
	}
}

func parseServerPublicNote(raw string) (serverPublicNote, bool) {
	var pn serverPublicNote
	if err := json.Unmarshal([]byte(raw), &pn); err != nil {
		if Conf.Debug {
			log.Printf("KULIN>> parse public_note failed: %v", err)
		}
		return pn, false
	}
	return pn, true
}

func parseRenewalEndDate(raw string) (time.Time, error) {
	if t, err := time.Parse(time.RFC3339, raw); err == nil {
		return t, nil
	}
	if t, err := time.ParseInLocation("2006-01-02", raw, Loc); err == nil {
		return t, nil
	}
	return time.ParseInLocation("2006-01-02T15:04:05-07:00", raw, Loc)
}

func dateOnly(t time.Time) time.Time {
	y, m, d := t.In(Loc).Date()
	return time.Date(y, m, d, 0, 0, 0, 0, Loc)
}
