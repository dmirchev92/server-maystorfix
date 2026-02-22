"""
Chrome Cookie Sync for SnapFix Beta
====================================
Reads Google cookies from Chrome's local cookie database,
decrypts them using Windows DPAPI, and uploads to the server.

Run as a Windows Scheduled Task every 4 hours.

Requirements:
    pip install pycryptodome requests

Usage:
    python sync-cookies.py
"""

import os
import sys
import json
import shutil
import sqlite3
import base64
import requests
from datetime import datetime

# ─── Configuration ───
UPLOAD_URL = "https://snapfix.bg/beta/api/upload-cookies"
UPLOAD_SECRET = "stp-cookie-upload-2026"

# Chrome default profile cookie path (Windows)
CHROME_USER_DATA = os.path.join(os.environ.get("LOCALAPPDATA", ""), "Google", "Chrome", "User Data")
CHROME_COOKIE_DB = os.path.join(CHROME_USER_DATA, "Default", "Network", "Cookies")
CHROME_LOCAL_STATE = os.path.join(CHROME_USER_DATA, "Local State")

# Domains to extract cookies for
TARGET_DOMAINS = [".google.com", "play.google.com", ".play.google.com", "accounts.google.com"]

LOG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "sync-cookies.log")


def log(msg):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    line = f"[{timestamp}] {msg}"
    print(line)
    try:
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except:
        pass


def get_chrome_encryption_key():
    """Get Chrome's AES encryption key from Local State (decrypted via DPAPI)."""
    try:
        import win32crypt
    except ImportError:
        # Fallback: use ctypes for DPAPI
        pass

    with open(CHROME_LOCAL_STATE, "r", encoding="utf-8") as f:
        local_state = json.load(f)

    encrypted_key_b64 = local_state["os_crypt"]["encrypted_key"]
    encrypted_key = base64.b64decode(encrypted_key_b64)

    # Remove DPAPI prefix "DPAPI" (5 bytes)
    encrypted_key = encrypted_key[5:]

    # Decrypt using Windows DPAPI
    import ctypes
    import ctypes.wintypes

    class DATA_BLOB(ctypes.Structure):
        _fields_ = [
            ("cbData", ctypes.wintypes.DWORD),
            ("pbData", ctypes.POINTER(ctypes.c_char)),
        ]

    p = ctypes.create_string_buffer(encrypted_key, len(encrypted_key))
    blob_in = DATA_BLOB(ctypes.sizeof(p), p)
    blob_out = DATA_BLOB()

    if ctypes.windll.crypt32.CryptUnprotectData(
        ctypes.byref(blob_in), None, None, None, None, 0, ctypes.byref(blob_out)
    ):
        key = ctypes.string_at(blob_out.pbData, blob_out.cbData)
        ctypes.windll.kernel32.LocalFree(blob_out.pbData)
        return key
    else:
        raise Exception("Failed to decrypt Chrome encryption key via DPAPI")


def decrypt_cookie_value(encrypted_value, key):
    """Decrypt a Chrome cookie value."""
    if not encrypted_value:
        return ""

    # Chrome v80+ uses AES-256-GCM with "v10" or "v11" prefix
    if encrypted_value[:3] == b"v10" or encrypted_value[:3] == b"v11":
        from Crypto.Cipher import AES

        nonce = encrypted_value[3:15]       # 12 bytes nonce
        ciphertext = encrypted_value[15:-16] # ciphertext
        tag = encrypted_value[-16:]          # 16 bytes auth tag

        cipher = AES.new(key, AES.MODE_GCM, nonce=nonce)
        try:
            return cipher.decrypt_and_verify(ciphertext, tag).decode("utf-8", errors="replace")
        except Exception:
            return ""

    # Older Chrome versions use DPAPI directly
    try:
        import ctypes
        import ctypes.wintypes

        class DATA_BLOB(ctypes.Structure):
            _fields_ = [
                ("cbData", ctypes.wintypes.DWORD),
                ("pbData", ctypes.POINTER(ctypes.c_char)),
            ]

        p = ctypes.create_string_buffer(encrypted_value, len(encrypted_value))
        blob_in = DATA_BLOB(ctypes.sizeof(p), p)
        blob_out = DATA_BLOB()

        if ctypes.windll.crypt32.CryptUnprotectData(
            ctypes.byref(blob_in), None, None, None, None, 0, ctypes.byref(blob_out)
        ):
            val = ctypes.string_at(blob_out.pbData, blob_out.cbData)
            ctypes.windll.kernel32.LocalFree(blob_out.pbData)
            return val.decode("utf-8", errors="replace")
    except:
        pass

    return ""


