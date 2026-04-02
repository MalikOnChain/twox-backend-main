import axios from 'axios';
import colors from 'colors';

/* eslint-disable */

const ipDictionary = {
  '127.0.0.1': 'localhost',
  '::1': 'localhost',
  '193.24.123.61': 'Tuabet',
  '103.14.27.7': 'Fiverscan',
  '89.187.161.220': 'Japan 1',
  '50.7.159.34': 'Japan 2',
  '95.216.25.34': 'Finland',
};

export async function getCountryByIP(ip) {
  try {
    const response = await axios.get(`http://ip-api.com/json/${ip}`);
    const { country } = response.data;
    return country;
  } catch (error) {
    return 'Unknown Location';
  }
}

export const getIpName = (ip) => {
  const ipName = ipDictionary[ip] || ip;
  
  // For localhost and known IPs, return immediately without async operations
  if (ipDictionary[ip] || ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1') {
    return { ipName, country: null };
  }
  
  // For unknown IPs, we'll handle this asynchronously in the middleware
  return { ipName, country: null, needsLookup: true };
};

export const getCountryByIPAsync = async (ip) => {
  try {
    const response = await axios.get(`http://ip-api.com/json/${ip}`);
    const { country } = response.data;
    return country;
  } catch (error) {
    return 'Unknown Location';
  }
};

export const metricsMiddleware = (req, res, next) => {
  const method = ('[' + req.method + ']').padEnd(7, ' ');
  const url = req.originalUrl;
  let { ipName, country, needsLookup } = getIpName(req.ip);
  ipName = ('[' + ipName + ']').padEnd(15, ' ');
  let userName = 'Unknown';
  if (req.user) {
    userName = req.user.username;
  }

  userName = ('[' + userName + ']').padEnd(15, ' ');

  const startTime = Date.now();

  res.on('finish', async () => {
    const duration = Date.now() - startTime;
    
    // Only do async country lookup for unknown IPs after response is sent
    if (needsLookup) {
      country = await getCountryByIPAsync(req.ip);
    }
    
    console.log(
      '📢 ' +
        colors.bold(colors.red(method)) +
        colors.bold(colors.red(ipName)) +
        ' ' +
        colors.cyan(url) +
        ' in ' +
        colors.yellow(duration + 'ms') +
        (country ? ' from ' + colors.green(country) : '') +
        ' ' +
        colors.bold(colors.red(userName))
    );
  });
  next();
};

export default metricsMiddleware;
