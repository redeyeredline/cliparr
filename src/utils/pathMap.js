export function mapSonarrPath(absPath) {
  const from = process.env.SONARR_PATH_PREFIX || '';
  const to = process.env.HOST_PATH_PREFIX || '';

  if (!from || !to) {
    return absPath; // no mapping configured
  }

  return absPath.startsWith(from) ? absPath.replace(from, to) : absPath;
}
