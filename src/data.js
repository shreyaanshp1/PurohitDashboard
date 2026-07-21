export const navItems = [
  { id: "home", label: "Home" },
  { id: "profile", label: "Profile" },
  { id: "costco", label: "Costco" },
  { id: "travel", label: "Travel" },
  { id: "dell", label: "Dell" },
  { id: "commodities", label: "Commodities" },
  { id: "receipts", label: "Receipts" },
  { id: "buyers", label: "Buyers" },
  { id: "rewards", label: "Rewards" },
  { id: "alerts", label: "Alerts" },
  { id: "reports", label: "Reports" },
  { id: "settings", label: "Settings" }
];

export const homeKpis = [
  { label: "Total Portfolios", value: "", detail: "Sheets-first operating views", tone: "blue" },
  { label: "Priority Renewals", value: "", detail: "Costco accounts needing review", tone: "amber" },
  { label: "Costco Rewards", value: "", detail: "Executive reward balance", tone: "green" },
  { label: "Spend to Cap", value: "", detail: "Remaining Costco card spend", tone: "rose" },
  { label: "Commodities", value: "", detail: "US Mint + bullion combined", tone: "violet" },
  { label: "Open Actions", value: "", detail: "Alerts and verification work", tone: "neutral" }
];

export const portfolioCards = [
  {
    id: "costco",
    name: "Costco",
    value: "",
    metric: "Rewards tracked",
    nextAction: "Import Costco orders",
    alert: "No Supabase alerts loaded",
    tone: "blue"
  },
  {
    id: "travel",
    name: "Travel",
    value: "",
    metric: "Trips, flights, awards",
    nextAction: "Connect travel spreadsheet",
    alert: "Waiting for Sheets rows",
    tone: "amber"
  },
  {
    id: "dell",
    name: "Dell",
    value: "",
    metric: "MR rewards pending",
    nextAction: "Connect Supabase records",
    alert: "No Supabase alerts loaded",
    tone: "violet"
  },
  {
    id: "commodities",
    name: "Commodities",
    value: "",
    metric: "US Mint + bullion",
    nextAction: "Connect commodities spreadsheet",
    alert: "US Mint collectibles are tracked here",
    tone: "green"
  }
];

export const alerts = [
  { date: "", portfolio: "US Mint", alert: "Release timing needs imported data", action: "Review records", priority: "High" },
  { date: "", portfolio: "Costco", alert: "Renewal window needs imported data", action: "Review records", priority: "Medium" },
  { date: "", portfolio: "Dell", alert: "Rewards status needs imported data", action: "Review records", priority: "Medium" },
  { date: "", portfolio: "Data", alert: "Missing account data", action: "Complete Supabase mapping", priority: "Low" }
];

export const recentActivity = [
  { time: "", source: "Supabase", event: "Waiting for purchase and receipt records", status: "Ready" },
  { time: "", source: "Supabase", event: "Retailer folders sync from Supabase", status: "Ready" }
];

