import moment from 'moment';

export const formatDate = (date, format) => {
  return moment(date).format(format);
};

export const getCurrentDate = () => {
  return moment().format('YYYY-MM-DD');
};

export const getCurrentTime = () => {
  return moment().format('HH:mm:ss');
};

export const getCurrentTimestamp = () => {
  return moment().format('YYYY-MM-DD HH:mm:ss');
};

export const isWithinQuietHours = (quietHours) => {
  if (!quietHours.enabled) {
    return false;
  }

  const now = moment().tz(quietHours.timezone);
  const start = moment.tz(quietHours.start, 'HH:mm', quietHours.timezone);
  const end = moment.tz(quietHours.end, 'HH:mm', quietHours.timezone);

  // If end time is before start time, it means quiet hours span across midnight
  if (end.isBefore(start)) {
    return now.isAfter(start) || now.isBefore(end);
  }

  return now.isBetween(start, end, null, '[]');
};

export const Time = {
  getCurrentDate: () => {
    return moment().format('YYYY-MM-DD');
  },
  getCurrentTime: () => {
    return moment().format('HH:mm:ss');
  },
  getCurrentTimestamp: () => {
    return moment().format('YYYY-MM-DD HH:mm:ss');
  },
  wait: (ms) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
  },

  waitUntil: (condition, ms) => {
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if (condition()) {
          clearInterval(interval);
          resolve(true);
        }
      }, ms);
    });
  },

  waitFrom: (start, ms) => {
    const now = new Date();
    const diff = now.getTime() - start.getTime();
    if (diff >= ms) {
      return Promise.resolve(false);
    }
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(true);
      }, ms - diff);
    });
  },

  isTomorrow: (date) => {
    return moment(date).isSame(moment().add(1, 'day'), 'day');
  },

  isToday: (date) => {
    return moment(date).isSame(moment(), 'day');
  },

  isYesterday: (date) => {
    return moment(date).isSame(moment().subtract(1, 'day'), 'day');
  },

  isBetween: (date, start, end) => {
    return moment(date).isBetween(start, end);
  },

  isWithinQuietHours: (quietHours) => {
    return isWithinQuietHours(quietHours);
  },

  now: () => {
    return Date.now();
  },
};
