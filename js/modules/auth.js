import { account } from '../data/appwrite.js';

const OFFLINE_KEY = 'titan_offline';
const OLD_TOKEN   = 'titan_auth';

// One-time migration from the old mock-auth localStorage token
if (localStorage.getItem(OLD_TOKEN) !== null) {
    if (localStorage.getItem(OLD_TOKEN) === 'offline') {
        localStorage.setItem(OFFLINE_KEY, '1');
    }
    localStorage.removeItem(OLD_TOKEN);
}

export function isOfflineMode() {
    return localStorage.getItem(OFFLINE_KEY) === '1';
}

const FORCE_AUTH_KEY = 'titan_force_auth';

// Checks for an existing Appwrite session and either skips the overlay
// (already authed) or shows it (needs login). Calls onAuthenticated(user|null).
export function initAuth(onAuthenticated) {
    const overlay = document.getElementById('authOverlay');
    if (!overlay) return;

    if (sessionStorage.getItem(FORCE_AUTH_KEY)) {
        sessionStorage.removeItem(FORCE_AUTH_KEY);
        _showOverlay(overlay, onAuthenticated);
        return;
    }

    if (isOfflineMode()) {
        overlay.style.display = 'none';
        onAuthenticated(null);
        return;
    }

    account.get()
        .then(user => {
            overlay.style.display = 'none';
            document.getElementById('geoBg')?.classList.add('geo-bg--active');
            onAuthenticated(user);
        })
        .catch(err => {
            // 401 = not logged in → show form; anything else = network/server issue → go offline
            if (err?.code === 401) {
                _showOverlay(overlay, onAuthenticated);
            } else {
                overlay.style.display = 'none';
                onAuthenticated(null);
            }
        });
}

function _showOverlay(overlay, onAuthenticated) {
    const emailEl  = document.getElementById('authEmail');
    const passEl   = document.getElementById('authPassword');
    const errorEl  = document.getElementById('authError');
    const submitEl = document.getElementById('authSubmit');

    let isSubmitting = false;

    function dismiss() {
        overlay.classList.add('auth--exit');
        setTimeout(() => { overlay.style.display = 'none'; }, 500);
    }

    function setError(msg) { errorEl.textContent = msg; }

    function setBusy(busy) {
        submitEl.querySelector('span').textContent = busy ? 'connecting…' : 'Enter';
        submitEl.disabled = busy;
    }

    submitEl.addEventListener('click', async () => {
        if (isSubmitting) return;

        const email = emailEl.value.trim();
        const pass  = passEl.value;

        if (!email || !pass) { setError('both fields required'); return; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setError('invalid email address');
            return;
        }

        setError('');
        isSubmitting = true;
        setBusy(true);

        try {
            await account.createEmailPasswordSession(email, pass);
            const user = await account.get();
            localStorage.removeItem(OFFLINE_KEY);
            dismiss();
            onAuthenticated(user);
        } catch (err) {
            setError(err.message || 'Authentication failed.');
            setBusy(false);
            isSubmitting = false;
        }
    });

    passEl.addEventListener('keydown',  e => { if (e.key === 'Enter') submitEl.click(); });
    emailEl.addEventListener('keydown', e => { if (e.key === 'Enter') passEl.focus(); });
}