const costcoAccountsTsv = `Membership #	Role	Linked Primary #	Membership Type	Executive?	Status	Owner Name	Sign-In Email	Profile Email	Phone	Address	Member Since	Expiration Date	Renewal Opens	Reward Cycle Start	Estimated 2% Reward	Remaining to $1,250 Cap	Spend Needed to Cap	Reward Last Updated	Account Manager / Primary Member	Household Member	Notes	Needs Verification?
111985179191	Primary		Business Executive	Yes	Active	Sasmita Adhikari	skadhikari@stylemeetsprice.com	sasmitabadhikari@stylemeetsprice.com	215-607-0802	16709 GARDEN DR, CELINA, TX 75009-2057	04/18/2024	11/30/2026	08/30/2026	08/20/2025	$623.39	$626.61	$31,330.50	06/24/2026	Personal Account Manager shown	Santosh Purohit	Business Executive primary/reward-bearing account	No
111985188669	Household/Add-on	111985179191	Business Executive	No	Active	Santosh Purohit	skpurohit@stylemeetsprice.com	skpurohit@stylemeetsprice.com	508-826-9529	16709 GARDEN DR, CELINA, TX 75009-2057	04/18/2024	11/30/2026	08/30/2026		$0.00				Primary Member: Sasmita Adhikari		Household/add-on under 111985179191; no separate reward shown	No
111902895687	Primary		Business Executive	Yes	Active	Sasmita Adhikari	sasmitabadhikari@stylemeetsprice.com	sasmitabadhikari@stylemeetsprice.com	215-607-0802	16709 GARDEN DR, CELINA, TX 75009-2057	11/05/2019	11/30/2026	08/30/2026	08/20/2025	$43.14	$1,206.86	$60,343.00	06/24/2026	Personal Account Manager shown	Santosh Purohit	Business Executive primary/reward-bearing account	No
111902897625	Household/Add-on	111902895687	Business Executive	No	Active	Santosh Purohit	santoshbpurohit@stylemeetsprice.com	skpurohit@stylemeetsprice.com	508-826-9529	16709 GARDEN DR, CELINA, TX 75009-2057	11/05/2019	11/30/2026	08/30/2026		$0.00				Primary Member: Sasmita Adhikari		Household/add-on under 111902895687; no separate reward shown	No
111905926607	Primary		Business Executive	Yes	Active	Santosh Pupohit	santoshspurohit@stylemeetsprice.com	SANTOSHSPUROHIT@STYLEMEETSPRICE.COM	469-547-7217	16709 GARDEN DR, CELINA, TX 75009-2057	01/18/2020	01/31/2027	10/31/2026	10/20/2025	$237.16	$1,012.84	$50,642.00	06/24/2026			Name appears as Santosh Pupohit on Costco; verify typo/correct if desired	No
111905927257	Needs Verification	111905926607	Unknown	Unknown	Verify Membership	Unknown	sasmitasadhikari@stylemeetsprice.com								$0.00						Original table showed Verify Membership; likely paired with 111905926607 but needs account page verification	Yes
111864493442	Primary		Gold Star Executive	Yes	Active	Santosh Purohit	santosh.purohit@hotmail.com	santosh.purohit@hotmail.com	508-826-9529	16709 GARDEN DR, CELINA, TX 75009-2057	03/31/2015	07/31/2026		04/20/2026	$10.14	$1,239.86	$61,993.00	06/24/2026			Renewed; next expiry update may be needed if Costco confirms a new date	No
111899272824	Household/Add-on	111864493442	Gold Star Executive	No	Active	Sasmita Adhikari	sasmitakadhikari@stylemeetsprice.com	sasmitakadhikari@stylemeetsprice.com	215-607-0802	3855 BLAIR MILL RD APT 216K, HORSHAM, PA 19044-2975	08/12/2019	07/31/2026			$0.00				Primary Member: Santosh Purohit		Cannot renew online; likely household/add-on under 111864493442	No
111871558053	Primary		Gold Star Executive	Yes	Active	Sasmita Adhikari	sashmita.adhikari@gmail.com	sashmita.adhikari@gmail.com	215-607-0802	16709 GARDEN DR, CELINA, TX 75009-2057	08/07/2017	08/31/2026		05/20/2025	$1,003.61	$246.39	$12,319.50	06/24/2026		Santosh Purohit	Gold Star Executive primary; person within household Santosh	No
111899057629	Household/Add-on	111871558053	Gold Star Executive	No	Active	Santosh Purohit	santoshpurohit@stylemeetsprice.com	santoshpurohit@stylemeetsprice.com	508-924-0864	3855 BLAIR MILL RD, HORSHAM, PA 19044-2998	08/07/2019	08/31/2026			$0.00				Primary Member: Sasmita Adhikari		Household/add-on under 111871558053; no reward shown	No
111990983425	Primary		Gold Star Executive	Yes	Active	Sasmita Adhikari	sadhikari45l2yl@stylemeetsprice.com	sasmitasadhikari@stylemeetsprice.com	469-715-1062	16709 GARDEN DR, CELINA, TX 75009-2057	02/10/2024	02/28/2027	11/28/2026	11/19/2025	$0.00	$1,250.00	$62,500.00	06/24/2026			Gold Star Executive primary/reward-bearing account	No
112006818620	Primary		Gold Star Executive	Yes	Active	Shreyaansh Purohit	shreyaanshpurohit@stylemeetsprice.com	shreyaanshpurohit@stylemeetsprice.com	727-633-4910	101 MAIN ST, WESTON, TX 75097	09/14/2024	09/30/2026	06/30/2026	06/20/2025	$872.89	$377.11	$18,855.50	06/24/2026			Gold Star Executive primary/reward-bearing account	No
112008230778	Primary		Gold Star Executive	Yes	Active	Sasmitaa Adhikari	sasmitashopping@stylemeetsprice.com	sasmitashopping@stylemeetsprice.com	469-715-1052	16709A GARDEN DR, CELINA, TX 75009	10/05/2024	10/31/2026	07/31/2026	07/20/2025	$0.00	$1,250.00	$62,500.00	06/24/2026			Gold Star Executive primary/reward-bearing account	No
112022709909	Primary		Gold Star Executive	Yes	Active	Santossh Purohitt	santoshshopping@stylemeetsprice.com	santoshshopping@stylemeetsprice.com	469-715-1054	16709 GARDEN DR, CELINA, TX 75009	03/29/2025	06/30/2027	03/30/2027	12/19/2025	$114.80	$1,135.20	$56,760.00	06/24/2026			Renewed and active; updated expiry 06/30/2027	No
111985512700	Primary		Gold Star Executive	Yes	Active	Aashish Jain	shoprewards3000@gmail.com	shoprewards3000@gmail.com	850-450-4390	16501 AMISTAD AVE, PROSPER, TX 75078-0330	12/05/2023	12/31/2026	09/30/2026	09/20/2025	$290.75	$959.25	$47,962.50	06/24/2026			Gold Star Executive primary/reward-bearing account	No
	Needs Verification		Unknown	Unknown	Needs Activation/Verification	Unknown	abhatta56l2yl@gmail.com		469-715-1061	101 MAIN ST #11, WESTON, TX 75097					$0.00						Original Block 10 from Groupon; no membership number yet	Yes
	Needs Verification		Unknown	Unknown	Needs Verification	Unknown	spurohit45l1yl@stylemeetsprice.com								$0.00						Original Block 4 AU; membership number unknown; check with customer care	Yes`;

