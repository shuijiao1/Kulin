package model

import (
	"encoding/json"
	"testing"
)

func TestSettingFormThemeImageFieldsDetectPresence(t *testing.T) {
	var omitted SettingForm
	if err := json.Unmarshal([]byte(`{"site_name":"Kulin"}`), &omitted); err != nil {
		t.Fatal(err)
	}
	if omitted.FrontendTheme != nil || omitted.LogoURL != nil || omitted.BackgroundURL != nil || omitted.MobileBackgroundURL != nil {
		t.Fatalf("theme/image fields should be nil when omitted: %+v", omitted)
	}

	var explicitEmpty SettingForm
	if err := json.Unmarshal([]byte(`{"frontend_theme":"","logo_url":"","background_url":"","mobile_background_url":""}`), &explicitEmpty); err != nil {
		t.Fatal(err)
	}
	if explicitEmpty.FrontendTheme == nil || *explicitEmpty.FrontendTheme != "" {
		t.Fatalf("frontend_theme should preserve explicit empty value: %#v", explicitEmpty.FrontendTheme)
	}
	if explicitEmpty.LogoURL == nil || *explicitEmpty.LogoURL != "" {
		t.Fatalf("logo_url should preserve explicit empty value: %#v", explicitEmpty.LogoURL)
	}
	if explicitEmpty.BackgroundURL == nil || *explicitEmpty.BackgroundURL != "" {
		t.Fatalf("background_url should preserve explicit empty value: %#v", explicitEmpty.BackgroundURL)
	}
	if explicitEmpty.MobileBackgroundURL == nil || *explicitEmpty.MobileBackgroundURL != "" {
		t.Fatalf("mobile_background_url should preserve explicit empty value: %#v", explicitEmpty.MobileBackgroundURL)
	}
}
