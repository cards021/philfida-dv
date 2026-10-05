"use strict";
/** Security headers: nosniff, DENY framing, same-origin referrer. */
const helmet = require('helmet');

module.exports = helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  frameguard: { action: 'deny' },
  referrerPolicy: { policy: 'same-origin' },
});