function parseTsvRows(text) {
  const [headerLine, ...lines] = text.trim().split(/\r?\n/);
  const headers = headerLine.split("\t");

  return lines.map((line, index) => {
    const values = line.split("\t");
    const row = Object.fromEntries(headers.map((header, headerIndex) => [header, values[headerIndex] || ""]));

    return {
      id: row["Membership #"] || `${row["Sign-In Email"] || "pending"}-${index}`,
      membershipNumber: row["Membership #"],
      role: row.Role,
      linkedPrimary: row["Linked Primary #"],
      membershipType: row["Membership Type"],
      executive: row["Executive?"],
      status: row.Status,
      ownerName: row["Owner Name"],
      signInEmail: row["Sign-In Email"],
      profileEmail: row["Profile Email"],
      phone: row.Phone,
      address: row.Address,
      memberSince: row["Member Since"],
      expirationDate: row["Expiration Date"],
      renewalOpens: row["Renewal Opens"],
      rewardCycleStart: row["Reward Cycle Start"],
      estimatedReward: row["Estimated 2% Reward"],
      remainingToCap: row["Remaining to $1,250 Cap"],
      spendNeededToCap: row["Spend Needed to Cap"],
      rewardLastUpdated: row["Reward Last Updated"],
      accountManager: row["Account Manager / Primary Member"],
      householdMember: row["Household Member"],
      notes: row.Notes,
      needsVerification: row["Needs Verification?"],
      raw: row
    };
  });
}

