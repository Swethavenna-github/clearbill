// Lists show people in a reduced form. Full details need a deliberate "reveal", which is written to the audit log.
export const maskName = (name: string) => {
  const parts = name.split(" ").filter(Boolean);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : name;
};
export const maskPhone = (digits: string) => `+1 ••• ••• ${digits.slice(-4)}`;
export const formatPhone = (digits: string) => (digits.length === 10 ? `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}` : `+1 ${digits.replace(/(\d{3})(\d{3})(\d+)/, "$1 $2 $3")}`);
export const initialsOf = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0].toUpperCase())
    .slice(0, 2)
    .join("");
