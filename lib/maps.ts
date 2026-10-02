export const mapsAdapter = {
  external: (location: string) =>
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`,
  embed: (location: string, key?: string) =>
    key
      ? `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(key)}&q=${encodeURIComponent(location)}`
      : null,
};
