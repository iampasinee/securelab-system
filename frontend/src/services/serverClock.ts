let offset = 0;
export const synchronizeServerClock = (serverNow: string) => {
  const timestamp = Date.parse(serverNow);
  if (Number.isFinite(timestamp)) offset = timestamp - Date.now();
};
export const getServerNow = () => new Date(Date.now() + offset);

export const getBangkokDateInputValue = (date = getServerNow()) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value;
  return `${value('year')}-${value('month')}-${value('day')}`;
};
