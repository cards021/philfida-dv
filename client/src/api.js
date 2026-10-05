// Shared POST helper for every state-changing ?action= endpoint (create,
// delete, mark_received, mark_released, mark_check_received/released).
// Centralizes the CSRF header and JSON boilerplate that used to be repeated
// at every call site.
import { API, appConfig } from './config.js';

export async function postJSON(action, data) {
    const res = await fetch(`${API}?action=` + action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': appConfig.csrfToken },
        body: JSON.stringify(data)
    });
    return res.json();
}
