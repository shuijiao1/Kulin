package model

type ProfileForm struct {
	OriginalPassword string `json:"original_password,omitempty"`
	NewUsername      string `json:"new_username,omitempty"`
	NewPassword      string `json:"new_password,omitempty"`
	AvatarURL        string `json:"avatar_url,omitempty" validate:"optional"`
}
