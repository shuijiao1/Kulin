package geoip

import (
	_ "embed"
	"errors"
	"net"
	"strings"
	"sync"

	maxminddb "github.com/oschwald/maxminddb-golang"
)

//go:embed geoip.db
var db []byte

var (
	dbOnce = sync.OnceValues(func() (*maxminddb.Reader, error) {
		db, err := maxminddb.FromBytes(db)
		if err != nil {
			return nil, err
		}
		return db, nil
	})
)

type namedInfo struct {
	IsoCode string `maxminddb:"iso_code"`
	Code    string `maxminddb:"code"`
}

type IPInfo struct {
	// ipinfo.io country.mmdb format
	Country       string `maxminddb:"country"`
	CountryName   string `maxminddb:"country_name"`
	Continent     string `maxminddb:"continent"`
	ContinentName string `maxminddb:"continent_name"`

	// MaxMind GeoLite2-Country format
	CountryObj           namedInfo `maxminddb:"country"`
	RegisteredCountryObj namedInfo `maxminddb:"registered_country"`
	ContinentObj         namedInfo `maxminddb:"continent"`
}

func Lookup(ip net.IP) (string, error) {
	db, err := dbOnce()
	if err != nil {
		return "", err
	}

	var record IPInfo
	err = db.Lookup(ip, &record)
	if err != nil {
		return "", err
	}

	for _, code := range []string{
		record.Country,
		record.CountryObj.IsoCode,
		record.RegisteredCountryObj.IsoCode,
		record.Continent,
		record.ContinentObj.Code,
	} {
		if code != "" {
			return strings.ToLower(code), nil
		}
	}

	return "", errors.New("IP not found")
}