export const costcoAccounts = parseTsvRows(costcoAccountsTsv);

export const costcoAccountDetailGroups = [
  {
    title: "Membership",
    fields: ["Linked Primary #", "Membership Type", "Executive?", "Status", "Needs Verification?"]
  },
  {
    title: "Owner",
    fields: ["Owner Name", "Sign-In Email", "Profile Email", "Phone", "Address"]
  },
  {
    title: "Dates",
    fields: ["Member Since", "Renewal Opens", "Reward Cycle Start", "Reward Last Updated"]
  },
  {
    title: "Rewards",
    fields: ["Remaining to $1,250 Cap", "Spend Needed to Cap"]
  },
  {
    title: "Relationships",
    fields: ["Account Manager / Primary Member", "Household Member", "Notes"]
  }
];

const usMintAccountsTsv = `Account Nickname	Owner	Email	US Mint Account #	Shipping Name	Phone	Address	Primary Card	Card Exp	Status	Notes
Praful	Praful	praful.chawlikar@stylemeetsprice.com	USM06611452	Santosh Purohit	469-710-1065	16709C Garden Dr, Celina, TX 75009-2057	Amex 1004	10/2029	Active	Cards cleaned; only Amex 1004 remains.
Santosh Hotmail	Santosh	santosh.purohit@hotmail.com	USM03822408	Santosh Purohit	508-826-9529	16709E Garden Dr, Celina, TX 75009-2057	Amex 3007	08/2028	Active	Address updated from #B to 16709E Garden Dr.
Santosh Gmail	Santosh	purohit.santosh@gmail.com	USM04529494	Santosh Purohit	267-370-2303	16709A Garden Dr, Celina, TX 75009-2057	Amex 1009	09/2027	Active	Several subscriptions paused.
Prakash	Prakash	prakashbadugu@stylemeetsprice.com	USM06558649	Shreyaansh Purohit	469-715-1064	16709B Garden Dr, Celina, TX 75009-2057	Amex 1007	04/2029	Active	High-volume silver dollar subscriptions.
Rajat	Rajat	rajatmukherjee@stylemeetsprice.com	USM06558550	Santoshh Purohit	469-715-1063	16709D Garden Dr, Celina, TX 75009-2057	Amex 1003	05/2029	Active	Address changed from 16709C to 16709D.
Santosh iCloud	Santosh	santoshpurohit@icloud.com	USM04529480	Santosh Purohit	469-547-7217	16501 Amistad Ave, Prosper, TX 75078-0330	Amex 2002	02/2029	Active	Card added after initial missing payment details.
Sasmita iCloud	Sasmita	sasmita.adhikari@icloud.com	USM03822911	Sasmita Adhikari	469-715-1066	6029 Attucks Dr, Krugerville, TX 76227-6013	Amex 2004	04/2030	Active	Card changed from Amex 1004 to Amex 2004. PayPal may still be linked.
Shreyaansh Gmail	Shreyaansh	shreyaanshpurohit@gmail.com	USM04528343	Santosh Purohit	469-715-1054	101 Main St, Ste 11, Weston, TX 75097-9701	Amex 1005	05/2029	Active	Only Congratulations Set active; reverse proof set paused.`;

function parseUsMintAccountRows(text) {
  const [headerLine, ...lines] = text.trim().split(/\r?\n/);
  const headers = headerLine.split("\t");

  return lines.map((line, index) => {
    const values = line.split("\t");
    const row = Object.fromEntries(headers.map((header, headerIndex) => [header, values[headerIndex] || ""]));

    return {
      id: row["US Mint Account #"] || `${row.Email || "us-mint-account"}-${index}`,
      nickname: row["Account Nickname"],
      owner: row.Owner,
      email: row.Email,
      accountNumber: row["US Mint Account #"],
      shippingName: row["Shipping Name"],
      phone: row.Phone,
      address: row.Address,
      primaryCard: row["Primary Card"],
      cardExp: row["Card Exp"],
      status: row.Status,
      notes: row.Notes,
      raw: row
    };
  });
}

