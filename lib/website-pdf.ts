export const initialWebsiteSettings = {
  paper: 'A4',
  landscape: false,
  background: true,
  media: 'screen',
};

export function websiteAddress(input: string) {
  let address: URL;
  const value = input.trim();
  try {
    if (!value || value.length > 4096 || /[\x00-\x20\x7f\\]/.test(value)) throw new Error();
    address = new URL(/^[a-z][a-z\d+.-]*:/i.test(value) ? value : 'https://' + value);
    if (
      !['http:', 'https:'].includes(address.protocol) ||
      address.username ||
      address.password ||
      address.port
    )
      throw new Error();
  } catch {
    throw new Error('Bitte eine gültige öffentliche Website-Adresse ohne Zugangsdaten eingeben.');
  }
  return address.href;
}
