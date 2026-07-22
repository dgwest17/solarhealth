/**
 * Tooltip text for every audit input — EDIT FREELY, one place.
 * Each key matches a <Tip k="..."/> in InputSection.
 */
export const TOOLTIPS = {
  installYear: 'Closest guess to when the system was turned ON (not sold or installed on the roof). The true-up statement anniversary is usually the turn-on month — if they know when their true-up bill arrives, that\u2019s the month, and we can estimate the year.',
  installMonth: 'The month the system received Permission to Operate. Tip: the annual true-up statement lands on this month every year.',
  utility: 'The utility on their electric bill (SDG&E, SCE, PG&E, SMUD). Determines rates, TOU windows, and incentives.',
  careProgram: 'CARE is the low-income discount program (~30% off). It says CARE/FERA right on the bill if they\u2019re enrolled.',
  systemSize: 'Total DC size in kilowatts — panel count × panel watts ÷ 1000. Found on the contract, permit, or monitoring app.',
  usageAtInstall: 'Roughly how much power the home used per year BEFORE solar (kWh). The solar proposal usually shows this; otherwise estimate from old bills.',
  currentUsage: 'Total power the home uses per year NOW (kWh) — house consumption, not the utility bill amount. A Green Button upload sets this automatically.',
  annualProduction: 'How much the system generates per year (kWh). Best source: the monitoring app (Enphase/SolarEdge/Tesla) 12-month total.',
  nemVersion: 'NEM 1.0: applied before mid-2016. NEM 2.0: ~2016 through April 2023. NEM 3.0 (Solar Billing Plan): after April 2023.',
  exportRate: 'What the utility credits per kWh sent to the grid. NEM 2.0 is typically $0.06\u2013$0.08. Found on the true-up statement.',
  program: 'How they pay for the system: Cash (own it outright), Loan (own it, monthly payment), or PPA/Lease (a company owns it, they buy the power).',
  ppaDownpayment: 'Any money paid upfront when signing the PPA/lease. Usually $0.',
  ppaInitialRate: 'The $/kWh price in the PPA contract at signing. On page 1 of the agreement. If unknown, switch to "I know the current payment" mode.',
  ppaCurrentPayment: 'The monthly amount they pay the solar company TODAY (from their statement). We back-calculate the contract rate from this.',
  escalator: 'How much the PPA price increases each year — in the contract. 2.9% is the most common.',
  loanDownpayment: 'Cash paid at signing before the loan. Often $0.',
  loanPrincipal: 'The financed amount on the loan agreement — the system price minus any down payment.',
  loanTerm: 'Loan length in YEARS (10, 15, 20, 25). On the loan agreement.',
  loanInterestRate: 'The APR on the loan agreement. Solar loans typically 1.99%\u20138.99%.',
  taxCredit: 'The 30% federal Investment Tax Credit. Auto-calculated; adjust if they claimed a different amount.',
  cashGrossCost: 'The full price paid for the system BEFORE the tax credit. The credit and net cost calculate automatically.',
  batteryCapacity: 'Usable size in kWh — Tesla Powerwall \u2248 13.5, Enphase 5P \u2248 5 per unit (stackable). On the spec sheet or monitoring app.',
  batteryEfficiency: 'Round-trip efficiency — power out vs power in. 90% is typical for home batteries.',
  batteryMonthlyPayment: 'If the battery is financed separately, its monthly payment. $0 if it was bundled or paid cash.',
  panelManufacturer: 'Brand on the panels — check the contract, permit, or a photo of the panel label. Drives the warranty schedule on the report.',
  inverterManufacturer: 'Enphase/APsystems = micro (small boxes under each panel). SolarEdge/SMA/Fronius = one wall box. Check the wall by the meter.',
  batteryManufacturer: 'Brand of the battery system. Drives warranty and replacement planning on the report.',
  financeProvider: 'Who holds the loan/PPA paper — GoodLeap, Mosaic, Sunnova, Sunrun, etc. On the client\u2019s monthly statement or the original contract. Type any name if it\u2019s not in the list.',
  greenButton: 'Free 15-minute usage data from the utility website (Green Button Download). Makes this audit measured instead of estimated.'
};


/**
 * Per-utility Green Button download instructions — EDIT FREELY.
 * Shown in the upload card's ⓘ popover based on the selected utility.
 */
export const GB_INSTRUCTIONS = {
  SDGE: 'Log in at sdge.com → My Energy Center → Usage → "Green Button Download my data" → choose CSV, 15-minute interval, and a full 12-month date range → Download. Upload that .csv here.',
  SCE: 'Log in at sce.com → Data Sharing & Download (search "Green Button") → Download my data → CSV format, longest available range (aim for 12 months) → Download and upload the file here.',
  PGE: 'Log in at pge.com → Energy Usage Details → Green Button → "Export usage for a range of days" → CSV, full 12 months → Export. Upload the .csv here.',
  SMUD: 'Log in at smud.org → My Account → Usage → Green Button Download → CSV with the longest range available → upload the file here.'
};