export const usMintAccounts = parseUsMintAccountRows(usMintAccountsTsv);

export const usMintAccountDetailGroups = [
  {
    title: "Account",
    fields: ["Account Nickname", "Owner", "Email", "US Mint Account #", "Status"]
  },
  {
    title: "Shipping",
    fields: ["Shipping Name", "Phone", "Address"]
  },
  {
    title: "Payment",
    fields: ["Primary Card", "Card Exp"]
  },
  {
    title: "Notes",
    fields: ["Notes"]
  }
];

export const COSTCO_EXECUTIVE_REWARD_RATE = 0.02;
export const COSTCO_EXECUTIVE_REWARD_CAP = 1250;
export const COSTCO_EXECUTIVE_SPEND_TO_CAP = COSTCO_EXECUTIVE_REWARD_CAP / COSTCO_EXECUTIVE_REWARD_RATE;
export const COSTCO_RENEWAL_REMINDER_PHONE = "508-826-9529";
export const COSTCO_RENEWAL_REMINDER_LEAD_DAYS = 14;

const today = startOfDay(new Date());

export const costcoRewardRows = costcoAccounts
  .filter((account) => account.executive === "Yes" || toMoneyNumber(account.estimatedReward) > 0)
  .map((account) => {
    const reward = Math.min(toMoneyNumber(account.estimatedReward), COSTCO_EXECUTIVE_REWARD_CAP);
    const remaining = Math.max(COSTCO_EXECUTIVE_REWARD_CAP - reward, 0);
    const spendNeeded =
      toMoneyNumber(account.spendNeededToCap) || Number((remaining / COSTCO_EXECUTIVE_REWARD_RATE).toFixed(2));
    const progress = COSTCO_EXECUTIVE_REWARD_CAP ? Math.min((reward / COSTCO_EXECUTIVE_REWARD_CAP) * 100, 100) : 0;

    return {
      account: account.ownerName,
      membership: account.membershipNumber || "Pending",
      type: account.membershipType,
      reward: formatCurrencyText(reward),
      remaining: formatCurrencyText(remaining),
      spendNeeded: formatCurrencyText(spendNeeded),
      cycleStart: account.rewardCycleStart,
      cycleEnd: buildRewardCycleEnd(account),
      updated: account.rewardLastUpdated,
      status: reward >= COSTCO_EXECUTIVE_REWARD_CAP ? "Capped" : progress >= 80 ? "Near cap" : "Tracking",
      progress: Number(progress.toFixed(1)),
      rewardAmount: reward,
      remainingAmount: remaining,
      spendNeededAmount: spendNeeded
    };
  });

export const costcoRewardAnalytics = {
  activeAccounts: costcoAccounts.filter((account) => account.status === "Active").length,
  executiveAccounts: costcoAccounts.filter((account) => account.status === "Active" && account.executive === "Yes").length,
  totalEstimatedReward: sumBy(costcoRewardRows, "rewardAmount"),
  totalRemainingToCap: sumBy(costcoRewardRows, "remainingAmount"),
  totalSpendNeededToCap: sumBy(costcoRewardRows, "spendNeededAmount"),
  nearCapAccounts: costcoRewardRows.filter((row) => row.progress >= 80).length,
  cap: COSTCO_EXECUTIVE_REWARD_CAP,
  rate: COSTCO_EXECUTIVE_REWARD_RATE,
  spendToCap: COSTCO_EXECUTIVE_SPEND_TO_CAP
};

export const costcoRenewalReminders = costcoAccounts
  .filter((account) => account.status === "Active" && (account.renewalOpens || account.expirationDate))
  .map((account) => buildRenewalReminder(account))
  .sort((left, right) => left.sortDate - right.sortDate);

