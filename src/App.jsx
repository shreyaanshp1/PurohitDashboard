import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowUpDown,
  BarChart3,
  Bell,
  Coins,
  CreditCard,
  Factory,
  FolderClosed,
  Gem,
  Home,
  KeyRound,
  MailCheck,
  MapPin,
  Package,
  Plane,
  Plus,
  ReceiptText,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShoppingCart,
  Trash2,
  UserRound,
  Users,
  X
} from "lucide-react";
import PurchaseLogger from "./components/PurchaseLogger.jsx";
import ReceiptLogger from "./components/ReceiptLogger.jsx";
import { useToast } from "./components/ToastProvider.jsx";
import { COSTCO_ORDER_GMAIL_QUERY } from "./services/costcoGmailQuery.js";
import { US_MINT_CONFIRMED_ORDER_GMAIL_QUERY } from "./services/usMintGmailQuery.js";
import {
  alertRules,
  alerts,
  buyers,
  COSTCO_EXECUTIVE_REWARD_CAP,
  COSTCO_EXECUTIVE_REWARD_RATE,
  COSTCO_RENEWAL_REMINDER_LEAD_DAYS,
  COSTCO_RENEWAL_REMINDER_PHONE,
  commodities,
  costco,
  costcoAccounts,
  costcoManualPulls,
  costcoRenewalReminders,
  costcoRewardKpis,
  costcoRewardRows,
  dell,
  homeKpis,
  navItems,
  portfolioCards,
  recentActivity,
  reports,
  rewards,
  syncSettings,
  usMint,
  usMintAccountDetailGroups,
  usMintAccounts
} from "./data.js";
import {
  clearCostcoOrders,
  clearUsMintOrders,
  appendSpreadsheetSourceRow,
  appendTravelSheetRow,
  createReceiptFolder,
  getGoogleOAuthStatus,
  getGoogleOAuthUrl,
  importCostcoOrders,
  importUsMintOrders,
  listCostcoOrders,
  listSpreadsheetSource,
  listTravelMasterData,
  listTravelSheets,
  listUsMintOrders,
  listReceiptFolders,
  listReceipts,
  updateSpreadsheetSourceRow
} from "./services/purchaseLog.js";
import {
  clearAuthSession,
  readAuthSession,
  unlockDashboardWithPassword
} from "./services/auth.js";

const iconMap = {
  home: Home,
  costco: ShoppingCart,
  profile: UserRound,
  travel: Plane,
  usMint: Gem,
  dell: Factory,
  commodities: Coins,
  receipts: ReceiptText,
  buyers: Users,
  rewards: BarChart3,
  alerts: Bell,
  reports: Package,
  settings: Settings
};

const columns = {
  costcoOrders: ["status", "order", "membership", "item", "itemNumber", "quantity", "subtotal", "tax", "total", "date", "action"],
  costcoCombinedOrders: ["source", "status", "order", "membership", "item", "itemNumber", "quantity", "subtotal", "tax", "total", "date", "action"],
  costcoRewards: ["account", "membership", "reward", "remaining", "spendNeeded", "cycleStart", "cycleEnd", "updated", "status"],
  costcoRenewals: ["status", "account", "membership", "role", "renewalDate", "reminderDate", "expirationDate", "daysUntil", "priority", "action"],
  costcoTransactions: ["date", "account", "membership", "item", "quantity", "subtotal", "tax", "total", "status", "action"],
  usMintOrders: ["status", "order", "item", "unitType", "quantity", "subtotal", "total", "date", "action"],
  releases: ["release", "date", "accounts", "quantity", "charge", "buyer", "action"],
  subscriptions: ["account", "items", "card", "address", "status"],
  dellOrders: ["account", "order", "item", "rewards", "status", "buyer", "profit"],
  dellRewards: ["source", "expected", "status", "action"],
  inventory: ["item", "quantity", "basis", "value", "gain", "buyer"],
  rewards: ["source", "amount", "status", "nextAction"],
  alerts: ["date", "portfolio", "alert", "action", "priority"],
  settings: ["source", "query", "status", "cadence"]
};

const costcoTabs = ["Accounts", "Transactions", "Rewards Planner", "Renewals", "Google Sheets", "Gmail Import"];
const costcoSortableOrderColumns = ["status", "item", "date"];
const travelSheetNames = ["Trips", "Flights", "Certificates_Awards"];
const travelMasterDataSheetNames = [
  "Travelers",
  "Hotel_Properties",
  "Hotel_Brands",
  "Airports",
  "National_Park_States",
  "Cities",
  "Currencies",
  "Airlines",
  "Credit_Cards",
  "National Parks",
  "Traveler_Loyalty_Accounts",
  "States_Provinces",
  "Rental_Car_Companies",
  "Expense_Categories",
  "Hotel_Chains",
  "Loyalty_Programs",
  "Place_Types",
  "Countries"
];
const travelMasterDataTab = "Master Data";
const travelTabs = ["Dashboard", ...travelSheetNames, travelMasterDataTab];
const fallbackTravelSheets = travelSheetNames.map((name) => ({
  name,
  headers: getDefaultTravelHeaders(name),
  rows: [],
  rowCount: 0
}));
const usMintTabs = ["Accounts", "Email Orders", "Release Calendar", "Subscriptions", "Expected Charges", "Buyer Sales", "Google Sheets"];
const googleOAuthMessageType = "google-oauth-complete";
const googleOAuthPopupFeatures = "popup=yes,width=520,height=720,left=160,top=80";
const googleOAuthWaitMs = 120000;
const googleOAuthDisabledStorageKey = "portfolio-google-oauth-disabled";
const costcoAccountEditStorageKey = "portfolio-costco-account-edits";

async function connectGoogleOAuth({ googleOAuthDisabled = false, notifyError, notifySuccess, setGoogleStatus }) {
  if (googleOAuthDisabled) {
    const status = { authenticated: false, configured: false, disabled: true };
    setGoogleStatus?.(status);
    notifyError("Google OAuth is disabled.", "Turn it back on in Settings before connecting Gmail.");
    return status;
  }

  let oauthWindow = null;

  try {
    oauthWindow = openGoogleOAuthWindow();
    const result = await getGoogleOAuthUrl({ returnUrl: window.location.href });

    if (!result.authUrl) {
      throw new Error("Google OAuth URL was not returned.");
    }

    if (!oauthWindow || oauthWindow.closed) {
      window.location.assign(result.authUrl);
      return null;
    }

    oauthWindow.location.href = result.authUrl;
    notifySuccess("Google OAuth opened.");

    const completion = await waitForGoogleOAuthCompletion(oauthWindow);
    const latestStatus = await getGoogleOAuthStatus();
    setGoogleStatus(latestStatus);

    if (latestStatus.authenticated) {
      notifySuccess("Gmail connected.");
      return latestStatus;
    }

    notifyError(
      "Google OAuth was not completed.",
      completion?.error || "Close any stale Google OAuth tabs and try again."
    );
    return latestStatus;
  } catch (error) {
    if (oauthWindow && !oauthWindow.closed) {
      oauthWindow.close();
    }

    console.error("Failed to open Google OAuth", error);
    notifyError("Could not open Google OAuth.", error.message);
    return null;
  }
}

function openGoogleOAuthWindow() {
  const popup = window.open("", "google-oauth", googleOAuthPopupFeatures);

  if (!popup) {
    return null;
  }

  try {
    popup.document.title = "Connecting Gmail";
    popup.document.body.innerHTML = `
      <main style="font-family: system-ui, sans-serif; padding: 24px;">
        <h1 style="font-size: 20px; margin: 0 0 8px;">Connecting Gmail</h1>
        <p style="color: #475569; line-height: 1.5; margin: 0;">Waiting for Google OAuth...</p>
      </main>
    `;
    popup.focus();
  } catch {
    // The popup is navigated immediately after the OAuth URL returns.
  }

  return popup;
}

function waitForGoogleOAuthCompletion(oauthWindow) {
  return new Promise((resolve) => {
    let isSettled = false;

    const finish = (result) => {
      if (isSettled) return;
      isSettled = true;
      window.removeEventListener("message", handleMessage);
      window.clearInterval(pollId);
      window.clearTimeout(timeoutId);
      resolve(result);
    };

    const handleMessage = (event) => {
      if (event.data?.type !== googleOAuthMessageType) return;
      finish(event.data);
    };

    const pollId = window.setInterval(() => {
      if (oauthWindow.closed) {
        finish({ error: "The Google OAuth tab closed before Gmail connected.", success: false });
      }
    }, 600);

    const timeoutId = window.setTimeout(() => {
      finish({ error: "Timed out waiting for Google OAuth to finish.", success: false });
    }, googleOAuthWaitMs);

    window.addEventListener("message", handleMessage);
  });
}