// ── Custom confirm modal ───────────────────────────────────────────────────────
// Replaces the blocking native confirm() with a styled in-app dialog.
function showConfirmModal({ title, badge, color, lines, onConfirm }) {
    const c = color || '#fbbf24'; // amber default

    const wrap = document.createElement('div');
    wrap.style.cssText = [
        'position:fixed', 'inset:0',
        'background:rgba(0,0,0,.76)', 'backdrop-filter:blur(14px)',
        '-webkit-backdrop-filter:blur(14px)',
        'z-index:800', 'display:flex', 'align-items:center', 'justify-content:center',
        'padding:1rem',
    ].join(';');

    wrap.innerHTML = `
<div style="
  background:rgba(18, 18, 24, 0.85);
  backdrop-filter:blur(16px);
  -webkit-backdrop-filter:blur(16px);
  border:1px solid rgba(255,255,255,0.08);border-radius:20px;
  width:min(440px,100%);overflow:hidden;position:relative;
  animation:scFadeIn .2s cubic-bezier(.4,0,.2,1);
  box-shadow:0 20px 50px rgba(0,0,0,0.5);
">
  <div style="position:absolute;top:0;left:0;right:0;height:2px;
    background:linear-gradient(90deg,transparent,${c} 40%,${c}88 60%,transparent);"></div>

  <div style="padding:1.6rem 1.8rem 1.2rem;">
    <div style="display:flex;align-items:center;gap:.7rem;margin-bottom:1rem;">
      <span style="font-family:'Outfit',sans-serif;font-size:1.1rem;font-weight:700;
        letter-spacing:.08em;text-transform:uppercase;color:${c};">${title}</span>
      ${badge ? `<span style="font-family:'Outfit',sans-serif;font-size:.52rem;letter-spacing:.1em;
        text-transform:uppercase;padding:.18rem .55rem;border-radius:99px;
        background:${c}18;border:1px solid ${c}44;color:${c};">${badge}</span>` : ''}
    </div>
    <div style="display:flex;flex-direction:column;gap:.5rem;margin-bottom:1.5rem;">
      ${lines.map(l => `
        <div style="display:flex;align-items:flex-start;gap:.6rem;font-size:.84rem;color:#fafafa;line-height:1.4;">
          <span style="color:${c};margin-top:1px;flex-shrink:0;">•</span>${l}
        </div>`).join('')}
    </div>
  </div>

  <div style="display:flex;gap:.7rem;padding:0 1.8rem 1.6rem;">
    <button id="_tc-cancel" style="
      flex:1;padding:.72rem 1rem;border-radius:10px;
      border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);
      color:#a1a1aa;font-family:'Outfit',sans-serif;font-size:.78rem;font-weight:600;
      letter-spacing:.08em;text-transform:uppercase;cursor:pointer;transition:all .2s;">
      Cancel
    </button>
    <button id="_tc-ok" style="
      flex:1;padding:.72rem 1rem;border-radius:10px;
      border:1px solid ${c}66;background:${c}18;
      color:${c};font-family:'Outfit',sans-serif;font-size:.78rem;font-weight:600;
      letter-spacing:.08em;text-transform:uppercase;cursor:pointer;transition:all .2s;">
      Confirm →
    </button>
  </div>
</div>`;

    document.body.appendChild(wrap);

    const close = () => wrap.remove();
    wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
    wrap.querySelector('#_tc-cancel').addEventListener('click', close);
    wrap.querySelector('#_tc-ok').addEventListener('click', () => { close(); onConfirm(); });
}

export async function signOut() {
    try { await account.deleteSession('current'); } catch {}
    sessionStorage.setItem(FORCE_AUTH_KEY, '1');
    localStorage.removeItem(OFFLINE_KEY);
    location.reload();
}

export async function signOutHard() {
    showConfirmModal({
        title: 'Hard Sign Out',
        badge: 'FORCE',
        color: '#fbbf24',
        lines: [
            'End your current session',
            'Delete <strong>all</strong> local workout data',
            'Clear all cached SW files',
            '<span style="color:#34d399;">✓ Cloud data stays safe</span>',
        ],
        onConfirm: async () => {
            try { await account.deleteSession('current'); } catch {}
            sessionStorage.setItem(FORCE_AUTH_KEY, '1');
            localStorage.clear();

            if ('caches' in window) {
                const keys = await caches.keys().catch(() => []);
                await Promise.all(keys.map(k => caches.delete(k)));
            }

            if ('serviceWorker' in navigator) {
                const regs = await navigator.serviceWorker.getRegistrations().catch(() => []);
                await Promise.all(regs.map(r => r.unregister()));
            }

            location.reload();
        },
    });
}
