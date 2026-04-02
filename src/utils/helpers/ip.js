import { getData } from 'country-list';
import geoip from 'geoip-lite';

export const getIPInfo = async (ip) => {
  const countries = getData();
  const lookup = geoip.lookup(ip);
  const country = lookup
    ? countries.find((c) => c.code.toLocaleLowerCase() === lookup.country?.toLocaleLowerCase())
    : null;

  return {
    country: country?.name,
    countryCode: country?.code,
    city: lookup?.city,
    region: lookup?.region,
    range: lookup?.range,
    timezone: lookup?.timezone,
    ll: lookup?.ll,
    metro: lookup?.metro,
    area: lookup?.area,
  };
};
