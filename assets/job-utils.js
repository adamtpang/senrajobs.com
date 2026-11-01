export function normalizePay(range) {
  if (!range) return null;
  const min = Number.isFinite(range.min) && range.min >= 0 ? range.min : null;
  const max = Number.isFinite(range.max) && range.max >= 0 ? range.max : null;
  const period = { '1 YEAR':'year', 'per-year-salary':'year', year:'year', yearly:'year', '1 HOUR':'hour', 'per-hour-wage':'hour', hour:'hour', hourly:'hour', '1 MONTH':'month', 'per-month':'month', month:'month', '1 WEEK':'week', week:'week', '1 DAY':'day', 'per-day':'day', day:'day' }[range.period];
  if ((!min && !max) || !/^[A-Z]{3}$/.test(range.currency || '') || !period || (min !== null && max !== null && min > max)) return null;
  return { min, max, currency:range.currency, period };
}

export function ashbyPay(compensation) {
  const salary = compensation?.summaryComponents?.find(component => component.compensationType === 'Salary');
  return salary ? normalizePay({ min:salary.minValue, max:salary.maxValue, currency:salary.currencyCode, period:salary.interval }) : null;
}

export function leverPay(salary) {
  return salary ? normalizePay({ min:salary.min, max:salary.max, currency:salary.currency, period:salary.interval }) : null;
}

export function formatPay(pay) {
  if (!pay) return 'Pay not listed';
  const amount = value => value.toLocaleString('en-US', { maximumFractionDigits:2 });
  const range = pay.min === null ? `Up to ${amount(pay.max)}` : pay.max === null ? `From ${amount(pay.min)}` : pay.min === pay.max ? amount(pay.min) : `${amount(pay.min)}–${amount(pay.max)}`;
  return `${pay.currency} ${range}/${pay.period}`;
}
export function formatPublishedPay(role) {
  if(role.pay){
    const extra=role.payRanges?.find(r=>r.period===role.pay.period&&r.min===role.pay.min&&r.max===role.pay.max)?.additionalCompensation;
    return formatPay(role.pay)+(extra?' + '+extra:'');
  }
  const range=role.payRanges?.[0];if(!range)return 'Pay not listed';
  const amount=value=>Number.isFinite(value)?value.toLocaleString('en-US',{maximumFractionDigits:2}):'?';
  const values=range.min===range.max?amount(range.min):`${amount(range.min)}–${amount(range.max)}`;
  const basis=(range.type==='Total cash including potential bonus'?' · total cash incl. potential bonus':range.type==='Base salary'?' · base salary':'')+(range.additionalCompensation==='plus tips'?' + tips':'');
  const alternatives=range.location?'location':range.level?'level':null;
  return `${range.location||range.level?(range.location||range.level)+' · ':''}${range.currency || range.displayCurrency || ''} ${values}${range.period?'/'+range.period:' · period unspecified'}${range.currency?'':' · currency unspecified'}${basis}${alternatives&&role.payRanges.length>1?` (+${role.payRanges.length-1} other ${alternatives}${role.payRanges.length>2?'s':''})`:''}`.trim();
}

const textOrder = (a,b) => (a || '').localeCompare(b || '', 'en', { sensitivity:'base' });
export function compareRoles(a,b,sort) {
  let order = 0;
  if (sort === 'location') order = !a.location !== !b.location ? (!a.location ? 1 : -1) : textOrder(a.location,b.location);
  else if (sort === 'role') order = textOrder(a.title,b.title);
  else if (sort === 'company') order = textOrder(a.company,b.company);
  else if (sort === 'department') order = !a.department !== !b.department ? (!a.department ? 1 : -1) : textOrder(a.department,b.department);
  else if (sort === 'checked') order = Date.parse(b.fetched) - Date.parse(a.fetched);
  else if (sort.startsWith('pay|')) {
    const [,currency,period] = sort.split('|');
    // Compare only published upper bounds in the selected currency and interval.
    const value = r => r.pay?.currency === currency && r.pay?.period === period && Number.isFinite(r.pay.max) ? r.pay.max : null;
    const av = value(a), bv = value(b);
    order = av === null && bv !== null ? 1 : bv === null && av !== null ? -1 : av !== null && bv !== null ? bv - av : 0;
  }
  return order || textOrder(a.company,b.company) || textOrder(a.title,b.title) || textOrder(a.url,b.url);
}
