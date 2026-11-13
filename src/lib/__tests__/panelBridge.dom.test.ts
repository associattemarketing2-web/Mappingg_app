import { bootHtml, bridgeScript, goToTab } from '../panelBridge';

// Each test gets a new <body>: bridge copies left from earlier tests keep watching the old one.
function freshBody() {
  document.documentElement.replaceChild(document.createElement('body'), document.body);
}

// A stand-in for the website's panel shell (components/admin/AdminApp.tsx):
// header with the bell + account menu, and the tab row.
function mountShell() {
  freshBody();
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

// The super-admin's grouped navigation (AdminApp.tsx NAV): a group with several
// sections opens a dropdown (.adm2-dd) on click; one-section groups open directly.
// The open section is kept in ?tab=, and the account menu sits on .adm2-user.
function mountGroupedShell() {
  freshBody();
  const NAV = [
    { label: 'Overview', tabs: [['dashboard', 'Overview']] },
    { label: 'Map & Projects', tabs: [['map', 'Map Editor'], ['pinsdata', 'Pins Data']] },
    { label: 'CRM & Leads', tabs: [['leads', 'Leads'], ['accounts', 'Accounts']] },
    { label: 'Developers', tabs: [['developers', 'Developers']] },
  ];
  const BADGE: Record<string, number> = { accounts: 2 };
  document.body.innerHTML = `
    <div class="adm2">
      <header class="adm2-top">
        <div class="adm2-top-right">
          <div class="nb-wrap"><button class="adm-chip nb-bell">bell</button></div>
          <button class="adm2-user" id="acct"><span class="who">PK</span><span class="who-meta"><b>Pushkar</b><small>Super Admin</small></span></button>
        </div>
      </header>
      <nav class="adm2-tabs"></nav>
      <main id="main"></main>
    </div>`;
  let tab = 'dashboard';
  let open: string | null = null;
  const nav = document.querySelector('.adm2-tabs')!;
  const render = () => {
    nav.innerHTML = '';
    document.querySelector('.adm2-dd')?.remove();
    for (const g of NAV) {
      const b = document.createElement('button');
      const single = g.tabs.length === 1;
      const waiting = g.tabs.reduce((n, [k]) => n + (BADGE[k!] || 0), 0);
      b.className = `adm2-tab${g.tabs.some(([k]) => k === tab) ? ' active' : ''}${open === g.label ? ' open' : ''}`;
      if (!single) b.setAttribute('aria-haspopup', 'menu');
      b.innerHTML = `<i class="fas"></i> ${g.label}${waiting ? `<span class="tab-badge">${waiting}</span>` : ''}${single ? '' : '<i class="caret"></i>'}`;
      b.addEventListener('click', () => {
        if (single) {
          tab = g.tabs[0]![0]!;
          open = null;
        } else open = open === g.label ? null : g.label;
        setTimeout(render, 10); // React re-renders after the click
      });
      nav.appendChild(b);
    }
    document.getElementById('main')!.textContent = tab;
    history.replaceState(null, '', `?tab=${tab}`);
    const g = NAV.find((x) => x.label === open);
    if (g) {
      const dd = document.createElement('div');
      dd.className = 'adm2-dd';
      for (const [k, l] of g.tabs) {
        const it = document.createElement('button');
        it.className = tab === k ? 'on' : '';
        it.innerHTML = `<i class="fas"></i><span><b>${l}</b><small>desc</small></span>${BADGE[k!] ? `<span class="tab-badge">${BADGE[k!]}</span>` : ''}`;
        it.addEventListener('click', () => {
          tab = k!;
          open = null;
          setTimeout(render, 10);
        });
        dd.appendChild(it);
      }
      document.body.appendChild(dd);
    }
  };
  render();
  const acct = document.getElementById('acct')!;
  acct.addEventListener('click', () => {
    const m = document.querySelector('.adm2-menu');
    if (m) return m.remove();
    const menu = document.createElement('div');
    menu.className = 'adm2-menu';
    for (const label of ['Profile', 'Backups', 'Settings', 'Lock to this panel', 'Sign out']) {
      const b = document.createElement('button');
      b.innerHTML = `<i class="fas"></i> ${label}`;
      b.addEventListener('click', () => {
        menu.remove();
        tab = label.toLowerCase();
        render();
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

  it('lists the sections inside grouped tabs (super-admin nav) and opens them', async () => {
    mountGroupedShell();
    window.eval(bridgeScript('shell'));
    await sleep(1200);

    const shell = () =>
      messages.filter((m) => m.type === 'shell').pop() as {
        tabs: { label: string; badge: string; active: boolean }[];
        menu: string[];
        active: string;
        name: string;
      };
    expect(shell().tabs.map((t) => t.label)).toEqual(['Overview', 'Map Editor', 'Pins Data', 'Leads', 'Accounts', 'Developers']);
    expect(shell().tabs.find((t) => t.label === 'Accounts')!.badge).toBe('2');
    expect(shell().active).toBe('Overview');
    expect(shell().menu).toEqual(['Profile', 'Backups', 'Settings']);
    expect(shell().name).toBe('Pushkar');
    expect(document.querySelector('.adm2-dd')).toBeNull(); // every dropdown closed again
    expect(document.querySelector('.adm2-menu')).toBeNull();

    window.eval(goToTab('Accounts'));
    await sleep(600);
    expect(document.getElementById('main')!.textContent).toBe('accounts');
    expect(shell().active).toBe('Accounts');
    expect(document.getElementById('mg-title')!.textContent).toBe('Accounts');

    window.eval(goToTab('Developers'));
    await sleep(500);
    expect(shell().active).toBe('Developers');

    window.eval(goToTab('Backups'));
    await sleep(500);
    expect(document.getElementById('main')!.textContent).toBe('backups');
    expect(shell().active).toBe('Backups');
  });

  it('keeps a tap made before the panel has loaded', async () => {
    window.eval(bridgeScript('shell'));
    window.eval(goToTab('Leads'));
    await sleep(200);
    mountGroupedShell();
    await sleep(1500);
    expect(document.getElementById('main')!.textContent).toBe('leads');
  });

  it('turns the logo (a link to the website home) into the app home', () => {
    mountShell();
    window.eval(bridgeScript('frame'));
    const logo = document.querySelector('a.adm2-brand') as HTMLAnchorElement;
    logo.setAttribute('target', '_blank');
    logo.click();
    expect(messages.some((m) => m.type === 'home')).toBe(true);
    messages.length = 0;
    const a = document.createElement('a');
    a.href = '/';
    document.body.appendChild(a);
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true });
    a.dispatchEvent(ev);
    expect(messages.some((m) => m.type === 'home')).toBe(true);
    expect(ev.defaultPrevented).toBe(true); // the WebView never leaves the panel
    expect(messages.find((m) => m.type === 'open')).toBeUndefined();
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
