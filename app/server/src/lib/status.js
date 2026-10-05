"use strict";
/**
 * Voucher workflow statuses. Used EVERYWHERE consistently — list filters,
 * stats counts, and any future transitions.
 *
 * pending   : receivedAt == null
 * received  : receivedAt != null && releasedAt == null
 * released  : releasedAt != null && checkReceivedAt == null
 * in_check  : checkReceivedAt != null && checkReleasedAt == null
 * completed : checkReleasedAt != null
 */

const STATUS_WHERE = {
  pending: 'received_at IS NULL',
  received: 'received_at IS NOT NULL AND released_at IS NULL',
  released: 'released_at IS NOT NULL AND check_received_at IS NULL',
  in_check: 'check_received_at IS NOT NULL AND check_released_at IS NULL',
  completed: 'check_released_at IS NOT NULL',
};

const STATUSES = Object.keys(STATUS_WHERE);

/** Classify a camelCase voucher object (for JS-side use). */
function classify(v) {
  if (v.checkReleasedAt != null) return 'completed';
  if (v.checkReceivedAt != null) return 'in_check';
  if (v.releasedAt != null) return 'released';
  if (v.receivedAt != null) return 'received';
  return 'pending';
}

module.exports = { STATUS_WHERE, STATUSES, classify };