export const costcoRewardKpis = [
  {
    label: "Executive Rewards",
    value: formatCurrencyText(costcoRewardAnalytics.totalEstimatedReward),
    detail: `${costcoRewardAnalytics.executiveAccounts} active Executive reward accounts`,
    tone: "green"
  },
  {
    label: "Remaining to Cap",
    value: formatCurrencyText(costcoRewardAnalytics.totalRemainingToCap),
    detail: `${formatCurrencyText(costcoRewardAnalytics.totalSpendNeededToCap)} spend needed`,
    tone: "blue"
  },
  {
    label: "Near Cap",
    value: String(costcoRewardAnalytics.nearCapAccounts),
    detail: `${formatCurrencyText(COSTCO_EXECUTIVE_REWARD_CAP)} max per reward cycle`,
    tone: "amber"
  },
  {
    label: "Reward Rule",
    value: "2%",
    detail: "Qualified pre-tax Costco, Costco.com, and Costco Travel spend",
    tone: "violet"
  }
];

export const costco = {
  summary: [
    { label: "Active Accounts", value: String(costcoRewardAnalytics.activeAccounts), detail: `${costcoRewardAnalytics.executiveAccounts} Executive`, tone: "blue" },
    { label: "Rewards Earned", value: formatCurrencyText(costcoRewardAnalytics.totalEstimatedReward), detail: "Estimated 2% rewards", tone: "green" },
    { label: "Renewal Alerts", value: String(costcoRenewalReminders.filter((reminder) => reminder.isVisible).length), detail: `SMS reminders to ${COSTCO_RENEWAL_REMINDER_PHONE}`, tone: "amber" },
    { label: "Transactions", value: "", detail: "Waiting for Google Sheets rows", tone: "violet" }
  ],
  accounts: [
    {
      membership: "Needs import",
      name: "Costco account",
      tier: "Gold Star Executive",
      status: "Waiting for Supabase import",
      expires: "",
      reward: "",
      remaining: "",
      action: "Import membership records",
      progress: null
    }
  ],
  orders: [
    {
      order: "",
      account: "Needs import",
      membership: "",
      item: "Executive Gold Star Renewal",
      itemNumber: "",
      quantity: "",
      total: "",
      date: "",
      status: "Waiting for Google Sheets rows",
      source: "Google Sheets transactions",
      action: "Connect transactions sheet"
    }
  ],
  relationships: [
    { primary: "Primary member", household: "Household member", account: "", note: "Waiting for Supabase import" }
  ],
  rewards: [
    ...costcoRewardRows.map((row) => ({
      account: row.account,
      current: row.reward,
      target: formatCurrencyText(COSTCO_EXECUTIVE_REWARD_CAP),
      remaining: row.remaining,
      progress: row.progress
    }))
  ]
};

export const costcoManualPulls = [];

function buildRenewalReminder(account) {
  const renewalDate = parseUsDate(account.renewalOpens) || parseUsDate(account.expirationDate);
  const expirationDate = parseUsDate(account.expirationDate);
  const reminderDate = renewalDate ? addDays(renewalDate, -COSTCO_RENEWAL_REMINDER_LEAD_DAYS) : null;
  const daysUntilReminder = reminderDate ? daysBetween(today, reminderDate) : null;
  const daysUntilRenewal = renewalDate ? daysBetween(today, renewalDate) : null;
  const isPastDue = expirationDate ? daysBetween(today, expirationDate) < 0 : false;
  const isVisible = isPastDue || (daysUntilReminder !== null && daysUntilReminder <= 0);
  const renewalLabel = account.renewalOpens ? "renewal window opens" : "membership expires";
  const renewalDateText = account.renewalOpens || account.expirationDate;
  const message = `Costco renewal reminder: ${account.ownerName}'s ${account.membershipType} membership ${account.membershipNumber || "pending"} ${renewalLabel} on ${renewalDateText}. Please review/renew before it becomes past due.`;

  return {
    account: account.ownerName,
    membership: account.membershipNumber || "Pending",
    role: account.role,
    status: isPastDue ? "Past due" : isVisible ? "Reminder due" : "Scheduled",
    renewalDate: renewalDateText,
    reminderDate: reminderDate ? formatDateText(reminderDate) : "",
    expirationDate: account.expirationDate,
    daysUntil: daysUntilRenewal,
    priority: isPastDue || isVisible ? "High" : daysUntilReminder !== null && daysUntilReminder <= 30 ? "Medium" : "Low",
    action: isVisible ? "Send SMS" : "Scheduled",
    message,
    phone: COSTCO_RENEWAL_REMINDER_PHONE,
    isVisible,
    sortDate: reminderDate?.getTime() || Number.MAX_SAFE_INTEGER
  };
}

