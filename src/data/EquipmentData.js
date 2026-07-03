/**
 * Equipment & manufacturer directory.
 *
 * Drives the report's Equipment & Warranty section, service-timeline
 * recommendations, and manufacturer contact block.
 *
 * warrantyYears  = manufacturer product warranty
 * lifeYears      = realistic expected service life (service/replace planning)
 * defunct        = manufacturer exited the business / bankrupt (orphaned
 *                  warranty — a service-plan talking point)
 *
 * NOTE FOR MAINTENANCE: websites are stable; phone numbers change — verify
 * before publishing and fill in the `phone` fields you want shown. Empty
 * phone = the report shows the website only.
 */

export const PANEL_MANUFACTURERS = [
  { value: 'qcells', label: 'Qcells', website: 'qcells.com', phone: '', warrantyYears: 25, lifeYears: 30 },
  { value: 'rec', label: 'REC Group', website: 'recgroup.com', phone: '', warrantyYears: 25, lifeYears: 30 },
  { value: 'panasonic', label: 'Panasonic', website: 'na.panasonic.com/us/energy-solutions', phone: '', warrantyYears: 25, lifeYears: 30 },
  { value: 'silfab', label: 'Silfab Solar', website: 'silfabsolar.com', phone: '', warrantyYears: 25, lifeYears: 30 },
  { value: 'jinko', label: 'JinkoSolar', website: 'jinkosolar.com', phone: '', warrantyYears: 25, lifeYears: 28 },
  { value: 'canadian', label: 'Canadian Solar', website: 'canadiansolar.com', phone: '', warrantyYears: 25, lifeYears: 28 },
  { value: 'trina', label: 'Trina Solar', website: 'trinasolar.com', phone: '', warrantyYears: 25, lifeYears: 28 },
  { value: 'mission', label: 'Mission Solar', website: 'missionsolar.com', phone: '', warrantyYears: 25, lifeYears: 28 },
  { value: 'sunpower', label: 'SunPower (legacy)', website: 'sunpower.com', phone: '', warrantyYears: 25, lifeYears: 30, defunct: true, defunctNote: 'SunPower filed Chapter 11 in 2024; panel warranties now serviced through successor channels.' },
  { value: 'lg', label: 'LG Solar (exited)', website: 'lg.com', phone: '', warrantyYears: 25, lifeYears: 30, defunct: true, defunctNote: 'LG exited the solar panel business in 2022; warranty support continues through LG but no new product.' },
  { value: 'other_panel', label: 'Other / Unknown', website: '', phone: '', warrantyYears: 25, lifeYears: 28 }
];

export const INVERTER_MANUFACTURERS = [
  { value: 'enphase', label: 'Enphase (microinverters)', website: 'enphase.com/support', phone: '', warrantyYears: 25, lifeYears: 25 },
  { value: 'solaredge', label: 'SolarEdge', website: 'solaredge.com/us/support', phone: '', warrantyYears: 12, lifeYears: 12 },
  { value: 'sma', label: 'SMA', website: 'sma-america.com', phone: '', warrantyYears: 10, lifeYears: 12 },
  { value: 'fronius', label: 'Fronius', website: 'fronius.com', phone: '', warrantyYears: 10, lifeYears: 12 },
  { value: 'tesla_inv', label: 'Tesla (string)', website: 'tesla.com/support/energy', phone: '', warrantyYears: 12, lifeYears: 12 },
  { value: 'generac_inv', label: 'Generac', website: 'generac.com/support', phone: '', warrantyYears: 10, lifeYears: 12 },
  { value: 'apsystems', label: 'APsystems (micro)', website: 'usa.apsystems.com', phone: '', warrantyYears: 25, lifeYears: 25 },
  { value: 'delta', label: 'Delta', website: 'delta-americas.com', phone: '', warrantyYears: 10, lifeYears: 12, defunct: true, defunctNote: 'Delta wound down US residential solar inverter support; service via third parties.' },
  { value: 'other_inverter', label: 'Other / Unknown', website: '', phone: '', warrantyYears: 10, lifeYears: 12 }
];

export const BATTERY_MANUFACTURERS = [
  { value: 'tesla_pw', label: 'Tesla Powerwall', website: 'tesla.com/support/energy/powerwall', phone: '', warrantyYears: 10, lifeYears: 12 },
  { value: 'enphase_bat', label: 'Enphase IQ Battery', website: 'enphase.com/support', phone: '', warrantyYears: 15, lifeYears: 15 },
  { value: 'franklinwh', label: 'FranklinWH', website: 'franklinwh.com', phone: '', warrantyYears: 12, lifeYears: 13 },
  { value: 'panasonic_ev', label: 'Panasonic EverVolt', website: 'na.panasonic.com/us/energy-solutions', phone: '', warrantyYears: 12, lifeYears: 13 },
  { value: 'generac_pwr', label: 'Generac PWRcell', website: 'generac.com/support', phone: '', warrantyYears: 10, lifeYears: 12 },
  { value: 'sonnen', label: 'sonnen', website: 'sonnenusa.com', phone: '', warrantyYears: 15, lifeYears: 15 },
  { value: 'lg_ess', label: 'LG Energy Solution (RESU)', website: 'lgessbattery.com', phone: '', warrantyYears: 10, lifeYears: 11 },
  { value: 'other_battery', label: 'Other / Unknown', website: '', phone: '', warrantyYears: 10, lifeYears: 12 }
];

export function findEquipment(list, value) {
  return list.find((m) => m.value === value) || null;
}

/**
 * Build the equipment schedule for a system: warranty end + expected
 * service/replacement year per component, and an overall recommended
 * inspection year.
 */
export function buildEquipmentSchedule({ installedYear, panelManufacturer, inverterManufacturer, batteryManufacturer, hasBattery, batteryInstalledYear }) {
  const nowYear = new Date().getFullYear();
  const items = [];

  const push = (kind, m, installYear) => {
    if (!m) return;
    const warrantyEnds = installYear + m.warrantyYears;
    const serviceYear = installYear + m.lifeYears;
    const age = nowYear - installYear;
    let status = 'Healthy';
    if (nowYear >= serviceYear) status = 'Replacement due';
    else if (nowYear >= serviceYear - 3) status = 'Plan for service';
    else if (nowYear >= warrantyEnds) status = 'Out of warranty';
    items.push({ kind, manufacturer: m, installYear, warrantyEnds, serviceYear, age, status });
  };

  push('Solar panels', findEquipment(PANEL_MANUFACTURERS, panelManufacturer), installedYear);
  push('Inverter', findEquipment(INVERTER_MANUFACTURERS, inverterManufacturer), installedYear);
  if (hasBattery) {
    push('Battery', findEquipment(BATTERY_MANUFACTURERS, batteryManufacturer), batteryInstalledYear || installedYear);
  }

  // Recommended inspection: the earliest of (a) 3 years before the nearest
  // service year, (b) now if any component is aging/out of warranty, (c) a
  // 10-year general checkup. Batteries pull the date in — degradation checks
  // matter from ~year 7.
  let inspectionYear = installedYear + 10;
  for (const it of items) {
    inspectionYear = Math.min(inspectionYear, it.serviceYear - 3);
    if (it.kind === 'Battery') inspectionYear = Math.min(inspectionYear, it.installYear + 7);
  }
  inspectionYear = Math.max(inspectionYear, nowYear); // never in the past
  const inspectionDue = items.some((i) => i.status !== 'Healthy') ? nowYear : inspectionYear;

  return { items, inspectionYear: inspectionDue, nowYear };
}