def chrome_timestamp_to_unix(chrome_ts):
    """Convert Chrome's timestamp (microseconds since 1601-01-01) to Unix epoch seconds."""
    if chrome_ts == 0:
        return -1
    # Chrome epoch starts at 1601-01-01, Unix at 1970-01-01
    # Difference is 11644473600 seconds
    return (chrome_ts / 1_000_000) - 11644473600


def read_chrome_cookies():
    """Read and decrypt cookies from Chrome's SQLite database."""
    if not os.path.exists(CHROME_COOKIE_DB):
        raise FileNotFoundError(f"Chrome cookie database not found at: {CHROME_COOKIE_DB}")

    # Copy the database (Chrome locks it while running)
    temp_db = os.path.join(os.path.dirname(os.path.abspath(__file__)), "Cookies_temp")
    shutil.copy2(CHROME_COOKIE_DB, temp_db)

    key = get_chrome_encryption_key()
    log(f"Got Chrome encryption key ({len(key)} bytes)")

    cookies = []
    try:
        conn = sqlite3.connect(temp_db)
        cursor = conn.cursor()

        # Build domain filter
        domain_conditions = " OR ".join(
            [f"host_key LIKE '%{d.replace('.', '')}%'" for d in TARGET_DOMAINS]
        )

        cursor.execute(f"""
            SELECT host_key, name, encrypted_value, path, expires_utc, 
                   is_secure, is_httponly, samesite
            FROM cookies
            WHERE {domain_conditions}
            ORDER BY host_key, name
        """)

        for row in cursor.fetchall():
            host_key, name, encrypted_value, path, expires_utc, is_secure, is_httponly, samesite = row

            value = decrypt_cookie_value(encrypted_value, key)
            if not value:
                continue

            # Map Chrome's samesite int to Playwright string
            samesite_map = {-1: "None", 0: "None", 1: "Lax", 2: "Strict"}
            sameSite = samesite_map.get(samesite, "Lax")

            cookies.append({
                "name": name,
                "value": value,
                "domain": host_key,
                "path": path or "/",
                "expires": chrome_timestamp_to_unix(expires_utc),
                "httpOnly": bool(is_httponly),
                "secure": bool(is_secure),
                "sameSite": sameSite,
            })

        conn.close()
    finally:
        # Clean up temp file
        try:
            os.remove(temp_db)
        except:
            pass

    return cookies


def upload_cookies(cookies):
    """Upload cookies to the SnapFix beta server."""
    response = requests.post(
        UPLOAD_URL,
        json={
            "secret": UPLOAD_SECRET,
            "cookies": cookies,
        },
        timeout=30,
    )

    data = response.json()
    return data


def main():
    log("=" * 50)
    log("Starting Chrome cookie sync...")

    try:
        cookies = read_chrome_cookies()
        log(f"Extracted {len(cookies)} Google cookies from Chrome")

        if len(cookies) < 5:
            log("WARNING: Very few cookies found. Is Chrome logged into Google?")

        # Show cookie names for debugging
        cookie_names = [c["name"] for c in cookies]
        log(f"Cookie names: {', '.join(cookie_names[:15])}{'...' if len(cookie_names) > 15 else ''}")

        # Check for critical session cookies
        critical = {"SID", "SSID", "HSID", "__Secure-1PSID", "__Secure-3PSID"}
        found_critical = critical.intersection(set(cookie_names))
        missing_critical = critical - found_critical
        if missing_critical:
            log(f"WARNING: Missing critical cookies: {', '.join(missing_critical)}")

        result = upload_cookies(cookies)
        if result.get("success"):
            log(f"✅ Upload successful: {result.get('message')}")
        else:
            log(f"❌ Upload failed: {result.get('message')}")
            sys.exit(1)

    except FileNotFoundError as e:
        log(f"❌ {e}")
        sys.exit(1)
    except requests.exceptions.ConnectionError:
        log("❌ Cannot connect to server. Is snapfix.bg reachable?")
        sys.exit(1)
    except Exception as e:
        log(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

    log("Done.")


if __name__ == "__main__":
    main()
