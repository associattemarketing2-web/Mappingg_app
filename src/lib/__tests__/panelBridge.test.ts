/**
 * @jest-environment jsdom
 */
import { bootHtml, bridgeScript, goToTab } from '../panelBridge';

// A stand-in for the website's panel shell (components/admin/AdminApp.tsx):
// header with the bell + account menu, and the tab row.
function mountShell() {
  document.body.innerHTML = `
    <div class="adm2">
      <header class="adm2-top">
        <a class="adm2-brand" href="/">Mappingg</a>
        <div class="adm2-top-right">
          <div class="nb-wrap"><button class="adm-chip nb-bell">bell</button></div>
          <a class="adm-chip" href="/map" target="_blank">View site</a>
          <button class="adm-chip" id="acct"><span class="who">PK</span><span class="who-meta"><b>Pushkar</b><small>Owner</small></span></button>
        </div>
      </header>
      <nav class="adm2-tabs">
        <button class="adm2-tab active"><i class="fas"></i> Dashboard</button>
        <button class="adm2-tab"><i class="fas"></i> Leads</button>
        <button class="adm2-tab"><i class="fas"></i> Accounts<span class="tab-badge">3</span></button>
      </nav>
      <main id="main"></main>
    </div>`;
  const tabs = Array.from(document.querySelectorAll<HTMLButtonElement>('.adm2-tab'));
  const select = (b: Element | null) => {
    tabs.forEach((t) => t.classList.toggle('active', t === b));
    document.getElementById('main')!.textContent = b ? b.textContent || '' : 'menu page';
  };
  tabs.forEach((t) => t.addEventListener('click', () => select(t)));
  const acct = document.getElementById('acct')!;
  acct.addEventListener('click', () => {
    const open = document.querySelector('.adm2-menu');
    if (open) return open.remove();
    const menu = document.createElement('div');
    menu.className = 'adm2-menu';
    for (const label of ['Profile', 'Settings', 'Lock to this panel', 'Sign out']) {
      const b = document.createElement('button');
      b.innerHTML = `<i class="fas"></i> ${label}`;
      b.addEventListener('click', () => {
        menu.remove();
        if (label === 'Profile' || label === 'Settings') select(null);
      });
      menu.appendChild(b);
    }
    acct.parentElement!.appendChild(menu);
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('panel bridge', () => {
  let messages: Record<string, unknown>[];
  beforeEach(() => {
    messages = [];
    (window as unknown as { __mgApp?: boolean }).__mgApp = undefined;
    (window as unknown as { ReactNativeWebView: unknown }).ReactNativeWebView = {
      postMessage: (s: string) => messages.push(JSON.parse(s)),
    };
  });

  it('builds valid JavaScript', () => {
    expect(() => new Function(bridgeScript('shell'))).not.toThrow();
    expect(() => new Function(bridgeScript('frame'))).not.toThrow();
    expect(() => new Function(goToTab('Leads "x" </script>'))).not.toThrow();
    const html = bootHtml({ token: 'a.b.c', email: 'A@B.com', target: 'https://www.mappingg.com/dashboard/s-admin', secure: true });
    const script = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
    expect(() => new Function(script)).not.toThrow();
    expect(script).toContain('mg_session=a.b.c');
    expect(script).toContain('"a@b.com"');
  });

  it('reports the panel tabs, badges and account menu, and switches tabs', async () => {
    mountShell();
    window.eval(bridgeScript('shell'));
    await sleep(400);

    const shell = messages.filter((m) => m.type === 'shell').pop() as {
      tabs: { label: string; badge: string; active: boolean }[];
      menu: string[];
      active: string;
      name: string;
    };
    expect(shell.tabs.map((t) => t.label)).toEqual(['Dashboard', 'Leads', 'Accounts']);
    expect(shell.tabs[2]!.badge).toBe('3');
    expect(shell.active).toBe('Dashboard');
    expect(shell.menu).toEqual(['Profile', 'Settings']);
    expect(shell.name).toBe('Pushkar');
    expect(document.querySelector('.adm2-menu')).toBeNull(); // probe closed it again
    expect(document.getElementById('mg-title')!.textContent).toBe('Dashboard');
    expect(document.getElementById('mg-app-css')).not.toBeNull();

    window.eval(goToTab('Leads'));
    await sleep(300);
    expect((messages.filter((m) => m.type === 'shell').pop() as { active: string }).active).toBe('Leads');

    window.eval(goToTab('Settings'));
    await sleep(400);
    expect((messages.filter((m) => m.type === 'shell').pop() as { active: string }).active).toBe('Settings');
    expect(document.getElementById('mg-title')!.textContent).toBe('Settings');
  });

  it('sends new-window links, clipboard and share to the app', async () => {
    mountShell();
    window.eval(bridgeScript('shell'));
    (document.querySelector('a[target=_blank]') as HTMLAnchorElement).click();
    window.open('https://wa.me/911234567890?text=hi');
    await navigator.clipboard.writeText('P51700000001');
    await navigator.share({ text: 'Lead details' });
    const types = messages.map((m) => m.type);
    expect(messages.find((m) => m.type === 'open' && String(m.url).endsWith('/map'))).toBeTruthy();
    expect(messages.find((m) => m.type === 'open' && String(m.url).startsWith('https://wa.me/'))).toBeTruthy();
    expect(messages.find((m) => m.type === 'clipboard')?.text).toBe('P51700000001');
    expect(types).toContain('share');
  });
});
