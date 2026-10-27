// Opens Plaid Link, Plaid's own window where you pick your bank and log in.
// Your bank password goes to Plaid inside that window; this app only receives a one-time token.
const SCRIPT_URL = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js'; // Plaid requires loading it from here

let scriptPromise;
function loadScript() {
  scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.onload = () => resolve(window.Plaid);
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("Could not load Plaid's login window. Check your internet connection."));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

/** Resolves with { publicToken, institution } on success, or null if you close the window. */
export async function openPlaidLink(linkToken) {
  const Plaid = await loadScript();
  return new Promise((resolve, reject) => {
    const handler = Plaid.create({
      token: linkToken,
      onSuccess: (publicToken, metadata) => {
        handler.destroy();
        resolve({ publicToken, institution: metadata?.institution?.name ?? 'Bank' });
      },
      onExit: (err) => {
        handler.destroy();
        if (err) reject(new Error(err.display_message || err.error_message || 'Plaid closed with an error'));
        else resolve(null);
      },
    });
    handler.open();
  });
}
