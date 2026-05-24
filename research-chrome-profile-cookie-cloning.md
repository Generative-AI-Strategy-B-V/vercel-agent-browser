# Research: Chrome Profile Cookie Cloning

Date: 2026-03-07

## Question

Can an automation browser clone all cookies and existing login state from an existing Chrome profile?

## Short Answer

Not reliably.

- In principle, Chrome profile data includes cookies, and Chrome/Chromium can run against a custom user data directory.
- In practice, modern Chrome on Windows protects cookies with App-Bound Encryption, and automation tools are explicitly steered away from the default real-user profile.
- For automation, a copied profile is only a best-effort seed. It may bring over some extensions, preferences, and storage, but it does not guarantee that all real logins will work.

## Proof From Official Sources

### 1. Cookies do live inside the Chrome user-data/profile structure

Chromium documents that the user data directory contains profile data such as cookies, and that each profile is a subdirectory like `Default`.

Source:
- Chromium Docs: User Data Directory  
  https://chromium.googlesource.com/chromium/src/%2B/HEAD/docs/user_data_dir.md

Relevant lines:
- user data directory contains cookies and other local state
- each profile is a subdirectory within it

### 2. Chrome now protects cookies on Windows with App-Bound Encryption

Google announced that starting in Chrome 127 on Windows, cookies are protected with App-Bound Encryption. The decryption path verifies the requesting application's identity. If another app tries to decrypt the same data, it fails.

Source:
- Google Online Security Blog: Improving the security of Chrome cookies on Windows  
  https://security.googleblog.com/2024/07/improving-security-of-chrome-cookies-on.html

Implication:
- Copying cookie databases is no longer enough by itself.
- Even on the same machine, using the copied profile from a different browser identity or automation stack may fail.

### 3. Chrome and Playwright explicitly discourage using the default real-user profile for automation

Playwright documents that launching against Chrome's main `User Data` directory is not supported and may cause pages not to load or the browser to exit. It recommends a separate automation directory instead.

Source:
- Playwright API: `launchPersistentContext`  
  https://playwright.dev/docs/api/class-browsertype

Implication:
- The "real browsing profile" and the "automation profile" should be separate on purpose.
- That separation is a security and stability feature, not just a convenience recommendation.

### 4. Chrome 136 tightened this further for remote debugging

Chrome Developers documented that from Chrome 136, remote debugging switches are ignored for the default Chrome data directory unless you also point to a non-standard `--user-data-dir`. Google explains that a non-standard directory uses a different encryption key and is the recommended isolation model.

Source:
- Chrome for Developers: Changes to remote debugging switches to improve security  
  https://developer.chrome.com/blog/remote-debugging-port

Implication:
- Google is actively hardening the default profile against automation and cookie extraction.
- The platform direction is away from reusing the live everyday profile.

### 5. Authentication state is often more than cookies

Playwright's authentication docs recommend saving and reusing browser storage state rather than trying to piggyback on a live profile. They also note that auth can live in cookies, localStorage, and IndexedDB, while sessionStorage needs separate handling.

Source:
- Playwright Authentication  
  https://playwright.dev/docs/auth

Implication:
- Even if cookies copy over, login can still fail because the site also expects localStorage, IndexedDB, or session storage, or because the server invalidates the session.

## Practical Conclusion

### Possible

- Copying a Chrome profile while Chrome is closed can carry over some state.
- On the same machine, using the same Chrome app family with a cloned custom user-data directory may preserve some sessions.

### Not Reliable

- Cloning "all cookies" is not equivalent to inheriting "all logins".
- On Windows Chrome 127+, App-Bound Encryption makes cookie reuse harder by design.
- Automation browsers such as Playwright Chromium or Chrome-for-Testing flows are intentionally isolated from the live profile.

## What This Means For Our Setup

For `ab-cli` / `agent-browser`:

- Use a dedicated automation profile.
- Seeding it from an existing Chrome profile is a valid convenience step.
- Do not expect a full transfer of working logged-in sessions.
- If a critical site still lands on login, do one manual login in the automation profile and keep reusing that same profile.

## Sources

- Chromium Docs: User Data Directory  
  https://chromium.googlesource.com/chromium/src/%2B/HEAD/docs/user_data_dir.md
- Google Online Security Blog: Improving the security of Chrome cookies on Windows  
  https://security.googleblog.com/2024/07/improving-security-of-chrome-cookies-on.html
- Playwright API: BrowserType.launchPersistentContext  
  https://playwright.dev/docs/api/class-browsertype
- Chrome for Developers: Changes to remote debugging switches to improve security  
  https://developer.chrome.com/blog/remote-debugging-port
- Playwright Authentication  
  https://playwright.dev/docs/auth
