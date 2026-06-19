export const roundMoney = (value) => Number(Number(value || 0).toFixed(2));

export const formatCurrency = (value) => `L ${roundMoney(value).toFixed(2)}`;
