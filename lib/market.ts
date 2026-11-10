/**
 * Análisis de mercado (externo). Datos investigados el 10 de noviembre de 2026.
 * Cada dato lleva su fuente; las estimaciones propias se marcan como tales.
 */
export const MARKET_UPDATED = "2026-11-10";

export const SOURCES = {
  issa: { label: "ISSA / Marketdata LLC, abr 2026", url: "https://www.issa.com/industry-news/17-billion-u-s-residential-maid-services-industry-continues-to-grow/" },
  acs: { label: "Social Explorer, ACS 1-year 2024", url: "https://www.socialexplorer.com/profiles/essential-report/dallas-fort-worth-arlington-tx-metro-area.html" },
  nctcog: { label: "NCTCOG, estimaciones al 1 ene 2026", url: "https://www.nctcog.org/executive-director/public-affairs/press-releases/north-central-texas-nears-9-million-residents-as-region-adds-more-than-200-000-people-in-one-year" },
  belong: { label: "Belong (con datos de HomeGuide), jul 2026", url: "https://belonghome.com/blog/how-much-does-cleaning-cost-in-dallas-fort-worth-2026-data" },
  thumbtack: { label: "Thumbtack, abr 2026", url: "https://www.thumbtack.com/p/house-cleaning-prices-dallas" },
  dallasMaids: { label: "Dallas Maids, guía de precios 2026", url: "https://dallasmaids.com/?p=16737" },
  webtonic: { label: "WebTonic con datos de WordStream 2025", url: "https://www.webtonic.io/blog/cleaning-services-google-ads-statistics" },
  jobber: { label: "Jobber, tendencias de limpieza 2026", url: "https://www.getjobber.com/academy/cleaning/cleaning-industry-trends/" },
  taskrabbit: { label: "Taskrabbit, nov 2026", url: "https://www.taskrabbit.com/cost-guides/home-organization" },
  bls: { label: "BLS, Dallas-Fort Worth, may 2025", url: "https://www.bls.gov/regions/southwest/news-release/occupationalemploymentandwages_dallasfortworth.htm" },
  pipelineon: { label: "Pipelineon, cómo cobra Thumbtack", url: "https://pipelineon.com/blog/how-much-does-thumbtack-charge-per-lead/" },
  mollymaid: { label: "Molly Maid McKinney / Frisco / Allen", url: "https://mollymaid.com/park-cities-mckinney-frisco-allen/our-services/regular-cleaning-service" },
  maidpro: { label: "MaidPro Frisco", url: "https://maidpro.com/frisco" },
  tca: { label: "The Cleaning Authority Plano / Frisco", url: "https://www.thecleaningauthority.com/plano-frisco/frisco/" },
} as const;

export type SourceKey = keyof typeof SOURCES;

export const MARKET = {
  usRevenue: 17.2e9, // 2025
  usGrowth2026: 0.055,
  usHouseholdsUsing: 22e6,
  usShareUsing: 0.16,
  usShare2012: 0.08,
  usCompanies: 32270,
  dfwHouseholds: 3_012_855, // 2024
  dfwMedianIncome: 92_733,
  regionPop: 8_952_590, // 1 ene 2026
  regionAdded2025: 203_786,
  collinAdded2025: 64_703,
  celinaAdded2025: 16_813,
  prices: [
    { label: "Limpieza estándar (DFW)", min: 140, max: 300, src: "belong" as SourceKey },
    { label: "Promedio en Dallas (Thumbtack)", min: 181, max: 322, src: "thumbtack" as SourceKey },
    { label: "Deep clean (Dallas)", min: 220, max: 440, src: "dallasMaids" as SourceKey },
    { label: "Move-out (Dallas)", min: 350, max: 600, src: "dallasMaids" as SourceKey },
  ],
  hourlyMin: 50,
  hourlyMax: 75,
  googleCpl: 46.99,
  googleConv: 0.1765,
  homeServicesCpl: 90.92,
  cplIncreaseShare: 0.69,
  cplIncrease: 0.1051,
  pricesRaised: 0.55,
  leadsFromRepeat: 0.64,
  leadsFromReferrals: 0.6,
  chooseQuality: 0.66,
  choosePrice: 0.53,
  chooseReviews: 0.51,
  organizerHourlyUS: 34,
  organizerCloset: [150, 2000],
  organizerWholeHome: [1500, 10000],
  cleaningWageDfw: 17.96,
};

/** Estimación propia del mercado de DFW: hogares × % que contrata × gasto anual promedio por hogar. */
export function dfwMarketEstimate() {
  const spendPerHousehold = MARKET.usRevenue / MARKET.usHouseholdsUsing;
  const households = MARKET.dfwHouseholds * MARKET.usShareUsing;
  return { spendPerHousehold, households, total: households * spendPerHousehold };
}
