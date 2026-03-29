# Cookie Card Implementation Guide for Content Site

This document walks you through adding a cookie consent card to your content Replit that redirects users to Tableicity (`https://app.tableicity.com`) when they click **Accept All** or **Reject All**.

---

## How It Works

1. User lands on your content site
2. Cookie card appears overlaying the page
3. User clicks **Accept All** or **Reject All**
4. Their choice is saved to `localStorage` (so they never see it again)
5. User is immediately redirected to `https://app.tableicity.com/login`

---

## Step-by-Step Implementation

### Step 1: Create the Cookie Card Component

Create a new file in your content site's components directory. If you're using React:

**File: `components/CookieConsent.tsx`** (or `.jsx` if not using TypeScript)

```tsx
import { useState, useEffect } from "react";

const REDIRECT_URL = "https://app.tableicity.com/login";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("cookie-consent-accepted");
    const dismissed = localStorage.getItem("cookie-consent-dismissed");
    if (!consent && dismissed !== "true") {
      setVisible(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem("cookie-consent-accepted", "true");
    setVisible(false);
    window.location.href = REDIRECT_URL;
  };

  const handleReject = () => {
    localStorage.setItem("cookie-consent-accepted", "rejected");
    setVisible(false);
    window.location.href = REDIRECT_URL;
  };

  const handleDismiss = () => {
    localStorage.setItem("cookie-consent-dismissed", "true");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div style={{
      position: "fixed",
      bottom: "24px",
      left: "50%",
      transform: "translateX(-50%)",
      zIndex: 9999,
      width: "100%",
      maxWidth: "400px",
      padding: "0 16px",
    }}>
      <div style={{
        background: "rgba(13, 20, 35, 0.95)",
        border: "1px solid rgba(99, 179, 237, 0.25)",
        borderRadius: "12px",
        overflow: "hidden",
        boxShadow: "0 15px 40px rgba(0, 0, 0, 0.4)",
      }}>
        {/* Top accent bar */}
        <div style={{ height: "4px", background: "#2B6CB0" }} />

        <div style={{ padding: "16px" }}>
          {/* Dismiss X button */}
          <button
            onClick={handleDismiss}
            style={{
              position: "absolute",
              top: "12px",
              right: "12px",
              background: "transparent",
              border: "none",
              color: "#718096",
              cursor: "pointer",
              fontSize: "18px",
              lineHeight: "1",
              padding: "4px",
            }}
          >
            &times;
          </button>

          {/* Icon + Text */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", paddingRight: "24px" }}>
            {/* Cookie icon container */}
            <div style={{
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              background: "rgba(99, 179, 237, 0.15)",
              border: "1px solid rgba(99, 179, 237, 0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              marginTop: "2px",
              fontSize: "16px",
            }}>
              &#x1F36A;
            </div>
            <div>
              <h3 style={{
                fontWeight: 600,
                fontSize: "14px",
                color: "#FFFFFF",
                margin: "0 0 4px 0",
              }}>
                We value your privacy
              </h3>
              <p style={{
                fontSize: "12px",
                color: "#A0AEC0",
                lineHeight: "1.5",
                margin: 0,
              }}>
                We use cookies to enhance your browsing experience and analyse our traffic.
                By clicking "Accept", you consent to our use of cookies.
              </p>
            </div>
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", gap: "10px", marginTop: "14px" }}>
            <button
              onClick={handleReject}
              style={{
                flex: 1,
                padding: "8px 0",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 500,
                border: "1px solid rgba(99, 179, 237, 0.2)",
                background: "transparent",
                color: "#A0AEC0",
                cursor: "pointer",
              }}
            >
              Reject All
            </button>
            <button
              onClick={handleAccept}
              style={{
                flex: 1,
                padding: "8px 0",
                borderRadius: "8px",
                fontSize: "13px",
                fontWeight: 500,
                border: "none",
                background: "#2B6CB0",
                color: "#FFFFFF",
                cursor: "pointer",
              }}
            >
              Accept All
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

### Step 2: Add the Component to Your Page

In your main page or layout file, import and render the component:

```tsx
import { CookieConsent } from "./components/CookieConsent";

function App() {
  return (
    <>
      {/* Your existing content site content */}
      <YourLandingPage />

      {/* Cookie consent - renders on top of everything */}
      <CookieConsent />
    </>
  );
}
```

---

### Step 3: If Your Content Site Is NOT React

If your content site uses plain HTML/JavaScript, add this to the bottom of your HTML page, right before `</body>`:

```html
<div id="cookie-consent"></div>

