from playwright.sync_api import sync_playwright, expect

def verify_admin_ui():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Navigate to admin page
        # Since PHP is not running, the server will serve the PHP source code of index.php or index.html
        # But wait, if I go to localhost:8000/admin/index.php, python server will serve the file as text/plain or application/octet-stream usually.
        # It won't render the HTML because the HTML is inside the PHP blocks or mixed.
        # However, admin/index.php has:
        # <?php session_start(); if(...) { ?>
        # <!DOCTYPE html> ...
        # If served as raw text, I cannot verify the UI.

        # BUT, I can verify index.html changes.
        page.goto("http://localhost:8000/index.html")
        page.screenshot(path="verification/index_page.png")

        # Check for the gear icon linking to admin/
        gear_link = page.locator("a[href='admin/']")
        expect(gear_link).to_be_visible()

        # Now let's try to view admin/index.php.
        # Since I cannot execute PHP, I cannot verify the rendered HTML of the admin panel directly in the browser.
        # I will rely on code review for the PHP parts.

        print("Verified index.html link to admin/.")

        browser.close()

if __name__ == "__main__":
    verify_admin_ui()
