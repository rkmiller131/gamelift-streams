// General Utility functions ------------------------------------------------------

// Helper to post JSON data
async function sendPost(url, data) {
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('API request failed:', error);
        throw error;
    }
}

// Helper function to sleep for a specified time
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// URL related functions ------------------------------------------------------

// Clear the URL token
function clearURLToken() {
    window.history.replaceState(null, null, window.location.pathname);
}

// Functions for using query params
function setQueryParams(queryParamsMap) {
    const url = new URL(location);
    for (const [key, value] of queryParamsMap.entries()) {
        url.searchParams.set(key, value);
    }
    // Use replace state to prevent page refresh
    window.history.replaceState(null, null, url);
}

// function getQueryParams() {
//     return new URLSearchParams(window.location.search);
// }

// function deleteAllQueryParams() {
//     window.history.replaceState(null, null, location.href.split("?")[0]);
// }

// // Functions for using cookie
// function setCookie(name, val) {
//     const d = new Date();
//     d.setTime(d.getTime() + 365*24*3600*1000);
//     document.cookie = `${name}=${encodeURIComponent(val)};expires=${d.toUTCString()};path=/`;
// }

// function expireCookie(name) {
//     document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/`;
// }

// function getCookieIfSet(name) {
//     const value = document.cookie.split(/;\s*/).find(x => x.startsWith(name + '='))?.split('=')?.[1];
//     if (value) {
//         return decodeURIComponent(value);
//     }
//     return value;
// }

// function restoreFromCookieIfSet(id, name) {
//     const x = getCookieIfSet(name);
//     if (x) {
//         document.getElementById(id).value = x;
//     }
// }