<script>
  (function() {
    var consent = localStorage.getItem("cookie-consent-accepted");
    var dismissed = localStorage.getItem("cookie-consent-dismissed");
    if (consent || dismissed === "true") return;

    var REDIRECT_URL = "https://app.tableicity.com/login";

    var card = document.getElementById("cookie-consent");
    card.innerHTML = `
      <div style="position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:9999;width:100%;max-width:400px;padding:0 16px;">
        <div style="background:rgba(13,20,35,0.95);border:1px solid rgba(99,179,237,0.25);border-radius:12px;overflow:hidden;box-shadow:0 15px 40px rgba(0,0,0,0.4);">
          <div style="height:4px;background:#2B6CB0;"></div>
          <div style="padding:16px;position:relative;">
            <button id="cookie-dismiss" style="position:absolute;top:12px;right:12px;background:transparent;border:none;color:#718096;cursor:pointer;font-size:18px;padding:4px;">&times;</button>
            <div style="display:flex;align-items:flex-start;gap:12px;padding-right:24px;">
              <div style="width:32px;height:32px;border-radius:8px;background:rgba(99,179,237,0.15);border:1px solid rgba(99,179,237,0.25);display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px;font-size:16px;">&#x1F36A;</div>
              <div>
                <h3 style="font-weight:600;font-size:14px;color:#FFF;margin:0 0 4px 0;">We value your privacy</h3>
                <p style="font-size:12px;color:#A0AEC0;line-height:1.5;margin:0;">We use cookies to enhance your browsing experience and analyse our traffic. By clicking "Accept", you consent to our use of cookies.</p>
              </div>
            </div>
            <div style="display:flex;gap:10px;margin-top:14px;">
              <button id="cookie-reject" style="flex:1;padding:8px 0;border-radius:8px;font-size:13px;font-weight:500;border:1px solid rgba(99,179,237,0.2);background:transparent;color:#A0AEC0;cursor:pointer;">Reject All</button>
              <button id="cookie-accept" style="flex:1;padding:8px 0;border-radius:8px;font-size:13px;font-weight:500;border:none;background:#2B6CB0;color:#FFF;cursor:pointer;">Accept All</button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById("cookie-accept").addEventListener("click", function() {
      localStorage.setItem("cookie-consent-accepted", "true");
      window.location.href = REDIRECT_URL;
    });

    document.getElementById("cookie-reject").addEventListener("click", function() {
      localStorage.setItem("cookie-consent-accepted", "rejected");
      window.location.href = REDIRECT_URL;
    });

    document.getElementById("cookie-dismiss").addEventListener("click", function() {
      localStorage.setItem("cookie-consent-dismissed", "true");
      card.innerHTML = "";
    });
  })();
</script>
```

---

## Behavior Summary

| User Action | What Happens | Sees Card Again? |
|-------------|-------------|-----------------|
| Clicks **Accept All** | Saves `cookie-consent-accepted: "true"` to localStorage, redirects to `app.tableicity.com/login` | No |
| Clicks **Reject All** | Saves `cookie-consent-accepted: "rejected"` to localStorage, redirects to `app.tableicity.com/login` | No |
| Clicks **X** (dismiss) | Saves `cookie-consent-dismissed: "true"` to localStorage, card disappears, stays on content site | No |
| Does nothing | Card stays visible | Yes (on next visit) |

---

## Key Details

- **Redirect URL**: `https://app.tableicity.com/login` — change this if you want them to land on `/launch` (free trial flow) instead of login
- **localStorage keys**: These match what Tableicity uses, so if someone accepts cookies on your content site and then visits Tableicity, they won't see the cookie card again on Tableicity's login page either
- **The X button** does NOT redirect — it just dismisses the card. Only Accept/Reject trigger the redirect. This gives users an escape if they want to keep browsing your content site without being redirected.

---

## Customization Options

**Redirect to free trial instead of login:**
Change the redirect URL to send new users straight into the trial flow:
```
var REDIRECT_URL = "https://app.tableicity.com/launch";
```

**Redirect to different pages based on choice:**
```javascript
// Accept goes to free trial, Reject goes to login
document.getElementById("cookie-accept").addEventListener("click", function() {
  localStorage.setItem("cookie-consent-accepted", "true");
  window.location.href = "https://app.tableicity.com/launch";
});

document.getElementById("cookie-reject").addEventListener("click", function() {
  localStorage.setItem("cookie-consent-accepted", "rejected");
  window.location.href = "https://app.tableicity.com/login";
});
```

---

## Testing

To see the cookie card again after you've already clicked a button:

1. Open Chrome DevTools (F12)
2. Go to **Application** tab
3. Click **Local Storage** in the left sidebar
4. Click your content site URL
5. Delete these keys: `cookie-consent-accepted`, `cookie-consent-dismissed`
6. Refresh the page