function buildRewardCycleEnd(account) {
  const renewalDate = parseUsDate(account.renewalOpens);
  if (renewalDate) return formatDateText(renewalDate);

  const cycleStart = parseUsDate(account.rewardCycleStart);
  if (cycleStart) return formatDateText(addDays(addYears(cycleStart, 1), -1));

  return account.expirationDate || "";
}

function toMoneyNumber(value) {
  const amount = Number.parseFloat(String(value || "").replace(/[$,]/g, ""));
  return Number.isFinite(amount) ? amount : 0;
}

function sumBy(items, key) {
  return Number(items.reduce((total, item) => total + (Number(item[key]) || 0), 0).toFixed(2));
}

function parseUsDate(value) {
  const match = String(value || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  return new Date(Number(match[3]), Number(match[1]) - 1, Number(match[2]));
}

function startOfDay(value) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function addDays(value, days) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function addYears(value, years) {
  const next = new Date(value);
  next.setFullYear(next.getFullYear() + years);
  return next;
}

function daysBetween(from, to) {
  return Math.ceil((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000);
}

function formatCurrencyText(value) {
  return new Intl.NumberFormat("en-US", { currency: "USD", style: "currency" }).format(value || 0);
}

function formatDateText(value) {
  return new Intl.DateTimeFormat("en-US", { month: "2-digit", day: "2-digit", year: "numeric" }).format(value);
}

export const usMint = {
  summary: [
    { label: "Accounts", value: "", detail: "Waiting for Supabase import", tone: "blue" },
    { label: "Active Items", value: "", detail: "Waiting for Supabase import", tone: "green" },
    { label: "Est. Value", value: "", detail: "Waiting for Supabase import", tone: "violet" },
    { label: "Buyer Gaps", value: "", detail: "Waiting for Supabase import", tone: "rose" }
  ],
  releases: [
    { release: "Morgan & Peace Reverse Proof Set", date: "", accounts: "", quantity: "", charge: "", buyer: "Not assigned", action: "Find buyer" },
    { release: "American Eagle Silver Proof", date: "", accounts: "", quantity: "", charge: "", buyer: "Not assigned", action: "Confirm offer" },
    { release: "Gold Proof Launch", date: "", accounts: "", quantity: "", charge: "", buyer: "Not assigned", action: "Check margin" }
  ],
  subscriptions: [
    { account: "US Mint account", items: "", card: "", address: "Needs import", status: "Waiting for Supabase import" }
  ]
};

export const dell = {
  summary: [
    { label: "Orders", value: "", detail: "Waiting for Supabase import", tone: "blue" },
    { label: "Rewards Pending", value: "", detail: "Waiting for Supabase import", tone: "violet" },
    { label: "Fulfillment", value: "", detail: "Waiting for Supabase import", tone: "green" },
    { label: "Profit Gap", value: "", detail: "Waiting for Supabase import", tone: "amber" }
  ],
  orders: [
    { account: "Dell account", order: "", item: "Needs import", rewards: "", status: "Waiting for Supabase import", buyer: "Not assigned", profit: "" }
  ],
  rewards: [
    { source: "Rakuten", expected: "", status: "Pending confirmation", action: "Check posting" },
    { source: "Amex Offers", expected: "", status: "Tracked", action: "Match statement credit" },
    { source: "Dell Rewards", expected: "", status: "Available soon", action: "Plan next order" }
  ]
};

export const commodities = {
  summary: [
    { label: "Silver oz", value: "", detail: "Waiting for Supabase import", tone: "blue" },
    { label: "Gold oz", value: "", detail: "Waiting for Supabase import", tone: "amber" },
    { label: "Cost Basis", value: "", detail: "Waiting for Supabase import", tone: "neutral" },
    { label: "Current Value", value: "", detail: "Waiting for Supabase import", tone: "green" }
  ],
  inventory: [
    { item: "Silver bullion", quantity: "", basis: "", value: "", gain: "", buyer: "Not assigned" },
    { item: "Gold bullion", quantity: "", basis: "", value: "", gain: "", buyer: "Not assigned" },
    { item: "US Mint collectibles", quantity: "", basis: "", value: "", gain: "", buyer: "Not assigned" }
  ]
};

export const buyers = [
  { name: "Amit", buys: "US Mint + Bullion", pending: "", balance: "", contact: "Manual", status: "Active", lastPurchase: "" },
  { name: "Bullion Gold", buys: "Dell + bullion", pending: "", balance: "", contact: "Email", status: "Awaiting payment", lastPurchase: "" },
  { name: "Pinehurst Coins", buys: "Gold proof + US Mint", pending: "", balance: "", contact: "Manual", status: "Ready", lastPurchase: "" }
];

export const rewards = [
  {
    source: "Costco Executive",
    amount: formatCurrencyText(costcoRewardAnalytics.totalEstimatedReward),
    status: `${costcoRewardAnalytics.executiveAccounts} active accounts`,
    nextAction: `${formatCurrencyText(costcoRewardAnalytics.totalRemainingToCap)} remaining to cap`
  },
  { source: "Dell Rakuten", amount: "", status: "Pending", nextAction: "Confirm portal credit" },
  { source: "Amex Offers", amount: "", status: "Expected", nextAction: "Match statement credits" },
  { source: "Credit Cards", amount: "Needs import", status: "Planned", nextAction: "Connect statements later" }
];

export const reports = [
  { name: "Profit Dashboard", metric: "", status: "Model ready", action: "Connect sales rows" },
  { name: "Expected Charges", metric: "", status: "Active", action: "Reconcile cards" },
  { name: "Rewards Rollup", metric: "", status: "Active", action: "Add card rewards" },
  { name: "Buyer Aging", metric: "", status: "Needs data", action: "Import buyer payments" }
];

export const syncSettings = [
  { source: "Google Sheets Costco", query: "Accounts, Orders, Rewards, Renewals tabs", status: "Spreadsheet ID ready", cadence: "Refresh and log rows" },
  { source: "Google Sheets US Mint", query: "Accounts, Orders, Release Calendar, Subscriptions tabs", status: "Spreadsheet ID ready", cadence: "Refresh and log rows" },
  { source: "Google Sheets Travel", query: "Trips, Flights, Certificates_Awards tabs", status: "Connected through service account", cadence: "Refresh and log rows" },
  { source: "Google Sheets Dell", query: "Accounts, Orders, Items, Rewards, Fulfillment, Sales tabs", status: "Spreadsheet ID ready", cadence: "Refresh and log rows" },
  { source: "Google Sheets Ops", query: "Buyers, rewards, alerts, reports, and inventory tabs", status: "Spreadsheet IDs ready", cadence: "Refresh and log rows" },
  { source: "Gmail OAuth", query: "Optional Costco and US Mint email import", status: "Can be disabled in Settings", cadence: "Manual only" }
];

export const alertRules = [
  "Costco renewal coming",
  "Costco reward cycle ending",
  "US Mint release window",
  "US Mint expected charge",
  "Buyer not assigned",
  "Dell order shipped",
  "Dell rewards pending",
  "Missing account data"
];
