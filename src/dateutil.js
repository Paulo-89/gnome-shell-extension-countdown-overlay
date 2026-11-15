/**
 * Shared date helpers, used by both the extension (extension.js) and the
 * preferences window (prefs.js), so the same validation rules apply everywhere.
 */

/**
 * Parse a target date string of the form "YYYY-MM-DD" or "YYYY-MM-DD HH:MM".
 *
 * - "-" and "/" are both accepted as date separators.
 * - The time part is optional and defaults to 00:00.
 * - Impossible values (month 18, February 30, hour 25...) are rejected.
 *
 * @param {string} str - the raw user input
 * @returns {{date: Date|null, error: string|null}} a local Date on success,
 *          or an error message in English on failure.
 */
export function parseTargetDate(str) {
    // Expected shape: 4-digit year, 1-2 digit month and day, optional " HH:MM".
    const match = /^\s*(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?\s*$/.exec(str ?? '');
    if (!match)
        return {date: null, error: 'Expected format: YYYY-MM-DD HH:MM (e.g. 2027-01-01 00:00)'};

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const hour = match[4] !== undefined ? Number(match[4]) : 0;
    const minute = match[5] !== undefined ? Number(match[5]) : 0;

    // Years 0-99 would be interpreted as 1900-1999 by the Date constructor.
    if (year < 1000)
        return {date: null, error: 'Invalid year: must be between 1000 and 9999'};

    if (month < 1 || month > 12)
        return {date: null, error: 'Invalid month: must be between 1 and 12'};

    // Day 0 of the following month gives the last day of this month
    // (this correctly handles leap years).
    const daysInMonth = new Date(year, month, 0).getDate();
    if (day < 1 || day > daysInMonth)
        return {date: null, error: `Invalid day: this month has ${daysInMonth} days`};

    if (hour > 23)
        return {date: null, error: 'Invalid hour: must be between 0 and 23'};

    if (minute > 59)
        return {date: null, error: 'Invalid minute: must be between 0 and 59'};

    return {date: new Date(year, month - 1, day, hour, minute, 0), error: null};
}
