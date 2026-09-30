// SPDX-License-Identifier: GPL-3.0-only
// A malformed model reply can be isolated to its batch. Service failures pause
// the queue instead, since sending more requests may fail or incur more charges.
export class OutputFormatError extends Error {
  readonly code = 'output-format';
}