function App() {
  const [activePage, setActivePage] = useState("home");
  const [query, setQuery] = useState("");
  const [session, setSession] = useState(readAuthSession());
  const [googleOAuthDisabled, setGoogleOAuthDisabled] = useState(readGoogleOAuthDisabledPreference());

  const pageTitle = navItems.find((item) => item.id === activePage)?.label || "Home";

  useEffect(() => {
    const storedSession = readAuthSession();
    if (storedSession) {
      setSession(storedSession);
    }
  }, []);

  function handleLogout() {
    clearAuthSession();
    setSession(null);
  }

  function setGoogleOAuthDisabledPreference(disabled) {
    const nextValue = Boolean(disabled);
    setGoogleOAuthDisabled(nextValue);
    writeGoogleOAuthDisabledPreference(nextValue);
  }

  if (!session) {
    return <AuthPage onAuthenticated={setSession} />;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brand-lockup">
          <span className="brand-mark">SP</span>
          <div>
            <p className="eyebrow">Operations</p>
            <h1>Santosh Portfolio</h1>
          </div>
        </div>

        <nav className="nav-list">
          {navItems.map((item) => {
            const Icon = iconMap[item.id];
            return (
              <button
                className={`nav-item ${activePage === item.id ? "is-active" : ""}`}
                key={item.id}
                onClick={() => setActivePage(item.id)}
                type="button"
              >
                <Icon size={17} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <p className="eyebrow">Signed in</p>
          <strong>{session.name}</strong>
          <span>{session.role}</span>
          <button className="secondary-action auth-logout" onClick={handleLogout} type="button">
            Log out
          </button>
        </div>
      </aside>

      <main className="main-content">
        <Header title={pageTitle} activePage={activePage} query={query} setQuery={setQuery} />
        <Page
          activePage={activePage}
          googleOAuthDisabled={googleOAuthDisabled}
          onToggleGoogleOAuthDisabled={setGoogleOAuthDisabledPreference}
          query={query}
          session={session}
          setActivePage={setActivePage}
        />
      </main>
    </div>
  );
}

function AuthPage({ onAuthenticated }) {
  const [isPromptOpen, setIsPromptOpen] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [authError, setAuthError] = useState("");
  const [password, setPassword] = useState("");
  const { notifyError, notifySuccess } = useToast();

  function openPrompt() {
    setAuthError("");
    setPassword("");
    setIsPromptOpen(true);
  }

  function closePrompt() {
    if (isAuthenticating) return;
    setIsPromptOpen(false);
    setAuthError("");
    setPassword("");
  }

  async function handlePasswordUnlock(event) {
    event.preventDefault();
    setIsAuthenticating(true);
    setAuthError("");

    try {
      const result = await unlockDashboardWithPassword({ password });
      onAuthenticated(result);
      notifySuccess("Dashboard unlocked.");
    } catch (error) {
      setAuthError(error.message);
      notifyError("Unlock failed.", error.message);
    } finally {
      setIsAuthenticating(false);
    }
  }

  return (
    <div className="auth-page">
      <section className="auth-card password-gate-card">
        <div className="auth-card__header">
          <p className="eyebrow">Admin access</p>
          <h2>Dashboard locked</h2>
          <p>Use the dashboard password to open the admin workspace.</p>
        </div>
      </section>

      <button className="password-gate-button" onClick={openPrompt} type="button">
        <KeyRound size={18} />
        <span>Enter</span>
      </button>

      {isPromptOpen ? (
        <div className="password-gate-modal" role="presentation">
          <button className="logger-modal__backdrop" aria-label="Close password prompt" onClick={closePrompt} type="button" />
          <form aria-modal="true" className="password-gate-panel" onSubmit={handlePasswordUnlock} role="dialog">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Admin password</p>
                <h3>Enter dashboard</h3>
              </div>
              <button className="icon-button" onClick={closePrompt} type="button" aria-label="Close password prompt">
                <X size={18} />
              </button>
            </div>
            <label className="auth-field">
              <span>Password</span>
              <input
                autoComplete="current-password"
                autoFocus
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Dashboard password"
                type="password"
                value={password}
              />
            </label>
            <AuthStatus error={authError} />
            <button className="purchase-submit auth-submit" disabled={isAuthenticating || !password} type="submit">
              <KeyRound size={16} />
              <span>{isAuthenticating ? "Checking..." : "Unlock dashboard"}</span>
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function AuthStatus({ error, message }) {
  if (error) return <p className="auth-error">{error}</p>;
  if (message) return <p className="auth-message">{message}</p>;
  return null;
}

function readGoogleOAuthDisabledPreference() {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(googleOAuthDisabledStorageKey) === "true";
}

function writeGoogleOAuthDisabledPreference(disabled) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(googleOAuthDisabledStorageKey, disabled ? "true" : "false");
}

function Header({ title, activePage, query, setQuery }) {
  return (
    <section className="page-header">
      <div>
        <p className="eyebrow">{activePage === "home" ? "Command center" : activePage === "profile" ? "Profile" : "Dashboard"}</p>
        <h2>{activePage === "home" ? "Santosh Portfolio Command Center" : title}</h2>
      </div>
      <div className="header-tools">
        <label className="search-box">
          <Search size={16} />
          <input
            aria-label="Search visible dashboard data"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            value={query}
          />
        </label>
      </div>
    </section>
  );
}

function Page({ activePage, googleOAuthDisabled, onToggleGoogleOAuthDisabled, setActivePage, query, session }) {
  if (activePage === "home") return <HomePage setActivePage={setActivePage} query={query} />;
  if (activePage === "profile") return <ProfilePage query={query} session={session} setActivePage={setActivePage} />;
  if (activePage === "costco") return <CostcoPage googleOAuthDisabled={googleOAuthDisabled} query={query} />;
  if (activePage === "travel") return <TravelPage query={query} />;
  if (activePage === "usMint") return <UsMintPage googleOAuthDisabled={googleOAuthDisabled} query={query} />;
  if (activePage === "dell") return <DellPage query={query} />;
  if (activePage === "commodities") return <CommoditiesPage query={query} />;
  if (activePage === "receipts") return <ReceiptsPage query={query} />;
  if (activePage === "buyers") return <BuyersPage query={query} />;
  if (activePage === "rewards") return <RewardsPage query={query} />;
  if (activePage === "alerts") return <AlertsPage query={query} />;
  if (activePage === "reports") return <ReportsPage query={query} />;
  return (
    <SettingsPage
      googleOAuthDisabled={googleOAuthDisabled}
      onToggleGoogleOAuthDisabled={onToggleGoogleOAuthDisabled}
      query={query}
    />
  );
}

function HomePage({ setActivePage, query }) {
  const [isPurchaseLoggerOpen, setIsPurchaseLoggerOpen] = useState(false);
  const homeSummaryItems = useMemo(() => buildHomeSummaryItems(), []);

  return (
    <>
      <KpiGrid items={homeSummaryItems} />
      {isPurchaseLoggerOpen ? (
        <PurchaseLoggerModal onClose={() => setIsPurchaseLoggerOpen(false)} />
      ) : null}
      <CostcoHomePanel setActivePage={setActivePage} />
      <section className="portfolio-grid">
        {portfolioCards.map((portfolio) => (
          <article className={`portfolio-card tone-${portfolio.tone}`} key={portfolio.id}>
            <div className="card-heading">
              <div>
                <p className="eyebrow">{portfolio.metric}</p>
                <h3>{portfolio.name}</h3>
              </div>
              <span className="portfolio-value">{portfolio.value || "—"}</span>
            </div>
            <dl className="detail-list">
              <div>
                <dt>Next action</dt>
                <dd>{portfolio.nextAction}</dd>
              </div>
              <div>
                <dt>Urgent alert</dt>
                <dd>{portfolio.alert}</dd>
              </div>
            </dl>
            <button className="text-action" onClick={() => setActivePage(portfolio.id)} type="button">
              <span>Open dashboard</span>
              <ArrowRight size={16} />
            </button>
          </article>
        ))}
      </section>
      <section className="content-grid two-column">
        <Panel eyebrow="Alerts" title="Action Items">
          <AlertList items={filterRows(alerts, query).slice(0, 5)} />
        </Panel>
        <Panel eyebrow="Data pipeline" title="Recent Activity">
          <DataTable columns={["time", "source", "event", "status"]} rows={filterRows(recentActivity, query)} />
        </Panel>
      </section>
      {!isPurchaseLoggerOpen ? (
        <FloatingActionButton label="Log a purchase" onClick={() => setIsPurchaseLoggerOpen(true)} />
      ) : null}
    </>
  );
}

function CostcoHomePanel({ setActivePage }) {
  const priorityAccounts = getCostcoPriorityAccounts(costcoAccounts, 2);

  return (
    <section className="home-priority-panel">
      <Panel
        eyebrow="Costco priority"
        title="Renewals and Rewards"
        aside={`${formatCurrency(costcoRewardRows.reduce((total, row) => total + (row.spendNeededAmount || 0), 0))} spend needed`}
      >
        <div className="home-costco-priority">
          <div className="home-costco-metrics">
            <div>
              <span>Total Rewards Earned</span>
              <strong>{formatCurrency(costcoRewardRows.reduce((total, row) => total + (row.rewardAmount || 0), 0))}</strong>
            </div>
            <div>
              <span>Spend Needed To Cap</span>
              <strong>{formatCurrency(costcoRewardRows.reduce((total, row) => total + (row.spendNeededAmount || 0), 0))}</strong>
            </div>
          </div>

          <div className="home-costco-account-list">
            {priorityAccounts.map((account) => (
              <div className={`home-costco-account status-row-${costcoStatusTone(account)}`} key={account.id}>
                <div>
                  <strong>{account.ownerName || "Unknown owner"}</strong>
                  <span>
                    {account.membershipNumber || "Pending"} · renews {account.renewalOpens || account.expirationDate || "—"}
                  </span>
                </div>
                <span className={statusPillClass(account.status)}>{account.status || "Unknown"}</span>
              </div>
            ))}
          </div>

          <button className="text-action" onClick={() => setActivePage("costco")} type="button">
            <span>Open Costco accounts</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </Panel>
    </section>
  );
}

function ProfilePage({ query, session, setActivePage }) {
  const snapshot = useMemo(() => buildProfileSnapshot(session), [session]);
  const visibleStats = filterRows(snapshot.statCards, query);
  const visiblePortfolios = filterRows(snapshot.portfolioItems, query);
  const visibleTimeline = filterRows(snapshot.timelineItems, query);

  return (
    <>
      <section className="profile-hero">
        <div className="profile-identity">
          <span className="profile-avatar">{snapshot.initials}</span>
          <div className="profile-copy">
            <p className="eyebrow">Operator profile</p>
            <h3>{snapshot.name}</h3>
            <p>{snapshot.summary}</p>
            <div className="profile-badge-row">
              {snapshot.badges.map((badge) => (
                <span className="status-pill muted" key={badge}>
                  {badge}
                </span>
              ))}
            </div>
          </div>
        </div>

        <dl className="profile-social-stats">
          {snapshot.socialStats.map((stat) => (
            <div key={stat.label}>
              <dt>{stat.label}</dt>
              <dd>{stat.value}</dd>
              <small>{stat.detail}</small>
            </div>
          ))}
        </dl>
      </section>

      <section className="profile-stat-grid">
        {visibleStats.map((item) => (
          <ProfileStatCard item={item} key={item.label} />
        ))}
        {visibleStats.length ? null : <p className="empty-copy">No matching profile stats</p>}
      </section>

      <section className="content-grid wide-left">
        <Panel eyebrow="Portfolio footprint" title="Dashboards Owned" aside={`${visiblePortfolios.length} areas`}>
          <ProfilePortfolioList items={visiblePortfolios} setActivePage={setActivePage} />
        </Panel>

        <Panel eyebrow="Account health" title="Priority Signals">
          <dl className="reward-rule-list profile-health-list">
            {snapshot.healthSignals.map((signal) => (
              <div key={signal.label}>
                <dt>{signal.label}</dt>
                <dd>{signal.value}</dd>
                <small>{signal.detail}</small>
              </div>
            ))}
          </dl>
        </Panel>
      </section>

      <section className="content-grid two-column">
        <Panel eyebrow="Activity" title="Profile Highlights" aside={`${visibleTimeline.length} signals`}>
          <ProfileTimeline items={visibleTimeline} />
        </Panel>

        <Panel eyebrow="Network" title="Buyer and Reward Coverage">
          <RelationshipList items={snapshot.coverageItems} />
        </Panel>
      </section>
    </>
  );
}

function ProfileStatCard({ item }) {
  const Icon = item.icon;

  return (
    <article className={`profile-stat-card tone-${item.tone}`}>
      <span className={`profile-stat-icon tone-${item.tone}`}>
        <Icon size={19} />
      </span>
      <p>{item.label}</p>
      <strong>{item.value}</strong>
      <span>{item.detail}</span>
    </article>
  );
}

function ProfilePortfolioList({ items, setActivePage }) {
  if (!items.length) return <p className="empty-copy">No matching portfolio areas</p>;

  return (
    <div className="profile-portfolio-list">
      {items.map((item) => {
        const Icon = iconMap[item.id] || Package;

        return (
          <button className="profile-portfolio-row" key={item.id} onClick={() => setActivePage(item.id)} type="button">
            <span className={`profile-portfolio-icon tone-${item.tone}`}>
              <Icon size={18} />
            </span>
            <span className="profile-portfolio-body">
              <strong>{item.name}</strong>
              <small>{item.detail}</small>
            </span>
            <span className="profile-portfolio-value">
              <strong>{item.value}</strong>
              <small>{item.nextAction}</small>
              <ArrowRight size={16} />
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ProfileTimeline({ items }) {
  if (!items.length) return <p className="empty-copy">No matching profile highlights</p>;

  return (
    <div className="profile-timeline">
      {items.map((item) => (
        <div className="profile-timeline-row" key={`${item.source}-${item.event}`}>
          <span className={`priority-dot ${item.priority}`} />
          <div>
            <strong>{item.source}</strong>
            <p>{item.event}</p>
          </div>
          <span className="table-pill">{item.status}</span>
        </div>
      ))}
    </div>
  );
}

function SpreadsheetSourceWorkspace({ sourceId, fallbackColumns, fallbackRows, preferredSheetNames = [], query, title }) {
  const sourceState = useSpreadsheetSource(sourceId);
  const [activeSheetName, setActiveSheetName] = useState("");
  const [isLogOpen, setIsLogOpen] = useState(false);
  const activeSheet = getActiveSpreadsheetSheet(sourceState.sheets, activeSheetName);
  const hasConnectedRows = sourceState.configured && activeSheet && !activeSheet.error;
  const columnsToShow = hasConnectedRows ? spreadsheetColumns(activeSheet, fallbackColumns) : fallbackColumns;
  const rowsToShow = filterRows(hasConnectedRows ? activeSheet.rows : fallbackRows, query);
  const sheetLabels = sourceState.sheets.map((sheet) => sheet.name);
  const canAddRow = Boolean(hasConnectedRows && columnsToShow.length);
  const aside = sourceState.isLoading
    ? "Loading"
    : sourceState.configured
      ? `${rowsToShow.length} rows`
      : "Static fallback";

  useEffect(() => {
    if (!activeSheetName && sourceState.sheets[0]?.name) {
      const preferredSheet = sourceState.sheets.find((sheet) =>
        preferredSheetNames.some((name) => sheet.name.toLowerCase() === name.toLowerCase())
      );
      setActiveSheetName((preferredSheet || sourceState.sheets[0]).name);
    }
  }, [activeSheetName, preferredSheetNames, sourceState.sheets]);

  return (
    <>
      <section className="sheet-source-toolbar">
        <div>
          <p className="eyebrow">Google Sheets</p>
          <h3>{sourceState.label || title}</h3>
          <span>{sourceState.configured ? "Connected through service account" : sourceState.message}</span>
        </div>
        <div className="toolbar-actions">
          <span className={`status-pill ${sourceState.configured ? "" : "muted"}`}>
            {sourceState.configured ? "Sheets connected" : "Not connected"}
          </span>
          <button className="secondary-action" disabled={sourceState.isLoading} onClick={() => sourceState.refresh({ silent: true })} type="button">
            <RefreshCw className={sourceState.isLoading ? "spin" : ""} size={18} />
            <span>{sourceState.isLoading ? "Refreshing..." : "Refresh"}</span>
          </button>
          <button className="purchase-submit" disabled={!canAddRow} onClick={() => setIsLogOpen(true)} type="button">
            <Plus size={18} />
            <span>Log Row</span>
          </button>
        </div>
      </section>

      {sheetLabels.length > 1 ? (
        <TabStrip labels={sheetLabels} activeLabel={activeSheet?.name || sheetLabels[0]} onSelect={setActiveSheetName} />
      ) : null}

      <Panel eyebrow={sourceState.configured ? "Spreadsheet rows" : "Local fallback"} title={activeSheet?.name || title} aside={aside}>
        {activeSheet?.error ? <p className="empty-copy">Sheet unavailable: {activeSheet.error}</p> : null}
        {columnsToShow.length ? (
          <DataTable columns={columnsToShow} rows={rowsToShow} sortableColumns={columnsToShow.slice(0, 4)} />
        ) : (
          <p className="empty-copy">No headers found for this sheet.</p>
        )}
      </Panel>

      {isLogOpen && activeSheet ? (
        <SpreadsheetLogModal
          onClose={() => setIsLogOpen(false)}
          onSaved={() => sourceState.refresh({ silent: false })}
          sheet={activeSheet}
          sourceId={sourceId}
          sourceLabel={sourceState.label || title}
        />
      ) : null}
    </>
  );
}

function SpreadsheetLogModal({ onClose, onSaved, sheet, sourceId, sourceLabel }) {
  const headers = spreadsheetColumns(sheet, []);
  const [values, setValues] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const { notifyError, notifySuccess } = useToast();

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSaving(true);

    try {
      await appendSpreadsheetSourceRow({ sheetName: sheet.name, source: sourceId, values });
      notifySuccess(`Added row to ${sourceLabel}.`, sheet.name);
      await onSaved?.();
      onClose();
    } catch (error) {
      console.error("Failed to append spreadsheet row", error);
      notifyError("Could not add spreadsheet row.", error.message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="logger-modal" role="presentation">
      <button className="logger-modal__backdrop" aria-label="Close spreadsheet logger" onClick={onClose} type="button" />
      <form aria-modal="true" className="logger-modal__surface travel-log-panel" onSubmit={handleSubmit} role="dialog">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{sourceLabel}</p>
            <h3>Log {sheet.name} Row</h3>
          </div>
          <button className="icon-button" onClick={onClose} type="button" aria-label="Close spreadsheet logger">
            <X size={18} />
          </button>
        </div>

        <div className="travel-form-grid">
          {headers.map((header) => (
            <label className={`travel-field ${isLongTravelField(header) ? "travel-field-full" : ""}`} key={header}>
              <span>{header}</span>
              {isLongTravelField(header) ? (
                <textarea
                  onChange={(event) => setValues((current) => ({ ...current, [header]: event.target.value }))}
                  rows={3}
                  value={values[header] || ""}
                />
              ) : (
                <input
                  onChange={(event) => setValues((current) => ({ ...current, [header]: event.target.value }))}
                  type={getTravelInputType(header)}
                  value={values[header] || ""}
                />
              )}
            </label>
          ))}
        </div>

        <div className="travel-modal-actions">
          <button className="secondary-action" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="purchase-submit" disabled={isSaving || !headers.length} type="submit">
            <Plus size={18} />
            <span>{isSaving ? "Adding..." : "Add Row"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

function useSpreadsheetSource(sourceId) {
  const [state, setState] = useState({
    configured: false,
    isLoading: true,
    label: "",
    message: "",
    sheets: [],
    source: sourceId
  });
  const { notifyError, notifySuccess } = useToast();

  const refresh = useCallback(
    async ({ silent = false } = {}) => {
      setState((current) => ({ ...current, isLoading: true }));

      try {
        const result = await listSpreadsheetSource(sourceId);
        setState({
          configured: Boolean(result.configured),
          isLoading: false,
          label: result.label || sourceId,
          message: result.message || "",
          sheets: result.sheets || [],
          source: result.source || sourceId
        });
        if (silent) notifySuccess("Spreadsheet data refreshed.", result.label || sourceId);
      } catch (error) {
        console.error("Failed to load spreadsheet source", error);
        setState((current) => ({ ...current, isLoading: false, message: error.message }));
        notifyError("Could not load spreadsheet source.", error.message);
      }
    },
    [notifyError, notifySuccess, sourceId]
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    ...state,
    refresh
  };
}

function getActiveSpreadsheetSheet(sheets, activeSheetName) {
  if (!sheets.length) return null;
  return sheets.find((sheet) => sheet.name === activeSheetName) || sheets[0];
}

function spreadsheetColumns(sheet, fallbackColumns) {
  const headers = (sheet?.headers || []).filter((header) => header && header !== "id");
  return headers.length ? headers : fallbackColumns;
}

function PurchaseLoggerModal({ onClose }) {
  return (
    <div className="logger-modal" role="presentation">
      <button className="logger-modal__backdrop" aria-label="Close purchase logger" onClick={onClose} type="button" />
      <div aria-modal="true" className="logger-modal__surface" role="dialog">
        <PurchaseLogger onClose={onClose} />
      </div>
    </div>
  );
}

function CostcoPage({ googleOAuthDisabled, query }) {
  const [orders, setOrders] = useState([]);
  const [activeCostcoTab, setActiveCostcoTab] = useState("Accounts");
  const [selectedCostcoAccountId, setSelectedCostcoAccountId] = useState(costcoAccounts[0]?.id || "");
  const [costcoAccountEdits, setCostcoAccountEdits] = useState(readCostcoAccountEdits);
  const [googleStatus, setGoogleStatus] = useState({ authenticated: false, configured: false });
  const [importResult, setImportResult] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isImportingHistory, setIsImportingHistory] = useState(false);
  const { notifyError, notifySuccess } = useToast();
  const costcoSheetSource = useSpreadsheetSource("costco");

  useEffect(() => {
    let isCurrent = true;

    async function loadCostcoData() {
      setIsLoading(true);

      const [statusResult, ordersResult] = await Promise.allSettled([
        googleOAuthDisabled ? Promise.resolve({ authenticated: false, configured: false, disabled: true }) : getGoogleOAuthStatus(),
        listCostcoOrders({ limit: 1000 })
      ]);

      if (!isCurrent) return;

      if (statusResult.status === "fulfilled") {
        setGoogleStatus(statusResult.value);
      } else {
        console.error("Failed to load Google OAuth status", statusResult.reason);
        notifyError("Could not load Google OAuth status.", statusResult.reason.message);
      }

      if (ordersResult.status === "fulfilled") {
        setOrders(ordersResult.value.orders || []);
      } else {
        console.error("Failed to load Costco data", ordersResult.reason);
        notifyError("Could not load Costco order rows.", ordersResult.reason.message);
      }

      setIsLoading(false);
    }

    loadCostcoData();

    return () => {
      isCurrent = false;
    };
  }, [googleOAuthDisabled, notifyError]);

  const visibleOrders = filterRows(orders, query);
  const visibleManualPulls = filterRows(costcoManualPulls, query);
  const visibleCombinedOrders = filterRows(
    [
      ...orders.map((order) => ({ ...order, source: "Gmail" })),
      ...costcoManualPulls.map((order) => ({ ...order, source: order.source || "Manual Pull" }))
    ],
    query
  );
  const sheetCostcoAccounts = useMemo(() => buildCostcoAccountsFromSheetSource(costcoSheetSource), [costcoSheetSource.sheets]);
  const sourceCostcoAccounts = sheetCostcoAccounts.length ? sheetCostcoAccounts : costcoAccounts;
  const editableCostcoAccounts = useMemo(
    () => sortCostcoAccounts(applyCostcoAccountEdits(sourceCostcoAccounts, costcoAccountEdits)),
    [costcoAccountEdits, sourceCostcoAccounts]
  );
  const visibleCostcoAccounts = useMemo(() => filterRows(editableCostcoAccounts, query), [editableCostcoAccounts, query]);
  const visibleRenewalReminders = useMemo(() => filterRows(costcoRenewalReminders, query), [query]);
  const costcoSummaryItems = useMemo(
    () =>
      costco.summary.map((item) =>
        item.label === "Transactions"
          ? {
              ...item,
              value: String(orders.length),
              detail: orders.length ? "Imported transaction rows" : "Waiting for Google Sheets rows"
            }
          : item
      ),
    [orders.length]
  );
  const selectedCostcoAccount =
    visibleCostcoAccounts.find((account) => account.id === selectedCostcoAccountId) ||
    visibleCostcoAccounts[0] ||
    editableCostcoAccounts.find((account) => account.id === selectedCostcoAccountId) ||
    editableCostcoAccounts[0];
  const orderTableAside = importResult
    ? formatImportResultAside(importResult)
    : orders.length
      ? `${orders.length} imported`
      : "Raw email bodies excluded";
  const isCostcoBusy = isClearing || isImporting || isImportingHistory;
  const gmailStatus = isLoading
    ? "Loading"
    : googleOAuthDisabled || googleStatus.disabled
      ? "OAuth disabled"
      : googleStatus.authenticated
      ? "Gmail connected"
      : googleStatus.configured
        ? "Gmail ready"
        : "OAuth missing";

  async function handleConnectGmail() {
    return connectGoogleOAuth({ googleOAuthDisabled, notifyError, notifySuccess, setGoogleStatus });
  }

  async function handleImportOrders({ allHistory = false } = {}) {
    if (googleOAuthDisabled) {
      notifyError("Google OAuth is disabled.", "Turn it back on in Settings before importing Gmail.");
      return;
    }

    let latestStatus = await getGoogleOAuthStatus();
    setGoogleStatus(latestStatus);

    if (!latestStatus.authenticated) {
      latestStatus = await handleConnectGmail();
      if (!latestStatus?.authenticated) return;
    }

    const setWorking = allHistory ? setIsImportingHistory : setIsImporting;
    setWorking(true);

    try {
      const result = await importCostcoOrders({
        limit: allHistory ? 10000 : 5000,
        limitPerBatch: allHistory ? 1000 : "",
        historyStartYear: allHistory ? 2010 : "",
        query: COSTCO_ORDER_GMAIL_QUERY
      });
      const ordersResult = await listCostcoOrders({ limit: 1000 });
      setOrders(ordersResult.orders || result.orders || []);
      setImportResult(result);
      notifySuccess(`Scanned ${result.scanned} Costco emails; imported ${result.imported}.`);
    } catch (error) {
      console.error("Failed to import Costco orders", error);
      notifyError("Costco import failed.", error.message);
    } finally {
      setWorking(false);
    }
  }

  async function handleClearOrders() {
    const shouldClear = window.confirm(
      "Clear imported Costco order rows from this dashboard? Gmail emails will not be deleted."
    );

    if (!shouldClear) return;

    setIsClearing(true);

    try {
      const result = await clearCostcoOrders();
      setOrders([]);
      setImportResult(null);
      notifySuccess(`Cleared ${result.deleted || 0} imported Costco order rows.`);
    } catch (error) {
      console.error("Failed to clear Costco orders", error);
      notifyError("Could not clear Costco order rows.", error.message);
    } finally {
      setIsClearing(false);
    }
  }

  function handleSendRenewalReminder(reminder) {
    window.location.href = buildSmsHref(reminder.phone || COSTCO_RENEWAL_REMINDER_PHONE, reminder.message);
    notifySuccess("SMS reminder opened.", `Message prepared for ${reminder.phone || COSTCO_RENEWAL_REMINDER_PHONE}.`);
  }

  async function handleSaveCostcoAccount(nextAccount) {
    const nextEdits = {
      ...costcoAccountEdits,
      [nextAccount.id]: nextAccount
    };

    setCostcoAccountEdits(nextEdits);
    writeCostcoAccountEdits(nextEdits);

    if (nextAccount.sheetName && nextAccount.sheetRowNumber) {
      try {
        await updateSpreadsheetSourceRow({
          rowNumber: nextAccount.sheetRowNumber,
          sheetName: nextAccount.sheetName,
          source: "costco",
          values: nextAccount.raw
        });
        notifySuccess("Costco account updated.", "Saved back to Google Sheets.");
        await costcoSheetSource.refresh({ silent: false });
      } catch (error) {
        console.error("Failed to update Costco account sheet row", error);
        notifyError("Saved locally, but Sheets update failed.", error.message);
      }
      return;
    }

    notifySuccess("Costco account updated.", "Saved as a local dashboard draft.");
  }

  return (
    <>
      <TabStrip labels={costcoTabs} activeLabel={activeCostcoTab} onSelect={setActiveCostcoTab} />
      <KpiGrid items={costcoSummaryItems} compact />

      {activeCostcoTab === "Accounts" ? (
        <CostcoAccountsTab
          accounts={visibleCostcoAccounts}
          onSelectAccount={setSelectedCostcoAccountId}
          onSaveAccount={handleSaveCostcoAccount}
          selectedAccount={selectedCostcoAccount}
          sheetSource={costcoSheetSource}
        />
      ) : null}

      {activeCostcoTab === "Transactions" ? (
        <SpreadsheetSourceWorkspace
          fallbackColumns={columns.costcoTransactions}
          fallbackRows={visibleCombinedOrders}
          preferredSheetNames={["Transactions", "Orders"]}
          query={query}
          sourceId="costco"
          title="Costco Transactions"
        />
      ) : null}

      {activeCostcoTab === "Gmail Import" ? (
        <>
          <section className="receipt-toolbar">
            <div>
              <p className="eyebrow">Gmail OAuth</p>
              <h3>Costco Email Orders</h3>
            </div>
            <div className="toolbar-actions">
              <span className={`status-pill ${googleStatus.authenticated && !googleOAuthDisabled ? "" : "muted"}`}>{gmailStatus}</span>
              <button className="secondary-action" disabled={googleOAuthDisabled || !googleStatus.configured || isCostcoBusy} onClick={handleConnectGmail} type="button">
                <MailCheck size={18} />
                <span>Connect Gmail</span>
              </button>
              <button className="secondary-action" disabled={isCostcoBusy || !orders.length} onClick={handleClearOrders} type="button">
                <Trash2 size={18} />
                <span>{isClearing ? "Clearing..." : "Clear Batch"}</span>
              </button>
              <button className="secondary-action" disabled={googleOAuthDisabled || !googleStatus.configured || isCostcoBusy} onClick={() => handleImportOrders()} type="button">
                <RefreshCw className={isImporting ? "spin" : ""} size={18} />
                <span>{isImporting ? "Importing..." : "Import Emails"}</span>
              </button>
              <button className="purchase-submit" disabled={googleOAuthDisabled || !googleStatus.configured || isCostcoBusy} onClick={() => handleImportOrders({ allHistory: true })} type="button">
                <RefreshCw className={isImportingHistory ? "spin" : ""} size={18} />
                <span>{isImportingHistory ? "Importing..." : "Import All History"}</span>
              </button>
            </div>
          </section>

          <Panel eyebrow="Gmail records" title="Order Email History" aside={orderTableAside}>
            <DataTable columns={columns.costcoOrders} rows={visibleOrders} sortableColumns={costcoSortableOrderColumns} />
          </Panel>
        </>
      ) : null}

      {activeCostcoTab === "Manual Pulls" ? (
        <Panel eyebrow="Google Sheets / Excel" title="Manual Pull Order Rows" aside={`${visibleManualPulls.length} rows`}>
          <DataTable columns={columns.costcoCombinedOrders} rows={visibleManualPulls} />
          {visibleManualPulls.length ? null : (
            <p className="table-footnote">Manual pull rows will appear here once the Google Sheets or Excel reader is connected.</p>
          )}
        </Panel>
      ) : null}

      {activeCostcoTab === "Combined Table" ? (
        <Panel eyebrow="All sources" title="Combined Costco Orders" aside={`${visibleCombinedOrders.length} rows`}>
          <DataTable columns={columns.costcoCombinedOrders} rows={visibleCombinedOrders} sortableColumns={["source", "status", "item", "date"]} />
        </Panel>
      ) : null}

      {activeCostcoTab === "Rewards Planner" ? (
        <CostcoRewardsTab query={query} />
      ) : null}

      {activeCostcoTab === "Renewals" ? (
        <CostcoRenewalsTab reminders={visibleRenewalReminders} onSendReminder={handleSendRenewalReminder} />
      ) : null}

      {activeCostcoTab === "Google Sheets" ? (
        <SpreadsheetSourceWorkspace
          fallbackColumns={columns.costcoOrders}
          fallbackRows={costco.orders}
          query={query}
          sourceId="costco"
          title="Costco Sheets"
        />
      ) : null}

    </>
  );
}

function CostcoRewardsTab({ query }) {
  const rewardRows = filterRows(costcoRewardRows, query);
  const progressItems = rewardRows.map((row) => ({
    account: `${row.account} · ${row.membership}`,
    current: row.reward,
    target: formatCurrency(COSTCO_EXECUTIVE_REWARD_CAP),
    remaining: row.remaining,
    progress: row.progress
  }));

  return (
    <>
      <KpiGrid items={costcoRewardKpis} compact />
      <section className="content-grid wide-left">
        <Panel eyebrow="Reward planner" title="Executive Reward Accounts" aside={`${rewardRows.length} tracked`}>
          <DataTable columns={columns.costcoRewards} rows={rewardRows} />
        </Panel>

        <Panel eyebrow="Rule set" title="Executive 2% Reward">
          <dl className="reward-rule-list">
            <div>
              <dt>Rate</dt>
              <dd>{COSTCO_EXECUTIVE_REWARD_RATE * 100}%</dd>
            </div>
            <div>
              <dt>Cycle Cap</dt>
              <dd>{formatCurrency(COSTCO_EXECUTIVE_REWARD_CAP)}</dd>
            </div>
            <div>
              <dt>Spend to Cap</dt>
              <dd>{formatCurrency(COSTCO_EXECUTIVE_REWARD_CAP / COSTCO_EXECUTIVE_REWARD_RATE)}</dd>
            </div>
            <div>
              <dt>Basis</dt>
              <dd>Qualified pre-tax purchases</dd>
            </div>
          </dl>
          <p className="reward-note">
            Taxes, shipping, returns, Costco Shop Cards, and other excluded categories are kept out of the reward math.
          </p>
        </Panel>
      </section>

      <Panel eyebrow="Cap progress" title="Reward Cap Progress">
        <ProgressList items={progressItems} />
      </Panel>
    </>
  );
}

function CostcoRenewalsTab({ reminders, onSendReminder }) {
  const dueReminders = reminders.filter((reminder) => reminder.isVisible);
  const scheduledReminders = reminders.filter((reminder) => !reminder.isVisible);
  const nextScheduledReminder = scheduledReminders[0]?.reminderDate || "—";

  return (
    <>
      <section className="content-grid wide-left">
        <Panel eyebrow="Reminder queue" title="Renewal Reminders" aside={`${dueReminders.length} due`}>
          {dueReminders.length ? (
            <div className="renewal-reminder-list">
              {dueReminders.map((reminder) => (
                <div className={`renewal-reminder-row status-row-${statusToneFromText(reminder.priority)}`} key={`${reminder.membership}-${reminder.account}`}>
                  <span className={`priority-dot ${reminder.priority.toLowerCase()}`} />
                  <div className="renewal-reminder-body">
                    <strong>{reminder.account}</strong>
                    <span>
                      {reminder.membership} · {reminder.renewalDate} · {reminder.status}
                    </span>
                    <p>{reminder.message}</p>
                  </div>
                  <button className="secondary-action" onClick={() => onSendReminder(reminder)} type="button">
                    <Send size={16} />
                    <span>Send SMS</span>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-copy">No renewal reminders are due today.</p>
          )}
        </Panel>

        <Panel eyebrow="Reminder settings" title={COSTCO_RENEWAL_REMINDER_PHONE}>
          <dl className="reward-rule-list">
            <div>
              <dt>Lead Time</dt>
              <dd>{COSTCO_RENEWAL_REMINDER_LEAD_DAYS} days</dd>
            </div>
            <div>
              <dt>Due Now</dt>
              <dd>{dueReminders.length}</dd>
            </div>
            <div>
              <dt>Next Reminder</dt>
              <dd>{nextScheduledReminder}</dd>
            </div>
            <div>
              <dt>Destination</dt>
              <dd>{COSTCO_RENEWAL_REMINDER_PHONE}</dd>
            </div>
            <div>
              <dt>Message Mode</dt>
              <dd>2-week SMS queue</dd>
            </div>
          </dl>
        </Panel>
      </section>

      <Panel eyebrow="Schedule" title="Upcoming Renewal Windows" aside={`${reminders.length} active memberships`}>
        <DataTable columns={columns.costcoRenewals} rows={reminders} />
      </Panel>
    </>
  );
}

function CostcoAccountsTab({ accounts, onSaveAccount, onSelectAccount, selectedAccount, sheetSource }) {
  const [draftAccount, setDraftAccount] = useState(selectedAccount);

  useEffect(() => {
    setDraftAccount(selectedAccount);
  }, [selectedAccount]);

  if (!selectedAccount) {
    return (
      <Panel eyebrow="Accounts" title="Costco Account Profiles">
        <p className="empty-copy">No matching Costco accounts</p>
      </Panel>
    );
  }

  const accountCounts = getCostcoAccountCounts(accounts);
  const verificationCount = accounts.filter((account) => account.needsVerification === "Yes").length;
  const editFields = [
    { field: "Owner Name", label: "Owner", type: "text" },
    { field: "Membership #", label: "Membership #", type: "text" },
    { field: "Role", label: "Role", type: "select", options: ["Primary", "Household/Add-on", "Needs Verification"] },
    { field: "Membership Type", label: "Membership Type", type: "text" },
    { field: "Executive?", label: "Executive", type: "select", options: ["Yes", "No", "Unknown"] },
    { field: "Status", label: "Status", type: "select", options: ["Active", "Verify Membership", "Needs Verification", "Needs Activation/Verification", "Inactive"] },
    { field: "Sign-In Email", label: "Sign-In Email", type: "email" },
    { field: "Profile Email", label: "Profile Email", type: "email" },
    { field: "Phone", label: "Phone", type: "tel" },
    { field: "Address", label: "Address", type: "textarea" },
    { field: "Expiration Date", label: "Expiration", type: "date" },
    { field: "Renewal Opens", label: "Renewal Opens", type: "date" },
    { field: "Reward Cycle Start", label: "Cycle Start", type: "date" },
    { field: "Reward Last Updated", label: "Reward Last Updated", type: "date" },
    { field: "Estimated 2% Reward", label: "Estimated Reward", type: "text" },
    { field: "Spend Needed to Cap", label: "Spend Needed", type: "text" },
    { field: "Needs Verification?", label: "Needs Verification", type: "select", options: ["No", "Yes"] },
    { field: "Notes", label: "Notes", type: "textarea" }
  ];

  function updateDraftField(field, value) {
    setDraftAccount((current) => buildCostcoAccountFromRaw({ ...current, raw: { ...(current?.raw || {}), [field]: value } }));
  }

  async function handleSave(event) {
    event.preventDefault();
    await onSaveAccount?.(draftAccount);
  }

  return (
    <section className="costco-account-browser">
      <aside className="costco-account-list" aria-label="Costco account profiles">
        <div className="account-browser-heading">
          <div>
            <p className="eyebrow">Profiles</p>
            <h3>{accounts.length} Accounts</h3>
          </div>
          <span className="status-pill muted">
            {accountCounts.primary} primary · {accountCounts.household} household
          </span>
        </div>
        <p className="account-source-note">
          {sheetSource?.configured ? "Accounts are pulled from Google Sheets." : "Showing local fallback until COSTCO_SPREADSHEET_ID is set."}
        </p>
        <div className="costco-account-list-scroll">
          {accounts.map((account) => (
            <button
              className={`costco-account-row status-row-${costcoStatusTone(account)} ${selectedAccount.id === account.id ? "is-selected" : ""}`}
              key={account.id}
              onClick={() => onSelectAccount(account.id)}
              type="button"
            >
              <span>
                <strong>{account.ownerName || "Unknown owner"}</strong>
                <small>{account.membershipNumber || "Membership pending"}</small>
              </span>
              <em>{account.role}</em>
            </button>
          ))}
        </div>
      </aside>

      <form className="panel costco-account-detail" onSubmit={handleSave}>
        <div className="section-heading">
          <div>
            <p className="eyebrow">{draftAccount?.membershipType}</p>
            <h3>{draftAccount?.ownerName || "Unknown owner"}</h3>
          </div>
          <div className="account-status-stack">
            <span className={statusPillClass(draftAccount?.status)}>{draftAccount?.status || "Unknown"}</span>
            {draftAccount?.needsVerification === "Yes" ? <span className="status-pill status-warning">Needs verification</span> : null}
          </div>
        </div>

        <dl className="account-overview-list">
          <div>
            <dt>Membership #</dt>
            <dd>{draftAccount?.membershipNumber || "Pending"}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>{draftAccount?.role}</dd>
          </div>
          <div>
            <dt>Expiration</dt>
            <dd>{draftAccount?.expirationDate || "—"}</dd>
          </div>
          <div>
            <dt>Estimated Reward</dt>
            <dd>{draftAccount?.estimatedReward || "—"}</dd>
          </div>
        </dl>

        <div className="account-edit-grid">
          {editFields.map((item) => (
            <label className={`travel-field ${item.type === "textarea" ? "travel-field-full" : ""}`} key={item.field}>
              <span>{item.label}</span>
              {item.type === "select" ? (
                <select onChange={(event) => updateDraftField(item.field, event.target.value)} value={draftAccount?.raw?.[item.field] || ""}>
                  <option value="">—</option>
                  {item.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : item.type === "textarea" ? (
                <textarea
                  onChange={(event) => updateDraftField(item.field, event.target.value)}
                  rows={3}
                  value={draftAccount?.raw?.[item.field] || ""}
                />
              ) : (
                <input
                  onChange={(event) =>
                    updateDraftField(
                      item.field,
                      item.type === "date" ? formatInputDateForDisplay(event.target.value) : event.target.value
                    )
                  }
                  type={item.type}
                  value={item.type === "date" ? formatDateForInput(draftAccount?.raw?.[item.field]) : draftAccount?.raw?.[item.field] || ""}
                />
              )}
            </label>
          ))}
        </div>

        <div className="travel-modal-actions">
          <span className="account-save-note">
            {draftAccount?.sheetName && draftAccount?.sheetRowNumber
              ? `Saves to ${draftAccount.sheetName} row ${draftAccount.sheetRowNumber}`
              : "Saves locally until the Costco Accounts sheet is connected"}
          </span>
          <button className="purchase-submit" type="submit">
            <span>Save Account</span>
          </button>
        </div>

        {verificationCount ? <p className="account-footnote">{verificationCount} visible account records need verification.</p> : null}
      </form>
    </section>
  );
}

function TravelPage({ query }) {
  const [sheets, setSheets] = useState(fallbackTravelSheets);
  const [masterDataSheets, setMasterDataSheets] = useState([]);
  const [activeTravelTab, setActiveTravelTab] = useState("Dashboard");
  const [activeMasterDataTab, setActiveMasterDataTab] = useState(travelMasterDataSheetNames[0]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTravelLogOpen, setIsTravelLogOpen] = useState(false);
  const [lastFetchedAt, setLastFetchedAt] = useState("");
  const [masterDataFetchedAt, setMasterDataFetchedAt] = useState("");
  const [masterDataError, setMasterDataError] = useState("");
  const { notifyError, notifySuccess } = useToast();

  async function loadTravelData({ silent = false } = {}) {
    if (!silent) setIsLoading(true);

    try {
      const [travelResult, masterDataResult] = await Promise.allSettled([listTravelSheets(), listTravelMasterData()]);
      const fetchedAt = new Date().toISOString();

      if (travelResult.status === "fulfilled") {
        setSheets(mergeTravelSheets(travelResult.value.sheets));
        setLastFetchedAt(travelResult.value.fetchedAt || fetchedAt);
      }

      if (masterDataResult.status === "fulfilled") {
        setMasterDataSheets(masterDataResult.value.sheets || []);
        setMasterDataFetchedAt(masterDataResult.value.fetchedAt || fetchedAt);
        setMasterDataError("");
      } else {
        const message = masterDataResult.reason?.message || "Could not load travel master data.";
        setMasterDataError(message);
        if (!silent) notifyError("Could not load travel master data.", message);
      }

      if (travelResult.status === "rejected") {
        throw travelResult.reason;
      }

      if (silent) notifySuccess("Travel data refreshed.");
    } catch (error) {
      console.error("Failed to load travel spreadsheet", error);
      notifyError("Could not load travel spreadsheet.", error.message);
    } finally {
      if (!silent) setIsLoading(false);
    }
  }

  useEffect(() => {
    let isCurrent = true;

    async function loadInitialTravelData() {
      setIsLoading(true);

      try {
        const [travelResult, masterDataResult] = await Promise.allSettled([listTravelSheets(), listTravelMasterData()]);
        const fetchedAt = new Date().toISOString();
        if (!isCurrent) return;

        if (travelResult.status === "fulfilled") {
          setSheets(mergeTravelSheets(travelResult.value.sheets));
          setLastFetchedAt(travelResult.value.fetchedAt || fetchedAt);
        }

        if (masterDataResult.status === "fulfilled") {
          setMasterDataSheets(masterDataResult.value.sheets || []);
          setMasterDataFetchedAt(masterDataResult.value.fetchedAt || fetchedAt);
          setMasterDataError("");
        } else {
          const message = masterDataResult.reason?.message || "Could not load travel master data.";
          setMasterDataError(message);
          notifyError("Could not load travel master data.", message);
        }

        if (travelResult.status === "rejected") {
          throw travelResult.reason;
        }
      } catch (error) {
        console.error("Failed to load travel spreadsheet", error);
        if (isCurrent) notifyError("Could not load travel spreadsheet.", error.message);
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    }

    loadInitialTravelData();

    return () => {
      isCurrent = false;
    };
  }, [notifyError]);

  const sheetMap = useMemo(() => new Map(sheets.map((sheet) => [sheet.name, sheet])), [sheets]);
  const masterDataMap = useMemo(() => new Map(masterDataSheets.map((sheet) => [sheet.name, sheet])), [masterDataSheets]);
  const tripsSheet = sheetMap.get("Trips") || fallbackTravelSheets[0];
  const flightsSheet = sheetMap.get("Flights") || fallbackTravelSheets[1];
  const certificatesSheet = sheetMap.get("Certificates_Awards") || fallbackTravelSheets[2];
  const activeSheet = sheetMap.get(activeTravelTab);
  const isMasterDataTab = activeTravelTab === travelMasterDataTab;
  const masterDataTabs = masterDataSheets.length ? masterDataSheets.map((sheet) => sheet.name) : travelMasterDataSheetNames;
  const activeMasterDataSheet = masterDataMap.get(activeMasterDataTab) || masterDataSheets[0] || null;
  const activeMasterDataSheetName = activeMasterDataSheet?.name || activeMasterDataTab;
  const activeMasterDataRows = filterRows(activeMasterDataSheet?.rows || [], query);
  const activeMasterDataColumns = getVisibleMasterDataColumns(activeMasterDataSheet);
  const masterDataRowCount = masterDataSheets.reduce((total, sheet) => total + (sheet.rowCount || sheet.rows?.length || 0), 0);
  const activeSheetRows = filterRows(activeSheet?.rows || [], query);
  const travelKpis = buildTravelKpis({ tripsSheet, flightsSheet, certificatesSheet });
  const expiringAwards = getExpiringTravelRows(certificatesSheet.rows);
  const statusText = isLoading ? "Loading" : lastFetchedAt ? "Sheets connected" : "Ready";

  return (
    <>
      <TabStrip labels={travelTabs} activeLabel={activeTravelTab} onSelect={setActiveTravelTab} />

      <section className="travel-command">
        <div>
          <p className="eyebrow">Google Sheets</p>
          <h3>Travel Planner Dashboard</h3>
          <span>Trips · Flights · Certificates_Awards · read-only master data</span>
        </div>
        <div className="toolbar-actions">
          <span className={`status-pill ${lastFetchedAt ? "" : "muted"}`}>{statusText}</span>
          <button className="secondary-action" disabled={isLoading} onClick={() => loadTravelData({ silent: true })} type="button">
            <RefreshCw className={isLoading ? "spin" : ""} size={18} />
            <span>{isLoading ? "Refreshing..." : "Refresh"}</span>
          </button>
          {!isMasterDataTab ? (
            <button className="purchase-submit" onClick={() => setIsTravelLogOpen(true)} type="button">
              <Plus size={18} />
              <span>Add Row</span>
            </button>
          ) : null}
        </div>
      </section>

      <KpiGrid items={travelKpis} compact />

      {activeTravelTab === "Dashboard" ? (
        <>
          <section className="content-grid wide-left">
            <Panel eyebrow="Trips" title="Upcoming Trips" aside={`${tripsSheet.rows.length} rows`}>
              <TravelSummaryList
                rows={filterRows(tripsSheet.rows, query).slice(0, 5)}
                icon={MapPin}
                primaryAliases={["Trip", "Trip Name", "Name", "Destination"]}
                secondaryAliases={["Start Date", "Date", "End Date", "Status"]}
              />
            </Panel>

            <Panel eyebrow="Action center" title="Travel Actions" aside={`${expiringAwards.length} alerts`}>
              <TravelActionList certificates={expiringAwards.slice(0, 5)} />
            </Panel>
          </section>

          <section className="content-grid two-column">
            <Panel eyebrow="Flights" title="Upcoming Flights" aside={`${flightsSheet.rows.length} rows`}>
              <DataTable
                columns={getVisibleTravelColumns(flightsSheet).slice(0, 7)}
                rows={filterRows(flightsSheet.rows, query).slice(0, 6)}
                sortableColumns={getVisibleTravelColumns(flightsSheet).slice(0, 3)}
              />
            </Panel>

            <Panel eyebrow="Awards" title="Certificates and Awards" aside={`${certificatesSheet.rows.length} rows`}>
              <DataTable
                columns={getVisibleTravelColumns(certificatesSheet).slice(0, 7)}
                rows={filterRows(certificatesSheet.rows, query).slice(0, 6)}
                sortableColumns={getVisibleTravelColumns(certificatesSheet).slice(0, 3)}
              />
            </Panel>
          </section>
        </>
      ) : null}

      {activeTravelTab !== "Dashboard" && !isMasterDataTab && activeSheet ? (
        <Panel eyebrow="Spreadsheet rows" title={activeTravelTab} aside={`${activeSheetRows.length} rows`}>
          <DataTable
            columns={getVisibleTravelColumns(activeSheet)}
            rows={activeSheetRows}
            sortableColumns={getVisibleTravelColumns(activeSheet).slice(0, 4)}
          />
        </Panel>
      ) : null}

      {isMasterDataTab ? (
        <Panel eyebrow="Read-only master workbook" title="Travel Reference Data" aside={`${masterDataRowCount} rows`}>
          <div className="reference-toolbar">
            <span className="status-pill">Read only</span>
            <span className={`status-pill ${masterDataFetchedAt ? "" : "muted"}`}>
              {masterDataFetchedAt ? "Master sheet connected" : "Waiting for master sheet"}
            </span>
          </div>

          <TabStrip labels={masterDataTabs} activeLabel={activeMasterDataSheetName} onSelect={setActiveMasterDataTab} />

          {masterDataError ? <p className="empty-copy">Master data unavailable: {masterDataError}</p> : null}

          {activeMasterDataColumns.length ? (
            <DataTable
              columns={activeMasterDataColumns}
              rows={activeMasterDataRows}
              sortableColumns={activeMasterDataColumns.slice(0, 4)}
            />
          ) : (
            <p className="empty-copy">No reference rows loaded for {activeMasterDataSheetName}.</p>
          )}
        </Panel>
      ) : null}

      {isTravelLogOpen && !isMasterDataTab ? (
        <TravelLogModal
          activeSheetName={activeTravelTab === "Dashboard" ? "Trips" : activeTravelTab}
          onClose={() => setIsTravelLogOpen(false)}
          onSaved={() => loadTravelData({ silent: false })}
          sheets={sheets}
        />
      ) : null}
    </>
  );
}

function TravelSummaryList({ rows, icon: Icon, primaryAliases, secondaryAliases }) {
  if (!rows.length) return <p className="empty-copy">No matching travel rows</p>;

  return (
    <div className="travel-summary-list">
      {rows.map((row) => (
        <div className="travel-summary-row" key={row.id || JSON.stringify(row)}>
          <span className="travel-summary-icon">
            <Icon size={18} />
          </span>
          <div>
            <strong>{getTravelRowValue(row, primaryAliases) || "Travel row"}</strong>
            <span>{getTravelSecondaryText(row, secondaryAliases)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function TravelActionList({ certificates }) {
  if (!certificates.length) return <p className="empty-copy">No expiring awards found</p>;

  return (
    <div className="travel-action-list">
      {certificates.map((row) => (
        <div className="travel-action-row" key={row.id || JSON.stringify(row)}>
          <span className="travel-summary-icon amber">
            <CreditCard size={18} />
          </span>
          <div>
            <strong>{getTravelRowValue(row, ["Certificate/Award", "Award", "Certificate", "Program"]) || "Award"}</strong>
            <span>{getTravelSecondaryText(row, ["Expiration Date", "Expiration", "Expires", "Status"])}</span>
          </div>
          <span className="table-pill">Review</span>
        </div>
      ))}
    </div>
  );
}

function TravelLogModal({ activeSheetName, onClose, onSaved, sheets }) {
  const initialSheetName = travelSheetNames.includes(activeSheetName) ? activeSheetName : "Trips";
  const [sheetName, setSheetName] = useState(initialSheetName);
  const [values, setValues] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const { notifyError, notifySuccess } = useToast();
  const sheet = sheets.find((item) => item.name === sheetName) || fallbackTravelSheets.find((item) => item.name === sheetName);
  const headers = getVisibleTravelColumns(sheet);

  useEffect(() => {
    setValues({});
  }, [sheetName]);

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSaving(true);

    try {
      await appendTravelSheetRow({ sheetName, values });
      notifySuccess(`Added row to ${sheetName}.`);
      await onSaved?.();
      onClose();
    } catch (error) {
      console.error("Failed to append travel row", error);
      notifyError("Could not add travel row.", error.message);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="logger-modal" role="presentation">
      <button className="logger-modal__backdrop" aria-label="Close travel logger" onClick={onClose} type="button" />
      <form aria-modal="true" className="logger-modal__surface travel-log-panel" onSubmit={handleSubmit} role="dialog">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Google Sheets row</p>
            <h3>Add Travel Row</h3>
          </div>
          <button className="icon-button" onClick={onClose} type="button" aria-label="Close travel logger">
            <X size={18} />
          </button>
        </div>

        <label className="travel-field travel-field-full">
          <span>Sheet</span>
          <select onChange={(event) => setSheetName(event.target.value)} value={sheetName}>
            {travelSheetNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>

        <div className="travel-form-grid">
          {headers.map((header) => (
            <label className={`travel-field ${isLongTravelField(header) ? "travel-field-full" : ""}`} key={header}>
              <span>{header}</span>
              {isLongTravelField(header) ? (
                <textarea
                  onChange={(event) => setValues((current) => ({ ...current, [header]: event.target.value }))}
                  rows={3}
                  value={values[header] || ""}
                />
              ) : (
                <input
                  onChange={(event) => setValues((current) => ({ ...current, [header]: event.target.value }))}
                  type={getTravelInputType(header)}
                  value={values[header] || ""}
                />
              )}
            </label>
          ))}
        </div>

        <div className="travel-modal-actions">
          <button className="secondary-action" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="purchase-submit" disabled={isSaving} type="submit">
            <Plus size={18} />
            <span>{isSaving ? "Adding..." : "Add Row"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}

function UsMintPage({ googleOAuthDisabled, query }) {
  const [orders, setOrders] = useState([]);
  const [activeUsMintTab, setActiveUsMintTab] = useState("Accounts");
  const [selectedUsMintAccountId, setSelectedUsMintAccountId] = useState(usMintAccounts[0]?.id || "");
  const [googleStatus, setGoogleStatus] = useState({ authenticated: false, configured: false });
  const [importResult, setImportResult] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isImportingHistory, setIsImportingHistory] = useState(false);
  const { notifyError, notifySuccess } = useToast();

  useEffect(() => {
    let isCurrent = true;

    async function loadUsMintData() {
      setIsLoading(true);

      const [statusResult, ordersResult] = await Promise.allSettled([
        googleOAuthDisabled ? Promise.resolve({ authenticated: false, configured: false, disabled: true }) : getGoogleOAuthStatus(),
        listUsMintOrders({ limit: 1000 })
      ]);

      if (!isCurrent) return;

      if (statusResult.status === "fulfilled") {
        setGoogleStatus(statusResult.value);
      } else {
        console.error("Failed to load Google OAuth status", statusResult.reason);
        notifyError("Could not load Google OAuth status.", statusResult.reason.message);
      }

      if (ordersResult.status === "fulfilled") {
        setOrders(ordersResult.value.orders || []);
      } else {
        console.error("Failed to load US Mint data", ordersResult.reason);
        notifyError("Could not load US Mint order rows.", ordersResult.reason.message);
      }

      setIsLoading(false);
    }

    loadUsMintData();

    return () => {
      isCurrent = false;
    };
  }, [googleOAuthDisabled, notifyError]);

  const visibleOrders = filterRows(orders, query);
  const visibleUsMintAccounts = useMemo(() => filterRows(usMintAccounts, query), [query]);
  const selectedUsMintAccount =
    visibleUsMintAccounts.find((account) => account.id === selectedUsMintAccountId) ||
    visibleUsMintAccounts[0] ||
    usMintAccounts.find((account) => account.id === selectedUsMintAccountId) ||
    usMintAccounts[0];
  const orderTotal = orders.reduce((total, order) => total + (Number(order.totalAmount) || 0), 0);
  const confirmedCount = orders.filter((order) => order.status === "Confirmed").length;
  const activeAccountCount = usMintAccounts.filter((account) => account.status === "Active").length;
  const orderTableAside = importResult
    ? formatImportResultAside(importResult)
    : orders.length
      ? `${orders.length} imported`
      : "Confirmed Gmail orders";
  const isUsMintBusy = isClearing || isImporting || isImportingHistory;
  const gmailStatus = isLoading
    ? "Loading"
    : googleOAuthDisabled || googleStatus.disabled
      ? "OAuth disabled"
      : googleStatus.authenticated
      ? "Gmail connected"
      : googleStatus.configured
        ? "Gmail ready"
        : "OAuth missing";
  const usMintSummaryItems = [
    { label: "Accounts", value: String(usMintAccounts.length), detail: `${activeAccountCount} active profiles`, tone: "blue" },
    { label: "Email Orders", value: String(orders.length), detail: `${confirmedCount} confirmed`, tone: "green" },
    { label: "Order Total", value: formatCurrency(orderTotal), detail: "Imported confirmed totals", tone: "violet" },
    { label: "Gmail", value: gmailStatus, detail: "orders@email.usmint.gov", tone: "amber" }
  ];

  async function handleConnectGmail() {
    return connectGoogleOAuth({ googleOAuthDisabled, notifyError, notifySuccess, setGoogleStatus });
  }

  async function handleImportOrders({ allHistory = false } = {}) {
    if (googleOAuthDisabled) {
      notifyError("Google OAuth is disabled.", "Turn it back on in Settings before importing Gmail.");
      return;
    }

    let latestStatus = await getGoogleOAuthStatus();
    setGoogleStatus(latestStatus);

    if (!latestStatus.authenticated) {
      latestStatus = await handleConnectGmail();
      if (!latestStatus?.authenticated) return;
    }

    const setWorking = allHistory ? setIsImportingHistory : setIsImporting;
    setWorking(true);

    try {
      const result = await importUsMintOrders({
        limit: allHistory ? 10000 : 5000,
        limitPerBatch: allHistory ? 1000 : "",
        historyStartYear: allHistory ? 2010 : "",
        query: US_MINT_CONFIRMED_ORDER_GMAIL_QUERY
      });
      const ordersResult = await listUsMintOrders({ limit: 1000 });
      setOrders(ordersResult.orders || result.orders || []);
      setImportResult(result);
      notifySuccess(`Scanned ${result.scanned} US Mint emails; imported ${result.imported}.`);
    } catch (error) {
      console.error("Failed to import US Mint orders", error);
      notifyError("US Mint import failed.", error.message);
    } finally {
      setWorking(false);
    }
  }

  async function handleClearOrders() {
    const shouldClear = window.confirm(
      "Clear imported US Mint order rows from this dashboard? Gmail emails will not be deleted."
    );

    if (!shouldClear) return;

    setIsClearing(true);

    try {
      const result = await clearUsMintOrders();
      setOrders([]);
      setImportResult(null);
      notifySuccess(`Cleared ${result.deleted || 0} imported US Mint order rows.`);
    } catch (error) {
      console.error("Failed to clear US Mint orders", error);
      notifyError("Could not clear US Mint order rows.", error.message);
    } finally {
      setIsClearing(false);
    }
  }

  return (
    <>
      <TabStrip labels={usMintTabs} activeLabel={activeUsMintTab} onSelect={setActiveUsMintTab} />
      <KpiGrid items={usMintSummaryItems} compact />

      {activeUsMintTab === "Accounts" ? (
        <UsMintAccountsTab
          accounts={visibleUsMintAccounts}
          onSelectAccount={setSelectedUsMintAccountId}
          selectedAccount={selectedUsMintAccount}
        />
      ) : null}

      {activeUsMintTab === "Email Orders" ? (
        <>
          <section className="receipt-toolbar">
            <div>
              <p className="eyebrow">Gmail OAuth</p>
              <h3>US Mint Confirmed Orders</h3>
            </div>
            <div className="toolbar-actions">
              <span className={`status-pill ${googleStatus.authenticated && !googleOAuthDisabled ? "" : "muted"}`}>{gmailStatus}</span>
              <button className="secondary-action" disabled={googleOAuthDisabled || !googleStatus.configured || isUsMintBusy} onClick={handleConnectGmail} type="button">
                <MailCheck size={18} />
                <span>Connect Gmail</span>
              </button>
              <button className="secondary-action" disabled={isUsMintBusy || !orders.length} onClick={handleClearOrders} type="button">
                <Trash2 size={18} />
                <span>{isClearing ? "Clearing..." : "Clear Batch"}</span>
              </button>
              <button className="secondary-action" disabled={googleOAuthDisabled || !googleStatus.configured || isUsMintBusy} onClick={() => handleImportOrders()} type="button">
                <RefreshCw className={isImporting ? "spin" : ""} size={18} />
                <span>{isImporting ? "Importing..." : "Import Emails"}</span>
              </button>
              <button className="purchase-submit" disabled={googleOAuthDisabled || !googleStatus.configured || isUsMintBusy} onClick={() => handleImportOrders({ allHistory: true })} type="button">
                <RefreshCw className={isImportingHistory ? "spin" : ""} size={18} />
                <span>{isImportingHistory ? "Importing..." : "Import All History"}</span>
              </button>
            </div>
          </section>

          <Panel eyebrow="Gmail records" title="Confirmed Order History" aside={orderTableAside}>
            <DataTable columns={columns.usMintOrders} rows={visibleOrders} />
          </Panel>
        </>
      ) : null}

      {activeUsMintTab === "Release Calendar" ? (
        <Panel eyebrow="Release calendar" title="Upcoming Releases">
          <DataTable columns={columns.releases} rows={filterRows(usMint.releases, query)} />
        </Panel>
      ) : null}

      {activeUsMintTab === "Subscriptions" ? (
        <Panel eyebrow="Subscriptions" title="Account Coverage">
          <RelationshipList
            items={filterRows(usMint.subscriptions, query).map((item) => ({
              primary: item.account,
              household: item.items ? `${item.items} active items` : "Active items need Supabase import",
              account: item.card,
              note: [item.address, item.status].filter(Boolean).join(" · ")
            }))}
          />
        </Panel>
      ) : null}

      {["Expected Charges", "Buyer Sales"].includes(activeUsMintTab) ? (
        <Panel eyebrow={activeUsMintTab} title={`${activeUsMintTab} Workspace`}>
          <p className="empty-copy">Connect the confirmed order import first, then this workspace can be filled from order and release data.</p>
        </Panel>
      ) : null}

      {activeUsMintTab === "Google Sheets" ? (
        <SpreadsheetSourceWorkspace
          fallbackColumns={columns.releases}
          fallbackRows={usMint.releases}
          query={query}
          sourceId="usMint"
          title="US Mint Sheets"
        />
      ) : null}
    </>
  );
}

function UsMintAccountsTab({ accounts, onSelectAccount, selectedAccount }) {
  if (!selectedAccount) {
    return (
      <Panel eyebrow="Accounts" title="US Mint Account Profiles">
        <p className="empty-copy">No matching US Mint accounts</p>
      </Panel>
    );
  }

  const activeAccounts = accounts.filter((account) => account.status === "Active").length;

  return (
    <section className="costco-account-browser">
      <aside className="costco-account-list" aria-label="US Mint account profiles">
        <div className="account-browser-heading">
          <div>
            <p className="eyebrow">Profiles</p>
            <h3>{accounts.length} Accounts</h3>
          </div>
          <span className="status-pill muted">{activeAccounts} active</span>
        </div>
        <div className="costco-account-list-scroll">
          {accounts.map((account) => (
            <button
              className={`costco-account-row ${selectedAccount.id === account.id ? "is-selected" : ""}`}
              key={account.id}
              onClick={() => onSelectAccount(account.id)}
              type="button"
            >
              <span>
                <strong>{account.nickname || account.owner || "US Mint account"}</strong>
                <small>{account.accountNumber || account.email}</small>
              </span>
              <em>{account.owner}</em>
            </button>
          ))}
        </div>
      </aside>

      <article className="panel costco-account-detail">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{selectedAccount.accountNumber}</p>
            <h3>{selectedAccount.nickname || selectedAccount.owner}</h3>
          </div>
          <span className="status-pill">{selectedAccount.status}</span>
        </div>

        <dl className="account-overview-list">
          <div>
            <dt>Owner</dt>
            <dd>{selectedAccount.owner || "—"}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{selectedAccount.email || "—"}</dd>
          </div>
          <div>
            <dt>Primary Card</dt>
            <dd>{selectedAccount.primaryCard || "—"}</dd>
          </div>
          <div>
            <dt>Card Exp</dt>
            <dd>{selectedAccount.cardExp || "—"}</dd>
          </div>
        </dl>

        <div className="account-detail-groups">
          {usMintAccountDetailGroups.map((group) => (
            <section className="account-detail-group" key={group.title}>
              <h4>{group.title}</h4>
              <dl>
                {group.fields.map((field) => (
                  <div key={field}>
                    <dt>{field}</dt>
                    <dd>{selectedAccount.raw[field] || "—"}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </article>
    </section>
  );
}

function DellPage({ query }) {
  return (
    <>
      <TabStrip labels={["Accounts", "Orders", "Items", "Rewards", "Fulfillment", "Sales"]} />
      <KpiGrid items={dell.summary} compact />
      <SpreadsheetSourceWorkspace
        fallbackColumns={columns.dellOrders}
        fallbackRows={dell.orders}
        query={query}
        sourceId="dell"
        title="Dell Sheets"
      />
    </>
  );
}

function CommoditiesPage({ query }) {
  const combinedSummary = [
    { label: "US Mint Accounts", value: String(usMintAccounts.length), detail: "Included in Commodities", tone: "green" },
    { label: "Inventory Lots", value: String(commodities.inventory.length), detail: "Bullion and collectibles", tone: "blue" },
    { label: "Active Mint Profiles", value: String(usMintAccounts.filter((account) => account.status === "Active").length), detail: "Ready for spreadsheet data", tone: "violet" },
    { label: "Buyer Coverage", value: String(buyers.length), detail: "Coin and bullion outlets", tone: "amber" }
  ];

  return (
    <>
      <KpiGrid items={combinedSummary} compact />
      <SpreadsheetSourceWorkspace
        fallbackColumns={columns.inventory}
        fallbackRows={commodities.inventory}
        query={query}
        sourceId="commodities"
        title="Commodities Sheets"
      />
    </>
  );
}

function ReceiptsPage({ query }) {
  const [folders, setFolders] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [selectedRetailer, setSelectedRetailer] = useState("all");
  const [isLoading, setIsLoading] = useState(true);
  const [isReceiptLoggerOpen, setIsReceiptLoggerOpen] = useState(false);
  const { notifyError } = useToast();

  useEffect(() => {
    let isCurrent = true;

    async function loadReceiptData() {
      setIsLoading(true);

      try {
        const [folderResult, receiptResult] = await Promise.all([listReceiptFolders(), listReceipts()]);

        if (!isCurrent) return;

        setFolders(folderResult.folders || []);
        setReceipts(receiptResult.receipts || []);
      } catch (error) {
        console.error("Failed to load receipts", error);
        if (isCurrent) notifyError("Could not load receipts from Supabase.", error.message);
      } finally {
        if (isCurrent) setIsLoading(false);
      }
    }

    loadReceiptData();

    return () => {
      isCurrent = false;
    };
  }, [notifyError]);

  const retailerFolders = useMemo(() => {
    const unique = new Map();

    for (const folder of folders) {
      const name = folder.retailer || folder.name;
      if (name) unique.set(name.toLowerCase(), { ...folder, name });
    }

    return [...unique.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [folders]);

  const visibleReceipts = filterRows(
    selectedRetailer === "all" ? receipts : receipts.filter((receipt) => receipt.retailer === selectedRetailer),
    query
  );

  async function handleFolderCreated(folder) {
    const result = await createReceiptFolder(folder);
    const nextFolder = result.folder;

    setFolders((current) => upsertById(current, nextFolder));
    setSelectedRetailer(nextFolder.retailer || nextFolder.name);

    return result;
  }

  function handleReceiptSaved(receipt) {
    if (!receipt) return;
    setReceipts((current) => upsertById(current, receipt));
    setSelectedRetailer(receipt.retailer || "all");
  }

  return (
    <>
      <section className="receipt-toolbar">
        <div>
          <p className="eyebrow">Retailer folders</p>
          <h3>Receipts</h3>
        </div>
        <label className="folder-select">
          <FolderClosed size={16} />
          <select onChange={(event) => setSelectedRetailer(event.target.value)} value={selectedRetailer}>
            <option value="all">All retailers</option>
            {retailerFolders.map((folder) => (
              <option key={folder.id || folder.name} value={folder.name}>
                {folder.name}
              </option>
            ))}
          </select>
        </label>
      </section>

      {isReceiptLoggerOpen ? (
        <ReceiptLogger
          folders={folders}
          onClose={() => setIsReceiptLoggerOpen(false)}
          onFolderCreated={handleFolderCreated}
          onReceiptSaved={handleReceiptSaved}
        />
      ) : null}

      <Panel eyebrow="Supabase" title={selectedRetailer === "all" ? "All Receipts" : selectedRetailer} aside={isLoading ? "Loading" : "Live records"}>
        <DataTable
          columns={["date", "retailer", "folder", "totalAmount", "receiptFileName", "receiptUrl", "notes", "loggedAt"]}
          rows={visibleReceipts}
        />
      </Panel>

      {!isReceiptLoggerOpen ? (
        <FloatingActionButton label="Add a receipt" onClick={() => setIsReceiptLoggerOpen(true)} />
      ) : null}
    </>
  );
}

function BuyersPage({ query }) {
  return (
    <SpreadsheetSourceWorkspace
      fallbackColumns={["name", "buys", "pending", "balance", "contact", "status", "lastPurchase"]}
      fallbackRows={buyers}
      query={query}
      sourceId="buyers"
      title="Buyer Sheets"
    />
  );
}

function RewardsPage({ query }) {
  return (
    <SpreadsheetSourceWorkspace
      fallbackColumns={columns.rewards}
      fallbackRows={rewards}
      query={query}
      sourceId="rewards"
      title="Rewards Sheets"
    />
  );
}

function AlertsPage({ query }) {
  return (
    <section className="content-grid wide-left">
      <SpreadsheetSourceWorkspace
        fallbackColumns={columns.alerts}
        fallbackRows={alerts}
        query={query}
        sourceId="alerts"
        title="Alerts Sheets"
      />
      <Panel eyebrow="Rules" title="Alert Types">
        <div className="rule-list">
          {alertRules.map((rule) => (
            <span key={rule}>{rule}</span>
          ))}
        </div>
      </Panel>
    </section>
  );
}

function ReportsPage({ query }) {
  return (
    <SpreadsheetSourceWorkspace
      fallbackColumns={["name", "metric", "status", "action"]}
      fallbackRows={reports}
      query={query}
      sourceId="reports"
      title="Report Sheets"
    />
  );
}

function SettingsPage({ googleOAuthDisabled, onToggleGoogleOAuthDisabled, query }) {
  return (
    <section className="content-grid wide-left">
      <Panel eyebrow="Global controls" title="Connection Settings">
        <div className="settings-control-row">
          <div>
            <strong>Disable Google OAuth client</strong>
            <p>Blocks Gmail OAuth connection and Gmail imports from Costco and US Mint. Google Sheets service-account reads and writes stay available.</p>
          </div>
          <label className="toggle-control">
            <input
              checked={googleOAuthDisabled}
              onChange={(event) => onToggleGoogleOAuthDisabled(event.target.checked)}
              type="checkbox"
            />
            <span>{googleOAuthDisabled ? "Disabled" : "Enabled"}</span>
          </label>
        </div>
      </Panel>

      <Panel eyebrow="Import sources" title="Sync Plan">
        <DataTable columns={columns.settings} rows={filterRows(syncSettings, query)} />
      </Panel>
    </section>
  );
}

function buildHomeSummaryItems() {
  const priorityAccounts = getCostcoPriorityAccounts(costcoAccounts, 2);
  const totalRewards = costcoRewardRows.reduce((total, row) => total + (row.rewardAmount || 0), 0);
  const spendNeeded = costcoRewardRows.reduce((total, row) => total + (row.spendNeededAmount || 0), 0);
  const verificationCount = costcoAccounts.filter((account) => account.needsVerification === "Yes").length;
  const combinedCommodityRecords = commodities.inventory.length + usMintAccounts.length;

  return homeKpis.map((item) => {
    if (item.label === "Total Portfolios") {
      return { ...item, value: String(portfolioCards.length), detail: "Costco, Travel, Dell, Commodities, Ops" };
    }

    if (item.label === "Priority Renewals") {
      return { ...item, value: String(priorityAccounts.length), detail: "Top Costco accounts needing renewal review" };
    }

    if (item.label === "Costco Rewards") {
      return { ...item, value: formatCurrency(totalRewards), detail: "Estimated Executive rewards earned" };
    }

    if (item.label === "Spend to Cap") {
      return { ...item, value: formatCurrency(spendNeeded), detail: "Across active Executive reward accounts" };
    }

    if (item.label === "Commodities") {
      return { ...item, value: String(combinedCommodityRecords), detail: "US Mint accounts plus bullion inventory rows" };
    }

    if (item.label === "Open Actions") {
      return { ...item, value: String(alerts.length + verificationCount), detail: `${verificationCount} Costco records need verification` };
    }

    return item;
  });
}

function getCostcoPriorityAccounts(accounts, limit = 2) {
  return sortCostcoAccounts(accounts)
    .filter((account) => account.status === "Active" || account.needsVerification === "Yes" || /verify/i.test(account.status || ""))
    .slice(0, limit);
}

function sortCostcoAccounts(accounts) {
  return [...accounts].sort((left, right) => {
    const leftPriority = costcoAccountPriority(left);
    const rightPriority = costcoAccountPriority(right);
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;

    const leftDate = parseCostcoAccountRenewalDate(left)?.getTime() || Number.MAX_SAFE_INTEGER;
    const rightDate = parseCostcoAccountRenewalDate(right)?.getTime() || Number.MAX_SAFE_INTEGER;
    if (leftDate !== rightDate) return leftDate - rightDate;

    const leftRole = /primary/i.test(left.role || "") ? 0 : /household|add-on/i.test(left.role || "") ? 1 : 2;
    const rightRole = /primary/i.test(right.role || "") ? 0 : /household|add-on/i.test(right.role || "") ? 1 : 2;
    if (leftRole !== rightRole) return leftRole - rightRole;

    return String(left.ownerName || "").localeCompare(String(right.ownerName || ""), undefined, { sensitivity: "base" });
  });
}

function costcoAccountPriority(account) {
  if (account.needsVerification === "Yes" || /verify/i.test(account.status || "")) return 0;

  const renewalDate = parseCostcoAccountRenewalDate(account);
  if (!renewalDate) return 3;

  const daysUntil = daysUntilDate(renewalDate);
  if (daysUntil < 0) return 0;
  if (daysUntil <= COSTCO_RENEWAL_REMINDER_LEAD_DAYS) return 1;
  if (daysUntil <= 45) return 2;
  return 3;
}

function parseCostcoAccountRenewalDate(account) {
  return parseTravelDate(account.renewalOpens || account.expirationDate);
}

function daysUntilDate(date) {
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  return Math.ceil((date.getTime() - todayDate.getTime()) / 86_400_000);
}

function getCostcoAccountCounts(accounts) {
  return accounts.reduce(
    (counts, account) => {
      if (/primary/i.test(account.role || "")) counts.primary += 1;
      else if (/household|add-on/i.test(account.role || "")) counts.household += 1;
      else counts.other += 1;
      return counts;
    },
    { household: 0, other: 0, primary: 0 }
  );
}

function costcoStatusTone(account) {
  if (account?.needsVerification === "Yes" || /verify|activation/i.test(account?.status || "")) return "warning";

  const renewalDate = parseCostcoAccountRenewalDate(account || {});
  if (renewalDate) {
    const daysUntil = daysUntilDate(renewalDate);
    if (daysUntil < 0) return "danger";
    if (daysUntil <= COSTCO_RENEWAL_REMINDER_LEAD_DAYS) return "warning";
  }

  if (/active/i.test(account?.status || "")) return "success";
  if (/inactive|past/i.test(account?.status || "")) return "danger";
  return "neutral";
}

function statusToneFromText(value) {
  const text = String(value || "").toLowerCase();
  if (/past|late|fail|error|inactive|high/.test(text)) return "danger";
  if (/verify|needs|scheduled|pending|medium|review/.test(text)) return "warning";
  if (/active|connected|ready|tracking|mapped|clear|success|low/.test(text)) return "success";
  if (/capped|near cap/.test(text)) return "info";
  return "neutral";
}

function statusPillClass(value) {
  return `status-pill status-${statusToneFromText(value)}`;
}

function readCostcoAccountEdits() {
  if (typeof window === "undefined") return {};

  try {
    return JSON.parse(window.localStorage.getItem(costcoAccountEditStorageKey) || "{}");
  } catch {
    return {};
  }
}

function writeCostcoAccountEdits(edits) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(costcoAccountEditStorageKey, JSON.stringify(edits || {}));
}

function applyCostcoAccountEdits(accounts, edits) {
  return accounts.map((account) => (edits?.[account.id] ? buildCostcoAccountFromRaw({ ...account, ...edits[account.id] }) : account));
}

function buildCostcoAccountsFromSheetSource(sourceState) {
  const accountsSheet = sourceState.sheets?.find((sheet) => /accounts?/i.test(sheet.name));
  if (!sourceState.configured || !accountsSheet?.rows?.length) return [];

  return accountsSheet.rows.map((row, index) =>
    buildCostcoAccountFromRaw({
      id: row["Membership #"] || row["Sign-In Email"] || row.id || `costco-sheet-account-${index}`,
      raw: row,
      sheetName: accountsSheet.name,
      sheetRowNumber: row.id
    })
  );
}

function buildCostcoAccountFromRaw(account) {
  const raw = account?.raw || account || {};
  const id = account?.id || raw["Membership #"] || raw["Sign-In Email"] || raw.id || "costco-account";

  return {
    ...account,
    id,
    membershipNumber: raw["Membership #"] || account?.membershipNumber || "",
    role: raw.Role || account?.role || "",
    linkedPrimary: raw["Linked Primary #"] || account?.linkedPrimary || "",
    membershipType: raw["Membership Type"] || account?.membershipType || "",
    executive: raw["Executive?"] || account?.executive || "",
    status: raw.Status || account?.status || "",
    ownerName: raw["Owner Name"] || account?.ownerName || "",
    signInEmail: raw["Sign-In Email"] || account?.signInEmail || "",
    profileEmail: raw["Profile Email"] || account?.profileEmail || "",
    phone: raw.Phone || account?.phone || "",
    address: raw.Address || account?.address || "",
    memberSince: raw["Member Since"] || account?.memberSince || "",
    expirationDate: raw["Expiration Date"] || account?.expirationDate || "",
    renewalOpens: raw["Renewal Opens"] || account?.renewalOpens || "",
    rewardCycleStart: raw["Reward Cycle Start"] || account?.rewardCycleStart || "",
    estimatedReward: raw["Estimated 2% Reward"] || account?.estimatedReward || "",
    remainingToCap: raw["Remaining to $1,250 Cap"] || account?.remainingToCap || "",
    spendNeededToCap: raw["Spend Needed to Cap"] || account?.spendNeededToCap || "",
    rewardLastUpdated: raw["Reward Last Updated"] || account?.rewardLastUpdated || "",
    accountManager: raw["Account Manager / Primary Member"] || account?.accountManager || "",
    householdMember: raw["Household Member"] || account?.householdMember || "",
    notes: raw.Notes || account?.notes || "",
    needsVerification: raw["Needs Verification?"] || account?.needsVerification || "",
    raw
  };
}

function formatDateForInput(value) {
  const date = parseTravelDate(value);
  if (!date) return "";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function formatInputDateForDisplay(value) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return "";
  return `${month}/${day}/${year}`;
}

function buildProfileSnapshot(session) {
  const name = session?.name || "Santosh Purohit";
  const role = session?.role || "Portfolio operator";
  const activeCostcoAccounts = costcoAccounts.filter((account) => account.status === "Active");
  const executiveCostcoAccounts = activeCostcoAccounts.filter((account) => account.executive === "Yes");
  const activeUsMintAccounts = usMintAccounts.filter((account) => account.status === "Active");
  const totalProfiles = costcoAccounts.length + usMintAccounts.length;
  const totalCostcoRewards = costcoRewardRows.reduce((total, row) => total + (Number(row.rewardAmount) || 0), 0);
  const rewardProgress = costcoRewardRows.length
    ? Math.round(costcoRewardRows.reduce((total, row) => total + (Number(row.progress) || 0), 0) / costcoRewardRows.length)
    : 0;
  const renewalRemindersDue = costcoRenewalReminders.filter((reminder) => reminder.isVisible);
  const verificationCount = costcoAccounts.filter((account) => account.needsVerification === "Yes").length;
  const nextRenewal = costcoRenewalReminders[0];

  const profileContext = {
    activeCostcoAccounts,
    activeUsMintAccounts,
    totalCostcoRewards
  };

  return {
    badges: ["Active operator", "Private dashboard", "Sheets-first data"],
    initials: getInitials(name),
    name,
    summary: `${role} for retail, travel, collectibles, rewards, buyers, receipts, and alerts.`,
    socialStats: [
      { label: "Portfolios", value: String(portfolioCards.length), detail: "core dashboards" },
      { label: "Profiles", value: String(totalProfiles), detail: "account records" },
      { label: "Rewards", value: formatCurrency(totalCostcoRewards), detail: "Costco tracked" },
      { label: "Buyers", value: String(buyers.length), detail: "network rows" }
    ],
    statCards: [
      {
        detail: `${executiveCostcoAccounts.length} Executive reward accounts`,
        icon: ShoppingCart,
        label: "Costco Memberships",
        tone: "blue",
        value: String(activeCostcoAccounts.length)
      },
      {
        detail: "Active purchase profiles",
        icon: Gem,
        label: "US Mint Accounts",
        tone: "green",
        value: String(activeUsMintAccounts.length)
      },
      {
        detail: `${rewardProgress}% average reward-cap progress`,
        icon: BarChart3,
        label: "Rewards Tracked",
        tone: "violet",
        value: formatCurrency(totalCostcoRewards)
      },
      {
        detail: nextRenewal ? `Next window: ${nextRenewal.renewalDate}` : "No renewal dates loaded",
        icon: Bell,
        label: "Renewals Due",
        tone: renewalRemindersDue.length ? "rose" : "amber",
        value: String(renewalRemindersDue.length)
      },
      {
        detail: "Active sales coverage",
        icon: Users,
        label: "Buyer Network",
        tone: "green",
        value: String(buyers.length)
      },
      {
        detail: `${alertRules.length} alert rule types configured`,
        icon: Bell,
        label: "Open Alerts",
        tone: "rose",
        value: String(alerts.length)
      },
      {
        detail: "Costco account records to verify",
        icon: UserRound,
        label: "Verification Queue",
        tone: verificationCount ? "amber" : "green",
        value: String(verificationCount)
      },
      {
        detail: "Gmail, Sheets, and upload sources",
        icon: RefreshCw,
        label: "Sync Sources",
        tone: "neutral",
        value: String(syncSettings.length)
      }
    ],
    portfolioItems: portfolioCards.map((portfolio) => ({
      ...portfolio,
      detail: getProfilePortfolioDetail(portfolio.id),
      value: getProfilePortfolioValue(portfolio.id, profileContext)
    })),
    healthSignals: [
      {
        detail: nextRenewal ? `${nextRenewal.account} · ${nextRenewal.membership}` : "No Costco renewal rows loaded",
        label: "Next Renewal",
        value: nextRenewal?.renewalDate || "—"
      },
      {
        detail: `${COSTCO_RENEWAL_REMINDER_PHONE} reminder destination`,
        label: "Renewal Alerts",
        value: String(renewalRemindersDue.length)
      },
      {
        detail: `${formatCurrency(COSTCO_EXECUTIVE_REWARD_CAP)} max per cycle`,
        label: "Reward Progress",
        value: `${rewardProgress}%`
      },
      {
        detail: "Manual review before acting",
        label: "Needs Verification",
        value: String(verificationCount)
      }
    ],
    timelineItems: [
      {
        event: `${activeCostcoAccounts.length} active Costco memberships mapped across household and primary profiles`,
        priority: "low",
        source: "Costco",
        status: "Mapped"
      },
      {
        event: `${formatCurrency(totalCostcoRewards)} estimated Executive rewards across ${executiveCostcoAccounts.length} accounts`,
        priority: "medium",
        source: "Rewards",
        status: "Tracking"
      },
      {
        event: `${activeUsMintAccounts.length} US Mint profiles ready for order and release history`,
        priority: "low",
        source: "US Mint",
        status: "Ready"
      },
      {
        event: `${alerts.length} open action items with ${alertRules.length} configured alert types`,
        priority: alerts.length ? "high" : "low",
        source: "Alerts",
        status: alerts.length ? "Review" : "Clear"
      },
      ...recentActivity.map((activity) => ({
        event: activity.event,
        priority: "low",
        source: activity.source,
        status: activity.status || "Ready"
      }))
    ],
    coverageItems: [
      {
        account: `${buyers.length} buyer rows`,
        household: buyers.map((buyer) => buyer.name).join(", "),
        note: "Sales and payment coverage",
        primary: "Buyer Network"
      },
      {
        account: formatCurrency(totalCostcoRewards),
        household: `${executiveCostcoAccounts.length} active Executive accounts`,
        note: `${formatCurrency(COSTCO_EXECUTIVE_REWARD_CAP)} cap per account cycle`,
        primary: "Costco Rewards"
      },
      {
        account: `${syncSettings.length} sources`,
        household: syncSettings.map((setting) => setting.source).join(", "),
        note: "Sync plan coverage",
        primary: "Data Sources"
      }
    ]
  };
}

function getProfilePortfolioValue(id, context) {
  const values = {
    commodities: `${commodities.inventory.length + usMintAccounts.length} records`,
    costco: String(context.activeCostcoAccounts.length),
    dell: `${dell.rewards.length} rewards`,
    travel: String(travelSheetNames.length),
    usMint: String(context.activeUsMintAccounts.length)
  };

  return values[id] || "—";
}

function getProfilePortfolioDetail(id) {
  const details = {
    commodities: "US Mint collectibles, accounts, and bullion inventory",
    costco: "Memberships, renewals, rewards, and Gmail orders",
    dell: "Orders, rewards, fulfillment, and sale follow-up",
    travel: "Trips, flights, awards, and master reference data",
    usMint: "Accounts, confirmed orders, releases, and subscriptions"
  };

  return details[id] || "Portfolio workspace";
}

function getInitials(name) {
  const initials = String(name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return initials || "SP";
}

function KpiGrid({ items, compact = false }) {
  return (
    <section className={`kpi-grid ${compact ? "four" : ""}`}>
      {items.map((item) => (
        <article className={`metric-card tone-${item.tone}`} key={item.label}>
          <p>{item.label}</p>
          <strong>{item.value || "—"}</strong>
          <span>{item.detail}</span>
        </article>
      ))}
    </section>
  );
}

function Panel({ eyebrow, title, aside, children }) {
  return (
    <article className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h3>{title}</h3>
        </div>
        {aside ? <span className="status-pill muted">{aside}</span> : null}
      </div>
      {children}
    </article>
  );
}

function TabStrip({ activeLabel, labels, onSelect }) {
  const selectedLabel = activeLabel || labels[0];

  return (
    <div className={`tab-strip ${onSelect ? "is-interactive" : ""}`} role={onSelect ? "tablist" : undefined}>
      {labels.map((label) => (
        <button
          aria-selected={onSelect ? selectedLabel === label : undefined}
          className={selectedLabel === label ? "is-selected" : ""}
          key={label}
          onClick={() => onSelect?.(label)}
          role={onSelect ? "tab" : undefined}
          type="button"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function AccountCard({ account }) {
  return (
    <article className="account-card">
      <div className="card-heading">
        <div>
          <p className="eyebrow">{account.membership}</p>
          <h3>{account.name}</h3>
        </div>
        <span className="status-pill">{account.status}</span>
      </div>
      <dl className="detail-list dense">
        <div>
          <dt>Tier</dt>
          <dd>{account.tier}</dd>
        </div>
        <div>
          <dt>Reward</dt>
          <dd>{account.reward || "—"}</dd>
        </div>
        <div>
          <dt>Remaining</dt>
          <dd>{account.remaining || "—"}</dd>
        </div>
        <div>
          <dt>Expires</dt>
          <dd>{account.expires || "—"}</dd>
        </div>
        <div>
          <dt>Action</dt>
          <dd>{account.action}</dd>
        </div>
      </dl>
      <ProgressBar value={account.progress} />
    </article>
  );
}

function ProgressList({ items }) {
  return (
    <div className="stack-list">
      {items.map((item) => {
        const progressText = [item.current, item.target].filter(Boolean).join(" of ");

        return (
          <div className="progress-row" key={item.account}>
            <div>
              <strong>{item.account}</strong>
              {progressText ? <span>{progressText}</span> : null}
            </div>
            <ProgressBar value={item.progress} />
            {item.remaining ? <em>{item.remaining} remaining</em> : null}
          </div>
        );
      })}
    </div>
  );
}

function RelationshipList({ items }) {
  return (
    <div className="stack-list">
      {items.map((item) => {
        const meta = [item.account, item.note].filter(Boolean).join(" · ");

        return (
          <div className="relationship-row" key={`${item.primary}-${item.household}`}>
            <strong>{item.primary}</strong>
            <span>{item.household}</span>
            {meta ? <small>{meta}</small> : null}
          </div>
        );
      })}
    </div>
  );
}

function AlertList({ items }) {
  return (
    <div className="alert-list">
      {items.map((item) => (
        <div className="alert-row" key={`${item.portfolio}-${item.alert}`}>
          <span className={`priority-dot ${item.priority.toLowerCase()}`} />
          <div>
            <strong>{item.portfolio}</strong>
            <p>{item.alert}</p>
          </div>
          <span>{item.action}</span>
        </div>
      ))}
    </div>
  );
}

function DataTable({ columns: tableColumns, rows, sortableColumns = [] }) {
  const [sortConfig, setSortConfig] = useState({ column: "", direction: "asc" });
  const sortableColumnSet = useMemo(() => new Set(sortableColumns), [sortableColumns]);
  const sortedRows = useMemo(() => {
    if (!sortConfig.column) return rows;

    return [...rows].sort((left, right) => {
      const leftValue = String(left[sortConfig.column] ?? "").toLowerCase();
      const rightValue = String(right[sortConfig.column] ?? "").toLowerCase();
      const result = leftValue.localeCompare(rightValue, undefined, { numeric: true, sensitivity: "base" });
      return sortConfig.direction === "asc" ? result : -result;
    });
  }, [rows, sortConfig]);

  function handleSort(column) {
    if (!sortableColumnSet.has(column)) return;

    setSortConfig((current) => ({
      column,
      direction: current.column === column && current.direction === "asc" ? "desc" : "asc"
    }));
  }

  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            {tableColumns.map((column) => {
              const isSortable = sortableColumnSet.has(column);
              const isSorted = sortConfig.column === column;

              return (
                <th aria-sort={isSorted ? (sortConfig.direction === "asc" ? "ascending" : "descending") : undefined} key={column}>
                  {isSortable ? (
                    <button className={`table-sort-button ${isSorted ? "is-active" : ""}`} onClick={() => handleSort(column)} type="button">
                      <span>{humanize(column)}</span>
                      <ArrowUpDown size={14} />
                    </button>
                  ) : (
                    humanize(column)
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row, index) => (
            <tr key={`${JSON.stringify(row)}-${index}`}>
              {tableColumns.map((column) => (
                <td key={column}>{renderCell(row[column], column)}</td>
              ))}
            </tr>
          ))}
          {sortedRows.length === 0 ? (
            <tr>
              <td colSpan={tableColumns.length}>No matching records</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function ProgressBar({ value }) {
  if (!Number.isFinite(value)) return null;

  return (
    <div className="progress-track" aria-label={`${value}% progress`}>
      <span style={{ width: `${value}%` }} />
    </div>
  );
}

function renderCell(value, column) {
  if (column === "receiptUrl" && value) {
    return (
      <a className="table-link" href={value} rel="noreferrer" target="_blank">
        Open
      </a>
    );
  }

  if (column === "totalAmount" && Number.isFinite(value)) {
    return formatCurrency(value);
  }

  if (column === "daysUntil" && Number.isFinite(value)) {
    if (value < 0) return `${Math.abs(value)} days late`;
    if (value === 0) return "Today";
    return `${value} days`;
  }

  if (["status", "priority"].includes(column) && value) {
    return <span className={statusPillClass(value)}>{value}</span>;
  }
  return value || "—";
}

function humanize(value) {
  const labels = {
    itemNumber: "Item #",
    order: "Order #",
    receiptFileName: "Receipt File",
    receiptUrl: "Open",
    totalAmount: "Total Amount",
    loggedAt: "Logged At",
    spendNeeded: "Spend Needed",
    unitType: "UnitType",
    cycleStart: "Cycle Start",
    cycleEnd: "Cycle End",
    renewalDate: "Renewal Opens",
    reminderDate: "Reminder Date",
    expirationDate: "Expiration",
    daysUntil: "Days Until"
  };

  return labels[value] || value.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
}

function filterRows(rows, query) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return rows;

  return rows.filter((row) => JSON.stringify(row).toLowerCase().includes(normalized));
}

function FloatingActionButton({ label, onClick }) {
  return (
    <button className="floating-action" aria-label={label} onClick={onClick} title={label} type="button">
      <Plus size={24} />
    </button>
  );
}

function upsertById(items, item) {
  if (!item?.id) return items;

  const exists = items.some((current) => current.id === item.id);
  if (!exists) return [item, ...items];

  return items.map((current) => (current.id === item.id ? item : current));
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value || 0);
}

function formatImportResultAside(result) {
  const batchText = result.batches?.length ? ` · ${result.batches.length} batches` : "";
  return `Scanned ${result.scanned}, imported ${result.imported}, skipped ${result.skipped}${batchText}`;
}

function buildSmsHref(phone, message) {
  const digits = String(phone || "").replace(/\D/g, "");
  const normalizedPhone = digits.length === 10 ? `+1${digits}` : `+${digits}`;
  return `sms:${normalizedPhone}?body=${encodeURIComponent(message || "")}`;
}

function mergeTravelSheets(incomingSheets = []) {
  const incomingByName = new Map(incomingSheets.map((sheet) => [sheet.name, sheet]));

  return fallbackTravelSheets.map((fallbackSheet) => {
    const incomingSheet = incomingByName.get(fallbackSheet.name);
    return incomingSheet
      ? {
          ...fallbackSheet,
          ...incomingSheet,
          headers: incomingSheet.headers?.length ? incomingSheet.headers : fallbackSheet.headers,
          rows: incomingSheet.rows || []
        }
      : fallbackSheet;
  });
}

function getDefaultTravelHeaders(sheetName) {
  const defaults = {
    Trips: ["Trip", "Destination", "Start Date", "End Date", "Status", "Budget", "Notes"],
    Flights: ["Flight", "From", "To", "Depart Date", "Depart Time", "Airline", "Confirmation", "Status", "Notes"],
    Certificates_Awards: ["Program", "Account", "Certificate/Award", "Value", "Expiration Date", "Status", "Notes"]
  };

  return defaults[sheetName] || ["Name", "Date", "Status", "Notes"];
}

function getVisibleTravelColumns(sheet) {
  const headers = sheet?.headers?.length ? sheet.headers : getDefaultTravelHeaders(sheet?.name);
  return headers.filter((header) => header && header !== "id");
}

function getVisibleMasterDataColumns(sheet) {
  return (sheet?.headers || []).filter((header) => header && header !== "id");
}

function buildTravelKpis({ tripsSheet, flightsSheet, certificatesSheet }) {
  const upcomingTrips = countUpcomingTravelRows(tripsSheet.rows, ["Start Date", "Date", "Depart Date"]);
  const upcomingFlights = countUpcomingTravelRows(flightsSheet.rows, ["Depart Date", "Date", "Departure Date"]);
  const expiringAwards = getExpiringTravelRows(certificatesSheet.rows);

  return [
    { label: "Upcoming Trips", value: String(upcomingTrips), detail: `${tripsSheet.rows.length} total trip rows`, tone: "blue" },
    { label: "Upcoming Flights", value: String(upcomingFlights), detail: `${flightsSheet.rows.length} total flight rows`, tone: "green" },
    { label: "Certificates", value: String(certificatesSheet.rows.length), detail: "Awards and credits tracked", tone: "violet" },
    { label: "Expiring Soon", value: String(expiringAwards.length), detail: "Within the next 90 days", tone: "amber" }
  ];
}

function countUpcomingTravelRows(rows, dateAliases) {
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  const datedRows = rows
    .map((row) => parseTravelDate(getTravelRowValue(row, dateAliases)))
    .filter(Boolean);

  if (!datedRows.length) return rows.length;
  return datedRows.filter((date) => date >= todayDate).length;
}

function getExpiringTravelRows(rows) {
  const todayDate = new Date();
  todayDate.setHours(0, 0, 0, 0);
  const cutoff = new Date(todayDate);
  cutoff.setDate(cutoff.getDate() + 90);

  return rows.filter((row) => {
    const expirationDate = parseTravelDate(getTravelRowValue(row, ["Expiration Date", "Expiration", "Expires", "Expiry Date", "End Date"]));
    return expirationDate && expirationDate >= todayDate && expirationDate <= cutoff;
  });
}

function getTravelRowValue(row, aliases) {
  for (const alias of aliases) {
    const matchedKey = Object.keys(row || {}).find((key) => key.toLowerCase() === alias.toLowerCase());
    const value = matchedKey ? row[matchedKey] : "";
    if (value) return value;
  }

  return "";
}

function getTravelSecondaryText(row, aliases) {
  const values = aliases
    .map((alias) => getTravelRowValue(row, [alias]))
    .filter(Boolean)
    .slice(0, 3);

  return values.length ? values.join(" · ") : "—";
}

function parseTravelDate(value) {
  if (!value) return null;
  const text = String(value).trim();
  const isoDate = new Date(text);
  if (!Number.isNaN(isoDate.getTime())) return startOfDay(isoDate);

  const slashMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (!slashMatch) return null;

  const year = Number(slashMatch[3].length === 2 ? `20${slashMatch[3]}` : slashMatch[3]);
  return new Date(year, Number(slashMatch[1]) - 1, Number(slashMatch[2]));
}

function startOfDay(value) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function isLongTravelField(header) {
  return /notes?|description|details?|comments?/i.test(header);
}

function getTravelInputType(header) {
  if (/date|expires?|expiration/i.test(header)) return "date";
  if (/time/i.test(header)) return "time";
  if (/amount|budget|cost|credit|value|price|total/i.test(header)) return "number";
  return "text";
}

export default App;
