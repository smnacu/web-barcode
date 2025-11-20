from playwright.sync_api import sync_playwright, expect, Route
import urllib.parse

def verify_admin_login():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context()
        page = context.new_page()

        # Mock API responses
        def handle_api(route: Route):
            request = route.request
            url = request.url

            if "action=check_auth" in url:
                # Initial state: not logged in
                route.fulfill(json={"logged_in": False, "success": True})
            elif "action=get_config" in url:
                route.fulfill(json={
                    "ruta_pdf": "/mock/pdf",
                    "ruta_csv": "/mock/csv/Libro.csv",
                    "timeout_segundos": 30
                })
            elif request.method == "POST":
                post_data = request.post_data or ""
                print(f"POST DATA: {post_data}")

                # Handle FormData or URL encoded body
                # Playwright's post_data might be bytes or string.

                if "action=login" in post_data or b"action" in (request.post_data_buffer or b""):
                     # Simple string check might fail if multipart form data
                     # But fetch body: FormData usually sends multipart.
                     # Let's just return success or fail based on string search for simplicity if possible
                     # Or assume the test sends it correctly.

                     if "wrongpass" in post_data:
                         route.fulfill(json={"success": False, "msg": "Contraseña incorrecta"})
                     elif "queija1234" in post_data:
                         route.fulfill(json={"success": True, "msg": "Login exitoso"})
                     else:
                         # Check buffer for multipart
                         buffer = request.post_data_buffer
                         if buffer:
                             s = buffer.decode('utf-8', errors='ignore')
                             if "wrongpass" in s:
                                 route.fulfill(json={"success": False, "msg": "Contraseña incorrecta"})
                             elif "queija1234" in s:
                                 route.fulfill(json={"success": True, "msg": "Login exitoso"})
                             else:
                                 route.fulfill(json={"success": False, "msg": "Unknown password"})
                         else:
                             route.fulfill(json={"success": False, "msg": "No data"})

                elif "action=logout" in post_data:
                    route.fulfill(json={"success": True, "msg": "Logged out"})
                else:
                    # Fallback check buffer
                    buffer = request.post_data_buffer
                    if buffer:
                        s = buffer.decode('utf-8', errors='ignore')
                        if "action" in s and "login" in s:
                             if "wrongpass" in s:
                                 route.fulfill(json={"success": False, "msg": "Contraseña incorrecta"})
                             elif "queija1234" in s:
                                 route.fulfill(json={"success": True, "msg": "Login exitoso"})
                    else:
                        route.continue_()
            else:
                route.continue_()

        # Intercept requests to api/admin.php
        page.route("**/api/admin.php*", handle_api)

        page.goto("http://localhost:8000/settings.html")

        # Wait for API checkAuth
        page.wait_for_timeout(500)

        # Verify Login Section is visible
        expect(page.locator("#loginSection")).to_be_visible()
        expect(page.locator("#settingsSection")).not_to_be_visible()

        # Take screenshot of login
        page.screenshot(path="verification/1_login_screen.png")
        print("Screenshot 1 taken: Login Screen")

        # Try wrong password
        page.fill("#adminPassword", "wrongpass")
        page.click("button[type='submit']")

        # Wait for response
        page.wait_for_timeout(1000) # Increased timeout
        expect(page.locator("#loginMsg")).to_contain_text("Contraseña incorrecta")

        # Try correct password
        page.fill("#adminPassword", "queija1234")
        page.click("button[type='submit']")

        # Wait for transition
        page.wait_for_timeout(1000)

        # Verify Settings Section is visible
        expect(page.locator("#settingsSection")).to_be_visible()
        expect(page.locator("#loginSection")).not_to_be_visible()

        # Verify config loaded
        expect(page.locator("#ruta_pdf")).to_have_value("/mock/pdf")

        # Take screenshot of settings
        page.screenshot(path="verification/2_settings_screen.png")
        print("Screenshot 2 taken: Settings Screen")

        browser.close()

if __name__ == "__main__":
    verify_admin_login()
